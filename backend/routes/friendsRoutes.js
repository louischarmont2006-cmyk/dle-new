const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth/authMiddleware');
const { getFriends, getFriendStats } = require('../db/database');

// Liste des amis (joueurs rencontrés en duo)
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const friends = await getFriends(req.user.userId);
    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Profil détaillé d'un ami
router.get('/friends/:friendId', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;
    const data = await getFriendStats(req.user.userId, parseInt(friendId));
    
    if (!data.friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching friend stats:', error);
    res.status(500).json({ error: 'Failed to fetch friend stats' });
  }
});

module.exports = router;