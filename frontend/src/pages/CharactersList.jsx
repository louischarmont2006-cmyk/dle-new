// src/pages/CharactersList.jsx
import { API_URL } from '../api.js';
import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import CharactersTable from "../components/CharactersTable";
import GameNavbar from "../components/GameNavbar";
import "./Game.css";

export default function CharactersList() {
  const { id } = useParams();
  const location = useLocation();
  const [gameData, setGameData] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Détecter le type (anime ou game)
  const isGame = location.pathname.startsWith('/game/');
  const apiPath = isGame ? 'games' : 'anime';
  const imagePath = isGame ? 'games' : '';
  const backPath = isGame ? '/video-games' : '/';

  useEffect(() => {
    fetch(`${API_URL}/api/${apiPath}/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setGameData(data);
        setCharacters(data.characters || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading characters:", err);
        setLoading(false);
      });
  }, [id, apiPath]);

  if (loading) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="loading">Loading characters...</div>
        </div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="loading" style={{ flexDirection: 'column', gap: '1rem' }}>
            <span style={{ color: '#ef4444' }}>Game not found</span>
            <Link to={backPath} className="back-btn">
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ⭐ Chemin d'image dynamique
  const imageBasePath = imagePath ? `${API_URL}/api/images/${imagePath}/${id}` : `${API_URL}/api/images/${id}`;

  return (
    <div
      className="characters-list-container"
      style={{ backgroundImage: `url(${imageBasePath}/${gameData.background})` }}
    >
      <GameNavbar gameId={id} />
      <div className="characters-list-overlay">
        <div className="characters-list-content">
          <h1 className="characters-list-title">{gameData.name} - All Characters</h1>
          <CharactersTable
            characters={characters}
            attributes={gameData.attributes || []}
            gameId={id}
            imagePath={imagePath}
          />
        </div>
      </div>
    </div>
  );
}