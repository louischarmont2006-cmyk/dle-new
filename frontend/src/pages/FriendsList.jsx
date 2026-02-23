import { API_URL } from '../api.js';
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import "./FriendsList.css";

export default function FriendsList() {
  const navigate = useNavigate();
  const { user, token, loading } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!token) return;

    setLoadingFriends(true);
    fetch(`${API_URL}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setFriends(data);
        setLoadingFriends(false);
      })
      .catch(() => setLoadingFriends(false));
  }, [token]);

  if (loading) {
    return <div className="friends-container"><div className="loading">Chargement...</div></div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="friends-container">
      <header className="friends-header">
        <Link to="/profile" className="back-link">&larr; Retour au profil</Link>
        <h1>Liste d'amis</h1>
      </header>

      <div className="friends-content">
        {loadingFriends ? (
          <div className="loading">Chargement...</div>
        ) : friends.length === 0 ? (
          <div className="no-friends">
            <p>Tu n'as encore joué avec personne en mode Duo.</p>
            <p>Lance une partie duo pour commencer à construire ta liste d'amis !</p>
          </div>
        ) : (
          <div className="friends-list">
            {friends.map(friend => {
              const winRate = friend.games_played > 0 
                ? Math.round((friend.my_wins / friend.games_played) * 100) 
                : 0;
              const lastPlayed = new Date(friend.last_played).toLocaleDateString('fr-FR');

              return (
                <Link 
                  key={friend.id} 
                  to={`/friend/${friend.id}`}
                  className="friend-card"
                >
                  <div className="friend-avatar">
                    <Avatar user={friend} size="lg" />
                  </div>

                  <div className="friend-info">
                    <h3 className="friend-username">{friend.username}</h3>
                    <p className="friend-last-played">Dernière partie : {lastPlayed}</p>
                  </div>

                  <div className="friend-stats">
                    <div className="friend-stat">
                      <span className="stat-value">{friend.games_played}</span>
                      <span className="stat-label">Parties</span>
                    </div>
                    <div className="friend-stat">
                      <span className="stat-value">{friend.my_wins}-{friend.their_wins}</span>
                      <span className="stat-label">Score</span>
                    </div>
                    <div className="friend-stat">
                      <span className="stat-value">{winRate}%</span>
                      <span className="stat-label">Win Rate</span>
                    </div>
                  </div>

                  <div className="friend-arrow">→</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}