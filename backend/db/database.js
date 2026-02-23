const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ⭐ Railway Volume Support
// Railway monte les volumes sur /data (comme Render)
// En production, utiliser /data pour la persistance
// En développement, utiliser le dossier local
const dbPath = process.env.RAILWAY_ENVIRONMENT 
  ? (fs.existsSync('/data') ? '/data/dle.db' : path.join(__dirname, 'dle.db'))
  : path.join(__dirname, 'dle.db');

console.log(`📁 Database location: ${dbPath}`);
console.log(`🚂 Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}`);

const db = new Database(dbPath);

// Initialisation des tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id TEXT NOT NULL,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    duo_played INTEGER DEFAULT 0,
    duo_wins INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, anime_id)
  );

  CREATE TABLE IF NOT EXISTS duo_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    anime_id TEXT NOT NULL,
    winner_id INTEGER,
    player1_attempts INTEGER DEFAULT 0,
    player2_attempts INTEGER DEFAULT 0,
    game_mode TEXT DEFAULT 'turnbased',
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
  );
`);

// Migration: ajouter les nouvelles colonnes si elles n'existent pas
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN duo_played INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN duo_wins INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN total_attempts INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }

// Migration avatars
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_color TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_image TEXT`);
} catch (e) { /* colonne existe déjà */ }

// Migration username unique
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
} catch (e) { /* index existe déjà */ }

// Migration email verification
try {
  db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN verification_token_expires DATETIME`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_reset_expires DATETIME`);
} catch (e) { /* colonne existe déjà */ }

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

// Fonctions utilisateurs
function createUser(email, passwordHash, username) {
  const avatarColor = generateRandomColor();
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  const stmt = db.prepare(
    `INSERT INTO users (email, password_hash, username, avatar_color, email_verified, verification_token, verification_token_expires)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  );
  const result = stmt.run(email, passwordHash, username, avatarColor, verificationToken, tokenExpires);
  return { id: result.lastInsertRowid, avatarColor, verificationToken };
}

function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function findUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
  return stmt.get(username);
}

function findUserById(id) {
  const stmt = db.prepare('SELECT id, email, username, created_at, avatar_color, avatar_image, email_verified FROM users WHERE id = ?');
  return stmt.get(id);
}

function findUserByVerificationToken(token) {
  const stmt = db.prepare('SELECT * FROM users WHERE verification_token = ?');
  return stmt.get(token);
}

function verifyUserEmail(userId) {
  const stmt = db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?');
  stmt.run(userId);
}

function createPasswordResetToken(userId) {
  const resetToken = generateToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

  const stmt = db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?');
  stmt.run(resetToken, expires, userId);
  return resetToken;
}

function findUserByResetToken(token) {
  const stmt = db.prepare('SELECT * FROM users WHERE password_reset_token = ?');
  return stmt.get(token);
}

function updateUserPassword(userId, newPasswordHash) {
  const stmt = db.prepare('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?');
  stmt.run(newPasswordHash, userId);
}

function resendVerificationToken(userId) {
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare('UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?');
  stmt.run(verificationToken, tokenExpires, userId);
  return verificationToken;
}

function updateUserAvatar(userId, avatarImage) {
  const stmt = db.prepare('UPDATE users SET avatar_image = ? WHERE id = ?');
  stmt.run(avatarImage, userId);
}

// Fonctions stats
function getStats(userId, animeId) {
  const stmt = db.prepare(
    'SELECT * FROM user_stats WHERE user_id = ? AND anime_id = ?'
  );
  const stats = stmt.get(userId, animeId);

  if (!stats) {
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

  return stats;
}

function getAllStatsForUser(userId) {
  const stmt = db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
  return stmt.all(userId);
}

function updateStats(userId, animeId, won, isDuo = false, attempts = 0) {
  // Récupérer les stats actuelles
  const current = getStats(userId, animeId);

  const gamesPlayed = current.games_played + 1;
  const wins = current.wins + (won ? 1 : 0);
  const currentStreak = won ? current.current_streak + 1 : 0;
  const maxStreak = Math.max(current.max_streak, currentStreak);
  const duoPlayed = current.duo_played + (isDuo ? 1 : 0);
  const duoWins = current.duo_wins + (isDuo && won ? 1 : 0);
  const totalAttempts = current.total_attempts + attempts;

  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, anime_id, games_played, wins, current_streak, max_streak, duo_played, duo_wins, total_attempts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      games_played = excluded.games_played,
      wins = excluded.wins,
      current_streak = excluded.current_streak,
      max_streak = excluded.max_streak,
      duo_played = excluded.duo_played,
      duo_wins = excluded.duo_wins,
      total_attempts = excluded.total_attempts
  `);

  stmt.run(userId, animeId, gamesPlayed, wins, currentStreak, maxStreak, duoPlayed, duoWins, totalAttempts);

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

// ★ NOUVEAU - Enregistrer un match duo
function recordDuoMatch(player1Id, player2Id, animeId, winnerId, player1Attempts, player2Attempts, gameMode = 'turnbased') {
  const stmt = db.prepare(`
    INSERT INTO duo_matches (player1_id, player2_id, anime_id, winner_id, player1_attempts, player2_attempts, game_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(player1Id, player2Id, animeId, winnerId, player1Attempts, player2Attempts, gameMode);
}

// ★ NOUVEAU - Récupérer la liste des amis (joueurs rencontrés)
function getFriends(userId) {
  const stmt = db.prepare(`
    SELECT 
      u.id,
      u.username,
      u.avatar_color,
      u.avatar_image,
      COUNT(DISTINCT dm.id) as games_played,
      SUM(CASE WHEN dm.winner_id = ? THEN 1 ELSE 0 END) as my_wins,
      SUM(CASE WHEN dm.winner_id = u.id THEN 1 ELSE 0 END) as their_wins,
      MAX(dm.played_at) as last_played
    FROM users u
    INNER JOIN duo_matches dm ON (dm.player1_id = u.id OR dm.player2_id = u.id)
    WHERE (dm.player1_id = ? OR dm.player2_id = ?)
      AND u.id != ?
    GROUP BY u.id
    ORDER BY last_played DESC
  `);
  return stmt.all(userId, userId, userId, userId);
}

// ★ NOUVEAU - Récupérer les stats détaillées d'un ami
function getFriendStats(userId, friendId) {
  // Stats globales entre les deux joueurs
  const globalStmt = db.prepare(`
    SELECT 
      COUNT(*) as total_games,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as user_wins,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as friend_wins,
      AVG(CASE 
        WHEN player1_id = ? THEN player1_attempts 
        WHEN player2_id = ? THEN player2_attempts 
        ELSE 0 
      END) as user_avg_attempts,
      AVG(CASE 
        WHEN player1_id = ? THEN player1_attempts 
        WHEN player2_id = ? THEN player2_attempts 
        ELSE 0 
      END) as friend_avg_attempts
    FROM duo_matches
    WHERE (player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?)
  `);
  const global = globalStmt.get(
    userId, friendId,           // pour user_wins, friend_wins
    userId, userId,              // pour user_avg_attempts
    friendId, friendId,          // pour friend_avg_attempts
    userId, friendId,            // pour WHERE clause 1
    friendId, userId             // pour WHERE clause 2
  );

  // Stats par jeu
  const byGameStmt = db.prepare(`
    SELECT 
      anime_id,
      COUNT(*) as games_played,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as user_wins,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as friend_wins
    FROM duo_matches
    WHERE (player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?)
    GROUP BY anime_id
    ORDER BY games_played DESC
  `);
  const byGame = byGameStmt.all(userId, friendId, userId, friendId, friendId, userId);

  // Info de l'ami
  const friendInfo = findUserById(friendId);

  return {
    friend: friendInfo,
    global,
    byGame
  };
}

module.exports = {
  db,
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
  recordDuoMatch, // ★ NOUVEAU
  getFriends, // ★ NOUVEAU
  getFriendStats // ★ NOUVEAU
};