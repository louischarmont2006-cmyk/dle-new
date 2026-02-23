const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// GET /api/games - Liste tous les jeux vidéo disponibles
router.get('/', (req, res) => {
  try {
    const gamesDir = path.join(__dirname, '../data/games');
    
    // Vérifier si le dossier existe, sinon le créer
    if (!fs.existsSync(gamesDir)) {
      fs.mkdirSync(gamesDir, { recursive: true });
      return res.json([]);
    }
    
    const files = fs.readdirSync(gamesDir).filter(f => f.endsWith('.json'));
    
    const games = files.map(file => {
      try {
        const filePath = path.join(gamesDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        return {
          id: file.replace('.json', ''),
          name: data.name,
          icon: data.icon,
          characterCount: data.characters?.length || 0
        };
      } catch (err) {
        console.error(`Error reading game file ${file}:`, err);
        return null;
      }
    }).filter(game => game !== null);
    
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/games/:id - Récupère les détails d'un jeu spécifique
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(__dirname, '../data/games', `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Jeu non trouvé' });
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;