import { API_URL } from '../api.js';
// src/pages/GameDetail.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "./Detail.css";

export default function GameDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/games/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setGame(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="detail-container">
        <div className="detail-loading">Chargement...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="detail-container">
        <div className="detail-error">
          <h2>Jeu introuvable</h2>
          <Link to="/video-games" className="back-home-btn">Retour aux jeux</Link>
        </div>
      </div>
    );
  }

  const characterCount = game.characters?.length || 0;
  const attributeCount = game.attributes?.length || 0;
  const previewCharacters = game.characters?.slice(0, 8) || [];

  return (
    <div
      className="detail-container"
      style={{ backgroundImage: `url(/api/images/games/${id}/${game.background})` }}
    >
      <div className="detail-overlay">
        {/* Navigation */}
        <div className="detail-nav">
          <Link to="/video-games" className="back-home-btn">← Accueil</Link>
        </div>

        {/* Header */}
        <header className="detail-header">
          <div className="detail-icon">
            <img src={`${API_URL}/api/images/games/${id}/${game.icon}`} alt={game.name} />
          </div>
          <div className="detail-title-section">
            <h1 className="detail-title">{game.name}</h1>
            <div className="detail-stats">
              <div className="stat-badge">
                <span className="stat-number">{characterCount}</span>
                <span className="stat-label">Personnages</span>
              </div>
              <div className="stat-badge">
                <span className="stat-number">{attributeCount}</span>
                <span className="stat-label">Attributs</span>
              </div>
              <div className="stat-badge">
                <span className="stat-number">{game.maxAttempts || 26}</span>
                <span className="stat-label">Essais max</span>
              </div>
            </div>
          </div>
        </header>

        {/* Game Modes */}
        <section className="detail-section">
          <h2 className="section-title">Modes de jeu</h2>
          <div className="game-modes">
            <Link to={`/game/${id}/play`} className="mode-card solo">
              <div className="mode-icon">🎮</div>
              <div className="mode-info">
                <h3>Solo</h3>
                <p>Trouve le personnage mystère en utilisant les indices</p>
              </div>
              <div className="mode-arrow">→</div>
            </Link>
            <Link to={`/game/${id}/play?mode=duo`} className={`mode-card duo ${!user && !authLoading ? 'requires-login' : ''}`}>
              <div className="mode-icon">{!user && !authLoading ? '🔒' : '👥'}</div>
              <div className="mode-info">
                <h3>Duo</h3>
                <p>Affronte un autre joueur en temps réel</p>
                {!user && !authLoading && <span className="login-hint">Connexion requise</span>}
              </div>
              <div className="mode-arrow">→</div>
            </Link>
          </div>
        </section>

        {/* Characters Preview */}
        {characterCount > 0 && (
          <section className="detail-section">
            <div className="section-header">
              <h2 className="section-title">Personnages</h2>
              <Link to={`/game/${id}/characters`} className="see-all-btn">
                Voir tous →
              </Link>
            </div>
            <div className="characters-preview">
              {previewCharacters.map((char) => (
                <div key={char.id} className="character-preview-card">
                  <img
                    src={`${API_URL}/api/images/games/${id}/characters/${char.image}`}
                    alt={char.name}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span className="character-name">{char.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}