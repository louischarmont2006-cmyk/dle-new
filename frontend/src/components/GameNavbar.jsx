// src/components/GameNavbar.jsx
import { NavLink, useLocation } from "react-router-dom";
import "./GameNavbar.css";

export default function GameNavbar({ gameId }) {
  const location = useLocation();

  // Détecter le type (anime, game ou movie)
  const isGame = location.pathname.startsWith('/game/');
  const isMovie = location.pathname.startsWith('/movie/');

  let basePath, homePath, homeText;

  if (isGame) {
    basePath = `/game/${gameId}`;
    homePath = '/video-games';
    homeText = 'Accueil';
  } else if (isMovie) {
    basePath = `/movie/${gameId}`;
    homePath = '/movies';
    homeText = 'Films & Séries';
  } else {
    basePath = `/anime/${gameId}`;
    homePath = '/';
    homeText = 'Accueil';
  }

  return (
    <nav className="game-navbar">
      <NavLink to={homePath} className="nav-home">
        ← {homeText}
      </NavLink>
      <div className="nav-tabs">
        <NavLink
          to={`${basePath}/play`}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          🎮 Game
        </NavLink>
        <NavLink
          to={`${basePath}/characters`}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          📋 Characters
        </NavLink>
      </div>
    </nav>
  );
}