import { API_URL } from '../api.js';
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const { user, token, logout, loading, refreshUser } = useAuth();
  const [animes, setAnimes] = useState([]);
  const [games, setGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState([]);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetch(`${API_URL}/api/animes`)
      .then(res => res.json())
      .then(data => setAnimes(data))
      .catch(console.error);

    fetch(`${API_URL}/api/games`)
      .then(res => res.json())
      .then(data => setGames(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!token) return;

    setLoadingStats(true);
    fetch(`${API_URL}/api/stats/all`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setStats(data);
        setLoadingStats(false);
      })
      .catch(() => setLoadingStats(false));
  }, [token]);

  useEffect(() => {
    if (!showAvatarPicker || avatarOptions.length > 0) return;

    const mangaPromises = animes.map(anime =>
      fetch(`${API_URL}/api/anime/${anime.id}`)
        .then(r => r.json())
        .then(data => ({
          type: 'manga',
          animeId: anime.id,
          animeName: anime.name,
          characters: (data.characters || []).slice(0, 439).map(c => ({
            id: c.id,
            name: c.name,
            image: `${API_URL}/api/images/${anime.id}/characters/${c.image}`
          }))
        }))
    );

    const gamePromises = games.map(game =>
      fetch(`${API_URL}/api/games/${game.id}`)
        .then(r => r.json())
        .then(data => ({
          type: 'game',
          animeId: game.id,
          animeName: game.name,
          characters: (data.characters || []).slice(0, 439).map(c => ({
            id: c.id,
            name: c.name,
            image: `${API_URL}/api/images/games/${game.id}/characters/${c.image}`
          }))
        }))
    );

    Promise.all([...mangaPromises, ...gamePromises]).then(results => {
      setAvatarOptions(results);
    });
  }, [showAvatarPicker, animes, games, avatarOptions.length]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  async function handleSelectAvatar(imagePath) {
    setSavingAvatar(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatarImage: imagePath })
      });

      if (res.ok) {
        await refreshUser();
        setShowAvatarPicker(false);
      }
    } catch (err) {
      console.error('Failed to update avatar:', err);
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleResetAvatar() {
    setSavingAvatar(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatarImage: null })
      });

      if (res.ok) {
        await refreshUser();
        setShowAvatarPicker(false);
      }
    } catch (err) {
      console.error('Failed to reset avatar:', err);
    } finally {
      setSavingAvatar(false);
    }
  }

  if (loading) {
    return <div className="profile-container"><div className="loading">Chargement...</div></div>;
  }

  if (!user) {
    return null;
  }

  const global = stats?.global || {};
  const byAnime = stats?.byAnime || {};

  // ⭐ Fusionner les mangas et les jeux vidéo pour l'affichage des stats
  const allGames = [
    ...animes.map(a => ({ ...a, type: 'manga' })),
    ...games.map(g => ({ ...g, type: 'game' }))
  ];

  return (
    <div className="profile-container">
      <header className="profile-header">
        <Link to="/" className="back-link">&larr; Retour</Link>
        <h1>Mon Profil</h1>
        <Link to="/friends" className="friends-link">Voir liste d'amis</Link>
      </header>

      <div className="profile-content">
        {/* Carte utilisateur */}
        <div className="profile-card user-info">
          <button
            className="avatar-edit-btn"
            onClick={() => setShowAvatarPicker(true)}
            title="Changer d'avatar"
          >
            <Avatar user={user} size="xl" />
            <span className="avatar-edit-icon">&#9998;</span>
          </button>
          <h2 className="username">{user.username}</h2>
          <p className="email">{user.email}</p>
          <button onClick={handleLogout} className="logout-btn">
            Se déconnecter
          </button>
        </div>

        {/* Stats globales */}
        <div className="profile-card global-stats">
          <h3>Statistiques globales</h3>
          {loadingStats ? (
            <div className="loading-stats">Chargement...</div>
          ) : (
            <>
              <div className="stats-grid main-stats">
                <div className="stat-item highlight">
                  <span className="stat-value">{global.totalPlayed || 0}</span>
                  <span className="stat-label">Parties jouées</span>
                </div>
                <div className="stat-item highlight">
                  <span className="stat-value">{global.totalWins || 0}</span>
                  <span className="stat-label">Victoires</span>
                </div>
                <div className="stat-item highlight">
                  <span className="stat-value">{global.winRate || 0}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
              </div>

              <div className="stats-comparison">
                <div className="mode-stats solo">
                  <div className="mode-header">
                    <span className="mode-icon">🎮</span>
                    <span className="mode-title">Solo</span>
                  </div>
                  <div className="mode-details">
                    <div className="mode-stat">
                      <span className="value">{global.soloPlayed || 0}</span>
                      <span className="label">parties</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.soloWins || 0}</span>
                      <span className="label">victoires</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.soloWinRate || 0}%</span>
                      <span className="label">win rate</span>
                    </div>
                  </div>
                </div>

                <div className="mode-stats duo">
                  <div className="mode-header">
                    <span className="mode-icon">⚔️</span>
                    <span className="mode-title">Duo</span>
                  </div>
                  <div className="mode-details">
                    <div className="mode-stat">
                      <span className="value">{global.duoPlayed || 0}</span>
                      <span className="label">parties</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.duoWins || 0}</span>
                      <span className="label">victoires</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.duoWinRate || 0}%</span>
                      <span className="label">win rate</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="extra-stats">
                <div className="extra-stat">
                  <span className="extra-icon">🎯</span>
                  <span className="extra-value">{global.avgAttempts || 0}</span>
                  <span className="extra-label">Essais en moyenne</span>
                </div>
                <div className="extra-stat">
                  <span className="extra-icon">🔥</span>
                  <span className="extra-value">{global.bestStreak || 0}</span>
                  <span className="extra-label">Meilleure série</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ⭐ Stats par jeu - MANGAS ET JEUX VIDÉO */}
        <div className="profile-card game-stats">
          <h3>Stats par jeu</h3>
          <div className="games-stats-list">
            {allGames.map(game => {
              const s = byAnime[game.id];
              if (!s || s.played === 0) return null;
              const soloGames = s.played - (s.duoPlayed || 0);
              const soloWins = s.wins - (s.duoWins || 0);
              return (
                <div key={game.id} className="game-stat-row">
                  <div className="game-info">
                    <span className="game-name">
                      {game.type === 'game' ? '' : ''}
                      {game.name}
                    </span>
                    <span className="game-total">{s.played} parties - {s.wins} victoires</span>
                  </div>
                  <div className="game-modes">
                    <div className="game-mode-stat solo">
                      <span className="mode-label">Solo</span>
                      <span className="mode-value">{soloGames}/{soloWins}</span>
                    </div>
                    <div className="game-mode-stat duo">
                      <span className="mode-label">Duo</span>
                      <span className="mode-value">{s.duoPlayed || 0}/{s.duoWins || 0}</span>
                    </div>
                    <div className="game-streak">
                      <span className="streak-icon">🔥</span>
                      <span className="streak-value">{s.streak}/{s.maxStreak}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(byAnime).length === 0 && (
              <p className="no-stats">Aucune partie jouée pour l'instant</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de selection d'avatar */}
      {showAvatarPicker && (
        <div className="avatar-picker-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="avatar-picker-header">
              <h2>Choisir un avatar</h2>
              <button className="close-btn" onClick={() => setShowAvatarPicker(false)}>&times;</button>
            </div>

            <div className="avatar-picker-content">
              {/* Option pour revenir a l'avatar par defaut */}
              <div className="avatar-section">
                <h3>Avatar par defaut</h3>
                <div className="avatar-grid">
                  <button
                    className={`avatar-option ${!user.avatar_image ? 'selected' : ''}`}
                    onClick={handleResetAvatar}
                    disabled={savingAvatar}
                  >
                    <div
                      className="avatar-preview default"
                      style={{ backgroundColor: user.avatar_color || '#3b82f6' }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  </button>
                </div>
              </div>

              {/* Personnages par anime ET par jeu vidéo */}
              {avatarOptions.map(item => (
                <div key={item.animeId} className="avatar-section">
                  <h3>
                    {item.type === 'game' ? '🎮 ' : '📚 '}
                    {item.animeName}
                  </h3>
                  <div className="avatar-grid">
                    {item.characters.map(char => (
                      <button
                        key={char.id}
                        className={`avatar-option ${user.avatar_image === char.image ? 'selected' : ''}`}
                        onClick={() => handleSelectAvatar(char.image)}
                        disabled={savingAvatar}
                        title={char.name}
                      >
                        <img src={char.image} alt={char.name} className="avatar-preview" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {avatarOptions.length === 0 && (
                <div className="loading-avatars">Chargement des avatars...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}