import { API_URL } from '../api.js';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Avatar from '../components/Avatar';
import './Leaderboard.css';

const TABS = ['Total', 'Solo', 'Duo'];

function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-emoji">🥇</span>;
  if (rank === 2) return <span className="rank-emoji">🥈</span>;
  if (rank === 3) return <span className="rank-emoji">🥉</span>;
  return <span className="rank-number">#{rank}</span>;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('Total');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/stats/leaderboard`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => {
        if (!r.ok) throw new Error('Erreur réseau');
        return r.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError('Impossible de charger le classement.');
        setLoading(false);
      });
  }, [token]);

  const tabKey = activeTab.toLowerCase();

  const sorted = [...data]
    .filter(p => p[tabKey].played > 0)
    .sort((a, b) => {
      if (b[tabKey].wins !== a[tabKey].wins) return b[tabKey].wins - a[tabKey].wins;
      return b[tabKey].winRate - a[tabKey].winRate;
    });

  return (
    <div className="leaderboard-container">
      <header className="leaderboard-header">
        <button onClick={() => navigate('/profile')} className="back-link">
          ← Retour au profil
        </button>
        <h1>🏆 Classement</h1>
      </header>

      {/* Tabs */}
      <div className="leaderboard-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`leaderboard-tab ${activeTab === tab ? `active active-${tab.toLowerCase()}` : ''}`}
          >
            {tab === 'Solo' ? '🎮 Solo' : tab === 'Duo' ? '⚔️ Duo' : '🌐 Total'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="leaderboard-content">
        {loading && (
          <div className="leaderboard-loading">Chargement...</div>
        )}

        {error && (
          <div className="leaderboard-error">{error}</div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="leaderboard-empty">
            Aucun joueur n'a encore joué en mode {activeTab.toLowerCase()}.
          </div>
        )}

        {!loading && !error && sorted.map((player, i) => {
          const stats = player[tabKey];
          const rank = i + 1;
          return (
            <div
              key={player.id}
              className={`leaderboard-row ${rank <= 3 ? `top-${rank}` : ''}`}
              onClick={() => navigate(`/player/${player.id}`)}
            >
              <div className="row-rank">
                <RankBadge rank={rank} />
              </div>

              <div className="row-avatar">
                <Avatar user={{
                  username: player.username,
                  avatar_color: player.avatarColor,
                  avatar_image: player.avatarImage
                }} size="md" />
              </div>

              <div className="row-username">{player.username}</div>

              <div className="row-stats">
                <div className="row-stat">
                  <span className="row-stat-value blue">{stats.played}</span>
                  <span className="row-stat-label">Parties</span>
                </div>
                <div className="row-stat">
                  <span className="row-stat-value green">{stats.wins}</span>
                  <span className="row-stat-label">Victoires</span>
                </div>
                <div className="row-stat winrate-box">
                  <span className="row-stat-value purple">{stats.winRate}%</span>
                  <span className="row-stat-label">Win Rate</span>
                </div>
              </div>

              <div className="row-arrow">→</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}