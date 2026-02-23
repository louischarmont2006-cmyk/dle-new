import './DuoModeSelector.css';

export default function DuoModeSelector({ onSelectMode, onCancel, animeName }) {
  return (
    <div className="duo-mode-selector">
      <div className="selector-content">
        <h2 className="selector-title">Mode Duo</h2>
        <p className="selector-anime">{animeName}</p>

        <div className="mode-options">
          <button 
            onClick={() => onSelectMode('matchmaking')} 
            className="mode-option-btn matchmaking"
          >
            <div className="mode-icon">🎮</div>
            <div className="mode-info">
              <h3>Trouver une partie</h3>
              <p>Matchmaking rapide avec un joueur aléatoire</p>
            </div>
          </button>

          <button 
            onClick={() => onSelectMode('create-private')} 
            className="mode-option-btn create-private"
          >
            <div className="mode-icon">🔒</div>
            <div className="mode-info">
              <h3>Créer une partie</h3>
              <p>Crée un salon privé avec un code</p>
            </div>
          </button>

          <button 
            onClick={() => onSelectMode('join-private')} 
            className="mode-option-btn join-private"
          >
            <div className="mode-icon">🔑</div>
            <div className="mode-info">
              <h3>Rejoindre une partie</h3>
              <p>Entre le code d'un salon privé</p>
            </div>
          </button>
        </div>

        <button onClick={onCancel} className="cancel-selector-btn">
          Annuler
        </button>
      </div>
    </div>
  );
}