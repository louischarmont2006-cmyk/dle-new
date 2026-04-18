import { API_URL } from '../api.js';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Avatar from '../components/Avatar';
import './Profile.css';

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [animes, setAnimes] = useState([]);
  const [games, setGames] = useState([]);
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/animes`)
      .then(r => r.json()).then(setAnimes).catch(console.error);
    fetch(`${API_URL}/api/games`)
      .then(r => r.json()).then(setGames).catch(console.error);
    fetch(`${API_URL}/api/movies`)
      .then(r => r.json()).then(setMovies).catch(console.error);
  }, []);

  useEffect(() => {
    if (!userId) return;

    Promise.all([
      fetch(`${API_URL}/api/stats/public/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/auth/public/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).then(r => r.ok ? r.json() : null)
    ])
      .then(([statsData, userData]) => {
        setStats(statsData);
        setProfileUser(userData?.user || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, token]);

  if (loading) {
    return <div className="profile-container"><div className="loading">Chargement...</div></div>;
  }

  if (!profileUser) {
    return (
      <div className="profile-container">
        <div className="loading">
          <p style={{ color: '#f87171' }}>Joueur introuvable.</p>
          <button
            onClick={() => navigate('/leaderboard')}
            style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '1rem' }}
          >
            ← Retour au classement
          </button>
        </div>
      </div>
    );
  }

  const global = stats?.global || {};
  const byAnime = stats?.byAnime || {};

  const allGames = [
    ...animes.map(a => ({ ...a, type: 'manga' })),
    ...games.map(g => ({ ...g, type: 'game' })),
    ...movies.map(m => ({ ...m, type: 'movie' })),
  ];

  return (
    <div className="profile-container">
      <header className="profile-header">
        <button onClick={() => navigate(-1)} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Retour
        </button>
        <h1>Profil de {profileUser.username}</h1>
        <div style={{ width: 140 }} />
      </header>

      <div className="profile-content">
        {/* Carte utilisateur */}
        <div className="profile-card user-info">
          <Avatar user={profileUser} size="xl" />
          <h2 className="username">{profileUser.username}</h2>
        </div>

        {/* Stats globales */}
        <div className="profile-card global-stats">
          <h3>Statistiques globales</h3>
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
        </div>

        {/* Stats par jeu */}
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
                      {game.type === 'game' ? '🎮 ' : game.type === 'movie' ? '🎬 ' : '📚 '}
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
            {Object.keys(byAnime).filter(k => byAnime[k].played > 0).length === 0 && (
              <p className="no-stats">Aucune partie jouée pour l'instant</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}