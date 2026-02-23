import { useState } from 'react';
import './JoinPrivateRoom.css';

export default function JoinPrivateRoom({ onJoin, onCancel, animeName, error }) {
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      onJoin(code.trim().toUpperCase());
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
    }
  };

  return (
    <div className="join-private-room">
      <div className="join-room-content">
        <h2 className="join-room-title">Rejoindre une partie</h2>
        <p className="join-room-anime">{animeName}</p>

        <form onSubmit={handleSubmit} className="join-room-form">
          <div className="code-input-container">
            <label htmlFor="room-code" className="code-label">
              Code du salon
            </label>
            <input
              type="text"
              id="room-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="ABC123"
              className="code-input"
              autoFocus
              maxLength={6}
            />
            <div className="code-hint">
              Entre le code à 6 caractères
            </div>
          </div>

          {error && (
            <div className="join-error">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="join-submit-btn"
            disabled={code.length !== 6}
          >
            Rejoindre
          </button>
        </form>

        <button onClick={onCancel} className="cancel-join-btn">
          Annuler
        </button>
      </div>
    </div>
  );
}