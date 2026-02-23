import { useState } from 'react';
import './CreatePrivateRoom.css';

export default function CreatePrivateRoom({ roomCode, onCancel, animeName }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="create-private-room">
      <div className="private-room-content">
        <div className="private-room-spinner"></div>
        <h2 className="private-room-title">Salon privé créé</h2>
        <p className="private-room-anime">{animeName}</p>
        
        <div className="room-code-display">
          <div className="room-code-label">Code du salon</div>
          <div className="room-code-value">{roomCode}</div>
          <button onClick={copyToClipboard} className="copy-code-btn">
            {copied ? '✓ Copié !' : '📋 Copier le code'}
          </button>
        </div>

        <p className="waiting-message">
          En attente d'un adversaire...
        </p>

        <button onClick={onCancel} className="cancel-private-btn">
          Annuler
        </button>
      </div>
    </div>
  );
}