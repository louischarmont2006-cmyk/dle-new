import { API_URL } from '../api.js';
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import "./FriendProfile.css";

export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { user, token, loading } = useAuth();
  const [friendData, setFriendData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [animes, setAnimes] = useState([]);
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Charger les animes et jeux
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
    if (!token || !friendId) return;

    setLoadingData(true);
    fetch(`${API_URL}/api/friends/${friendId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setFriendData(data);
        setLoadingData(false);
      })
      .catch(() => {
        setLoadingData(false);
        navigate("/friends");
      });
  }, [token, friendId, navigate]);

  if (loading || loadingData) {
    return <div className="friend-profile-container"><div className="loading">Chargement...</div></div>;
  }

  if (!user || !friendData) {
    return null;
  }

  const { friend, global, byGame } = friendData;
  const winRate = global.total_games > 0 
    ? Math.round((global.user_wins / global.total_games) * 100) 
    : 0;

  // Fusionner animes et jeux pour l'affichage
  const allGames = [
    ...animes.map(a => ({ ...a, type: 'manga' })),
    ...games.map(g => ({ ...g, type: 'game' }))
  ];

  return (
    <div className="friend-profile-container">
      <header className="friend-profile-header">
        <Link to="/friends" className="back-link">&larr; Retour à la liste</Link>
        <h1>Profil de {friend.username}</h1>
      </header>

      <div className="friend-profile-content">
        {/* Carte utilisateur */}
        <div className="profile-card friend-user-info">
          <Avatar user={friend} size="xl" />
          <h2 className="friend-name">{friend.username}</h2>
          <p className="friend-email">{friend.email}</p>
        </div>

        {/* Stats globales entre vous deux */}
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
                <span className="avg-value">{(global.user_avg_attempts || 0).toFixed(1)}</span>
                <span className="avg-label">Tes essais en moyenne</span>
              </div>
            </div>
            <div className="avg-stat">
              <span className="avg-icon">🎯</span>
              <div className="avg-info">
                <span className="avg-value">{(global.friend_avg_attempts || 0).toFixed(1)}</span>
                <span className="avg-label">Ses essais en moyenne</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats par jeu */}
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
                        {game.type === 'game' ? '' : ''}
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