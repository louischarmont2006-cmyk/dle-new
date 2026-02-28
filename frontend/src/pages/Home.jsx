// src/pages/Home.jsx
import { API_URL } from '../api.js';
import "./Home.css";
import {useEffect, useState} from "react";
import Card from "../components/Card.jsx";
import {Link} from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import InstallButton from "../components/InstallButton";

export default function Home() {
  const [mangas, setMangas] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    fetch(`${API_URL}/api/animes`)
      .then(res => res.json())
      .then(data => {
        setMangas(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading games:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="home-container">
        <div className="home-content">
          <div className="loading-message">Chargement des mangas...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="home-container"
      style={{ 
        backgroundImage: `url(/background-manga.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="home-content">
        <header className="home-header">
          <div className="logo-container">
            <img src="/images/logo.jpg" alt="Mangadle" className="logo" />
            <h1 className="site-title">Mangadle</h1>
          </div>

          <nav className="nav-buttons">
            <Link to="/" className="nav-btn active">
              Manga
            </Link>
            <Link to="/video-games" className="nav-btn">
              Video Games
            </Link>
          </nav>

          <div className="user-section">
            {authLoading ? null : user ? (
              <Link to="/profile" className="user-btn">
                <Avatar user={user} size="md" />
              </Link>
            ) : (
              <Link to="/login" className="nav-btn login-btn">
                Connexion
              </Link>
            )}
          </div>
        </header>

        <div className="games-grid">
          {mangas.map((game) => (
            <Card key={game.id} game={game} />
          ))}
        </div>
      </div>
      {/* Bouton d'installation PWA */}
      <InstallButton />
    </div>
  );
}