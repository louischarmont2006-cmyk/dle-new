// src/components/GameNavbar.jsx
import { NavLink, useLocation } from "react-router-dom";
import "./GameNavbar.css";

export default function GameNavbar({ gameId }) {
  const location = useLocation();
  
  // ⭐ Détecter le type (anime ou game)
  const isGame = location.pathname.startsWith('/game/');
  const basePath = isGame ? `/game/${gameId}` : `/anime/${gameId}`;
  const homePath = isGame ? '/video-games' : '/';
  const homeText = isGame ? 'Accueil' : 'Accueil';

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
