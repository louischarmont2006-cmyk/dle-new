const { Pool } = require('pg');
const crypto = require('crypto');

// Configuration PostgreSQL
// En production (Railway) : utilise DATABASE_URL automatiquement
// En développement : utilise SQLite comme fallback
const isPostgres = !!process.env.DATABASE_URL;

let pool;

if (isPostgres) {
  console.log('🐘 Using PostgreSQL database');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
  console.log('🏠 PostgreSQL not configured, using SQLite fallback for development');
  // Pour le dev local, garder SQLite
  const Database = require('better-sqlite3');
  const path = require('path');
  const db = new Database(path.join(__dirname, 'dle.db'));
  
  // Wrapper pour simuler l'API async de PostgreSQL
  pool = {
    query: async (text, params) => {
      // Convertir la syntaxe PostgreSQL ($1, $2) vers SQLite (?, ?)
      const sqliteQuery = text.replace(/\$\d+/g, '?');
      const stmt = db.prepare(sqliteQuery);
      
      if (text.toLowerCase().includes('select')) {
        const rows = stmt.all(...(params || []));
        return { rows };
      } else {
        const result = stmt.run(...(params || []));
        return { rows: [], rowCount: result.changes, lastInsertRowid: result.lastInsertRowid };
      }
    }
  };
}

// Initialisation des tables (PostgreSQL)
async function initDatabase() {
  if (!isPostgres) {
    // SQLite init déjà fait dans better-sqlite3
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        avatar_color TEXT,
        avatar_image TEXT,
        email_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        verification_token_expires TIMESTAMP,
        password_reset_token TEXT,
        password_reset_expires TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        anime_id TEXT NOT NULL,
        games_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        duo_played INTEGER DEFAULT 0,
        duo_wins INTEGER DEFAULT 0,
        total_attempts INTEGER DEFAULT 0,
        UNIQUE(user_id, anime_id)
      );

      CREATE TABLE IF NOT EXISTS duo_matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER NOT NULL REFERENCES users(id),
        player2_id INTEGER NOT NULL REFERENCES users(id),
        anime_id TEXT NOT NULL,
        winner_id INTEGER REFERENCES users(id),
        player1_attempts INTEGER DEFAULT 0,
        player2_attempts INTEGER DEFAULT 0,
        game_mode TEXT DEFAULT 'turnbased',
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Appeler l'init au démarrage
initDatabase();

// Générer une couleur aléatoire pour l'avatar
function generateRandomColor() {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Générer un token sécurisé
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Fonctions utilisateurs (ASYNC maintenant)
async function createUser(email, passwordHash, username) {
  const avatarColor = generateRandomColor();
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username, avatar_color, email_verified, verification_token, verification_token_expires)
     VALUES ($1, $2, $3, $4, 0, $5, $6)
     RETURNING id`,
    [email, passwordHash, username, avatarColor, verificationToken, tokenExpires]
  );
  
  return { id: result.rows[0].id, avatarColor, verificationToken };
}

async function findUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

async function findUserByUsername(username) {
  const result = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  return result.rows[0];
}

async function findUserById(id) {
  const result = await pool.query(
    'SELECT id, email, username, created_at, avatar_color, avatar_image, email_verified FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

async function findUserByVerificationToken(token) {
  const result = await pool.query('SELECT * FROM users WHERE verification_token = $1', [token]);
  return result.rows[0];
}

async function verifyUserEmail(userId) {
  await pool.query(
    'UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
    [userId]
  );
}

async function createPasswordResetToken(userId) {
  const resetToken = generateToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await pool.query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
    [resetToken, expires, userId]
  );
  return resetToken;
}

async function findUserByResetToken(token) {
  const result = await pool.query('SELECT * FROM users WHERE password_reset_token = $1', [token]);
  return result.rows[0];
}

async function updateUserPassword(userId, newPasswordHash) {
  await pool.query(
    'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1',
    [newPasswordHash, userId]
  );
}

async function resendVerificationToken(userId) {
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await pool.query(
    'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
    [verificationToken, tokenExpires, userId]
  );
  return verificationToken;
}

async function updateUserAvatar(userId, avatarImage) {
  await pool.query('UPDATE users SET avatar_image = $1 WHERE id = $2', [avatarImage, userId]);
}

// Fonctions stats
async function getStats(userId, animeId) {
  const result = await pool.query(
    'SELECT * FROM user_stats WHERE user_id = $1 AND anime_id = $2',
    [userId, animeId]
  );

  if (!result.rows[0]) {
    return {
      games_played: 0,
      wins: 0,
      current_streak: 0,
      max_streak: 0,
      duo_played: 0,
      duo_wins: 0,
      total_attempts: 0
    };
  }

  return result.rows[0];
}

async function getAllStatsForUser(userId) {
  const result = await pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
  return result.rows;
}

async function updateStats(userId, animeId, won, isDuo = false, attempts = 0) {
  const current = await getStats(userId, animeId);

  const gamesPlayed = current.games_played + 1;
  const wins = current.wins + (won ? 1 : 0);
  const currentStreak = won ? current.current_streak + 1 : 0;
  const maxStreak = Math.max(current.max_streak, currentStreak);
  const duoPlayed = current.duo_played + (isDuo ? 1 : 0);
  const duoWins = current.duo_wins + (isDuo && won ? 1 : 0);
  const totalAttempts = current.total_attempts + attempts;

  await pool.query(`
    INSERT INTO user_stats (user_id, anime_id, games_played, wins, current_streak, max_streak, duo_played, duo_wins, total_attempts)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      games_played = EXCLUDED.games_played,
      wins = EXCLUDED.wins,
      current_streak = EXCLUDED.current_streak,
      max_streak = EXCLUDED.max_streak,
      duo_played = EXCLUDED.duo_played,
      duo_wins = EXCLUDED.duo_wins,
      total_attempts = EXCLUDED.total_attempts
  `, [userId, animeId, gamesPlayed, wins, currentStreak, maxStreak, duoPlayed, duoWins, totalAttempts]);

  return {
    games_played: gamesPlayed,
    wins: wins,
    current_streak: currentStreak,
    max_streak: maxStreak,
    duo_played: duoPlayed,
    duo_wins: duoWins,
    total_attempts: totalAttempts
  };
}

async function recordDuoMatch(player1Id, player2Id, animeId, winnerId, player1Attempts, player2Attempts, gameMode = 'turnbased') {
  await pool.query(`
    INSERT INTO duo_matches (player1_id, player2_id, anime_id, winner_id, player1_attempts, player2_attempts, game_mode)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [player1Id, player2Id, animeId, winnerId, player1Attempts, player2Attempts, gameMode]);
}

async function getFriends(userId) {
  const result = await pool.query(`
    SELECT 
      u.id,
      u.username,
      u.avatar_color,
      u.avatar_image,
      COUNT(DISTINCT dm.id) as games_played,
      SUM(CASE WHEN dm.winner_id = $1 THEN 1 ELSE 0 END) as my_wins,
      SUM(CASE WHEN dm.winner_id = u.id THEN 1 ELSE 0 END) as their_wins,
      MAX(dm.played_at) as last_played
    FROM users u
    INNER JOIN duo_matches dm ON (dm.player1_id = u.id OR dm.player2_id = u.id)
    WHERE (dm.player1_id = $2 OR dm.player2_id = $3)
      AND u.id != $4
    GROUP BY u.id
    ORDER BY last_played DESC
  `, [userId, userId, userId, userId]);
  return result.rows;
}

async function getFriendStats(userId, friendId) {
  const globalResult = await pool.query(`
    SELECT 
      COUNT(*) as total_games,
      SUM(CASE WHEN winner_id = $1 THEN 1 ELSE 0 END) as user_wins,
      SUM(CASE WHEN winner_id = $2 THEN 1 ELSE 0 END) as friend_wins,
      COALESCE(AVG(CASE 
        WHEN player1_id = $3 THEN player1_attempts 
        WHEN player2_id = $4 THEN player2_attempts 
        ELSE 0 
      END), 0) as user_avg_attempts,
      COALESCE(AVG(CASE 
        WHEN player1_id = $5 THEN player1_attempts 
        WHEN player2_id = $6 THEN player2_attempts 
        ELSE 0 
      END), 0) as friend_avg_attempts
    FROM duo_matches
    WHERE (player1_id = $7 AND player2_id = $8) OR (player1_id = $9 AND player2_id = $10)
  `, [userId, friendId, userId, userId, friendId, friendId, userId, friendId, friendId, userId]);

  const byGameResult = await pool.query(`
    SELECT 
      anime_id,
      COUNT(*) as games_played,
      SUM(CASE WHEN winner_id = $1 THEN 1 ELSE 0 END) as user_wins,
      SUM(CASE WHEN winner_id = $2 THEN 1 ELSE 0 END) as friend_wins
    FROM duo_matches
    WHERE (player1_id = $3 AND player2_id = $4) OR (player1_id = $5 AND player2_id = $6)
    GROUP BY anime_id
    ORDER BY games_played DESC
  `, [userId, friendId, userId, friendId, friendId, userId]);

  const friendInfo = await findUserById(friendId);

  return {
    friend: friendInfo,
    global: globalResult.rows[0],
    byGame: byGameResult.rows
  };
}

module.exports = {
  pool,
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  findUserByVerificationToken,
  verifyUserEmail,
  createPasswordResetToken,
  findUserByResetToken,
  updateUserPassword,
  resendVerificationToken,
  updateUserAvatar,
  getStats,
  getAllStatsForUser,
  updateStats,
  recordDuoMatch,
  getFriends,
  getFriendStats
};