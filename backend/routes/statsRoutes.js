const express = require('express');
const { getStats, getAllStatsForUser, updateStats } = require('../db/database');
const { authMiddleware } = require('../auth/authMiddleware');

const router = express.Router();

// GET /api/stats/all - Récupérer toutes les stats de l'utilisateur
router.get('/all', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const allStats = getAllStatsForUser(userId);

    // Calculer les stats globales
    let totalPlayed = 0, totalWins = 0, totalDuoPlayed = 0, totalDuoWins = 0, totalAttempts = 0;
    let bestStreak = 0;

    const statsByAnime = {};

    allStats.forEach(s => {
      totalPlayed += s.games_played;
      totalWins += s.wins;
      totalDuoPlayed += s.duo_played || 0;
      totalDuoWins += s.duo_wins || 0;
      totalAttempts += s.total_attempts || 0;
      bestStreak = Math.max(bestStreak, s.max_streak);

      statsByAnime[s.anime_id] = {
        played: s.games_played,
        wins: s.wins,
        streak: s.current_streak,
        maxStreak: s.max_streak,
        duoPlayed: s.duo_played || 0,
        duoWins: s.duo_wins || 0,
        totalAttempts: s.total_attempts || 0
      };
    });

    const soloPlayed = totalPlayed - totalDuoPlayed;
    const soloWins = totalWins - totalDuoWins;

    res.json({
      global: {
        totalPlayed,
        totalWins,
        winRate: totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0,
        soloPlayed,
        soloWins,
        soloWinRate: soloPlayed > 0 ? Math.round((soloWins / soloPlayed) * 100) : 0,
        duoPlayed: totalDuoPlayed,
        duoWins: totalDuoWins,
        duoWinRate: totalDuoPlayed > 0 ? Math.round((totalDuoWins / totalDuoPlayed) * 100) : 0,
        avgAttempts: totalPlayed > 0 ? (totalAttempts / totalPlayed).toFixed(1) : 0,
        bestStreak
      },
      byAnime: statsByAnime
    });
  } catch (error) {
    console.error('Get all stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/stats/:animeId
router.get('/:animeId', authMiddleware, (req, res) => {
  try {
    const { animeId } = req.params;
    const userId = req.user.userId;

    const stats = getStats(userId, animeId);

    res.json({
      played: stats.games_played,
      wins: stats.wins,
      streak: stats.current_streak,
      maxStreak: stats.max_streak,
      duoPlayed: stats.duo_played || 0,
      duoWins: stats.duo_wins || 0,
      totalAttempts: stats.total_attempts || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/stats/:animeId
router.put('/:animeId', authMiddleware, (req, res) => {
  try {
    const { animeId } = req.params;
    const { won, isDuo, attempts } = req.body;
    const userId = req.user.userId;

    if (typeof won !== 'boolean') {
      return res.status(400).json({ error: 'Le champ "won" est requis (boolean)' });
    }

    const stats = updateStats(userId, animeId, won, isDuo || false, attempts || 0);

    res.json({
      played: stats.games_played,
      wins: stats.wins,
      streak: stats.current_streak,
      maxStreak: stats.max_streak,
      duoPlayed: stats.duo_played,
      duoWins: stats.duo_wins,
      totalAttempts: stats.total_attempts
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
