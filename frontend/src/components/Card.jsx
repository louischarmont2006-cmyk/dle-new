// src/components/Card.jsx
import { API_URL } from '../api.js';
import "./Card.css";
import { useNavigate } from "react-router-dom";

export default function Card({ game }) {
  const navigate = useNavigate();
  const characterCount = game.characters?.length || 0;

  return (
    <div
      className="game-card"
      onClick={() => navigate(`/anime/${game.id}`)}
    >
      {/* Image avec overlay */}
      <div className="card-image-wrapper">
        <img
          src={`${API_URL}/api/images/${game.id}/${game.icon}`}
          alt={game.name}
          className="card-image"
        />
        <div className="card-overlay">
          <span className="overlay-text">Voir détails</span>
        </div>
      </div>

      {/* Contenu */}
      <div className="card-content">
        <h2 className="card-title">{game.name}</h2>
        <div className="card-stats">
          <span className="card-stat">
            <span className="stat-icon">👤</span>
            {characterCount} personnages
          </span>
        </div>
      </div>

      {/* Boutons de jeu */}
      <div className="card-actions">
        <button
          className="action-btn solo-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/anime/${game.id}/play`);
          }}
        >
          🎮 Solo
        </button>
        <button
          className="action-btn duo-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/anime/${game.id}/play?mode=duo`);
          }}
        >
          👥 Duo
        </button>
      </div>
    </div>
  );
}