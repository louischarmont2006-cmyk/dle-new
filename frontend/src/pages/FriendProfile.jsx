import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import "./FriendProfile.css";
import { API_URL } from '../api.js';

export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { user, token, loading } = useAuth();
  const [friendData, setFriendData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [animes, setAnimes] = useState([]);
  const [games, setGames] = useState([]);
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetch(`${API_URL}/api/animes`)
      .then(res => res.json())
      .then(data => setAnimes(data))
      .catch(err => console.error('Error loading animes:', err));

    fetch(`${API_URL}/api/games`)
      .then(res => res.json())
      .then(data => setGames(data))
      .catch(err => console.error('Error loading games:', err));

    fetch(`${API_URL}/api/movies`)
      .then(res => res.json())
      .then(data => setMovies(data))
      .catch(err => console.error('Error loading movies:', err));
  }, []);

  useEffect(() => {
    if (!token || !friendId) return;

    const url = `${API_URL}/api/friends/${friendId}`;

    setDebugInfo({
      friendId,
      apiUrl: API_URL,
      fullUrl: url,
      hasToken: !!token,
      tokenLength: token?.length || 0,
      timestamp: new Date().toISOString()
    });

    setLoadingData(true);
    setError(null);

    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(r => {
        setDebugInfo(prev => ({
          ...prev,
          responseStatus: r.status,
          responseOk: r.ok
        }));

        if (!r.ok) {
          return r.text().then(text => {
            throw new Error(`HTTP ${r.status}: ${text || 'No error message'}`);
          });
        }
        return r.json();
      })
      .then(data => {
        setFriendData(data);
        setLoadingData(false);
      })
      .catch((err) => {
        setError(err.message);
        setDebugInfo(prev => ({ ...prev, error: err.message }));
        setLoadingData(false);
      });
  }, [token, friendId]);

  if (loading || loadingData) {
    return (
      <div className="friend-profile-container">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friend-profile-container">
        <div className="loading">
          <h2 style={{color: '#ef4444', marginBottom: '1rem'}}>❌ Erreur</h2>
          <p style={{marginBottom: '1rem'}}>{error}</p>
          <div style={{
            background: 'rgba(0,0,0,0.5)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginTop: '1rem',
            textAlign: 'left',
            fontSize: '0.85rem',
            fontFamily: 'monospace'
          }}>
            <div><strong>Debug Info:</strong></div>
            <div>Friend ID: {debugInfo.friendId}</div>
            <div>Full URL: {debugInfo.fullUrl}</div>
            <div>Has Token: {debugInfo.hasToken ? '✅' : '❌'}</div>
            <div>Response Status: {debugInfo.responseStatus || 'N/A'}</div>
            <div>Error: {debugInfo.error}</div>
          </div>
          <Link to="/friends" style={{
            color: '#3b82f6',
            marginTop: '1.5rem',
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '0.5rem'
          }}>
            ← Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  if (!user || !friendData) {
    return null;
  }

  const { friend, global, byGame } = friendData;
  const winRate = global.total_games > 0
    ? Math.round((global.user_wins / global.total_games) * 100)
    : 0;

  const allGames = [
    ...animes.map(a => ({ ...a, type: 'manga' })),
    ...games.map(g => ({ ...g, type: 'game' })),
    ...movies.map(m => ({ ...m, type: 'movie' })),
  ];

  return (
    <div className="friend-profile-container">
      <header className="friend-profile-header">
        <Link to="/friends" className="back-link">&larr; Retour à la liste</Link>
        <h1>Profil de {friend.username}</h1>
      </header>

      <div className="friend-profile-content">
        <div className="profile-card friend-user-info">
          <Avatar user={friend} size="xl" />
          <h2 className="friend-name">{friend.username}</h2>
        </div>

        <div className="profile-card versus-stats">
          <h3>Statistiques face-à-face</h3>

          <div className="versus-grid">
            <div className="versus-stat highlight">
              <span className="stat-value">{global.total_games || 0}</span>
              <span className="stat-label">Parties jouées</span>
            </div>
            <div className="versus-stat highlight">
              <span className="stat-value">{global.user_wins || 0} - {global.friend_wins || 0}</span>
              <span className="stat-label">Score</span>
            </div>
            <div className="versus-stat highlight">
              <span className="stat-value">{winRate}%</span>
              <span className="stat-label">Ton Win Rate</span>
            </div>
          </div>

          <div className="avg-attempts">
            <div className="avg-stat">
              <span className="avg-icon">🎯</span>
              <div className="avg-info">
                <span className="avg-value">{(Number(global.user_avg_attempts) || 0).toFixed(1)}</span>
                <span className="avg-label">Tes essais en moyenne</span>
              </div>
            </div>
            <div className="avg-stat">
              <span className="avg-icon">🎯</span>
              <div className="avg-info">
                <span className="avg-value">{(Number(global.friend_avg_attempts) || 0).toFixed(1)}</span>
                <span className="avg-label">Ses essais en moyenne</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-card game-stats">
          <h3>Stats par jeu</h3>
          {byGame.length === 0 ? (
            <p className="no-stats">Aucune donnée disponible</p>
          ) : (
            <div className="games-stats-list">
              {byGame.map(stat => {
                const game = allGames.find(g => g.id === stat.anime_id);
                if (!game) return null;

                const gameWinRate = stat.games_played > 0
                  ? Math.round((stat.user_wins / stat.games_played) * 100)
                  : 0;

                return (
                  <div key={stat.anime_id} className="game-stat-row">
                    <div className="game-info">
                      <span className="game-name">
                        {game.type === 'game' ? '🎮 ' : game.type === 'movie' ? '🎬 ' : '📚 '}
                        {game.name}
                      </span>
                      <span className="game-total">{stat.games_played} parties ensemble</span>
                    </div>
                    <div className="game-score">
                      <div className="score-box me">
                        <span className="score-label">Toi</span>
                        <span className="score-value">{stat.user_wins}</span>
                      </div>
                      <span className="score-separator">-</span>
                      <div className="score-box opponent">
                        <span className="score-label">{friend.username}</span>
                        <span className="score-value">{stat.friend_wins}</span>
                      </div>
                      <div className="game-winrate">
                        <span className="winrate-value">{gameWinRate}%</span>
                        <span className="winrate-label">Ton WR</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}