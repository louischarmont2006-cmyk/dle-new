// src/pages/Movies.jsx
import { API_URL } from '../api.js';
import "./Movies.css";
import { useEffect, useState } from "react";
import MovieCard from "../components/MovieCard.jsx";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import InstallButton from "../components/InstallButton";

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    fetch(`${API_URL}/api/movies`)
      .then(res => res.json())
      .then(data => {
        setMovies(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading movies:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="movies-container">
        <div className="movies-content">
          <div className="loading-message">Chargement des films & séries...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="movies-container"
      style={{
        backgroundImage: `url(/background-films.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="movies-content">
        <header className="movies-header">
          <div className="logo-container">
            <img src="/images/logo-film.avif" alt="Filmdle" className="logo" />
            <h1 className="site-title">Moviedle</h1>
          </div>

          <nav className="movies-nav-buttons">
            <Link to="/" className="movies-nav-btn">
              Manga
            </Link>
            <Link to="/video-games" className="movies-nav-btn">
              Video Games
            </Link>
            <Link to="/movies" className="movies-nav-btn active">
              Movies & Series
            </Link>
          </nav>

          <div className="movies-user-section">
            {authLoading ? null : user ? (
              <Link to="/profile" className="movies-user-btn">
                <Avatar user={user} size="md" />
              </Link>
            ) : (
              <Link to="/login" className="movies-nav-btn login-btn">
                Connexion
              </Link>
            )}
          </div>
        </header>

        <div className="games-grid">
          {movies.length === 0 ? (
            <div className="no-movies">
              <p>Aucun film ou série disponible pour le moment</p>
            </div>
          ) : (
            movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))
          )}
        </div>
      </div>
      <InstallButton />
    </div>
  );
}