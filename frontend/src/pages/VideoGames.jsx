// src/pages/VideoGames.jsx
import { API_URL } from '../api.js';
import "./VideoGames.css";
import { useEffect, useState } from "react";
import GameCard from "../components/GameCard.jsx";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import InstallButton from "../components/InstallButton";

export default function VideoGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    fetch(`${API_URL}/api/games`)
      .then(res => res.json())
      .then(data => {
        setGames(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading games:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="videogames-container">
        <div className="videogames-content">
          <div className="loading-message">Chargement des jeux...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="videogames-container"
      style={{ 
        backgroundImage: `url(/images/background-jeux.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="videogames-content">
        <header className="videogames-header">
          <div className="logo-container">
            <img src="/images/logo.png" alt="Gamedle" className="logo" />
            <h1 className="site-title">Gamedle</h1>
          </div>

          <nav className="videogames-nav-buttons">
            <Link to="/" className="videogames-nav-btn">
              Manga
            </Link>
            <Link to="/video-games" className="videogames-nav-btn active">
              Video Games
            </Link>
          </nav>

          <div className="videogames-user-section">
            {authLoading ? null : user ? (
              <Link to="/profile" className="videogames-user-btn">
                <Avatar user={user} size="md" />
              </Link>
            ) : (
              <Link to="/login" className="videogames-nav-btn login-btn">
                Connexion
              </Link>
            )}
          </div>
        </header>

        <div className="games-grid">
          {games.length === 0 ? (
            <div className="no-games">
              <p>Aucun jeu disponible pour le moment</p>
            </div>
          ) : (
            games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))
          )}
        </div>
      </div>
      {/* Bouton d'installation PWA */}
      <InstallButton />
    </div>
  );
}