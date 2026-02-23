import './GameModeSelector.css';

export default function GameModeSelector({ onSelectMode, onCancel, animeName }) {
  return (
    <div className="game-mode-selector">
      <div className="game-mode-content">
        <h2 className="game-mode-title">Choisis ton mode de jeu</h2>
        <p className="game-mode-anime">{animeName}</p>

        <div className="game-mode-options">
          <button 
            onClick={() => onSelectMode('turnbased')} 
            className="game-mode-option-btn turnbased"
          >
            <div className="game-mode-icon">🔄</div>
            <div className="game-mode-info">
              <h3>Chacun son tour</h3>
              <p>Jouez alternativement. Vous voyez les tentatives de l'adversaire.</p>
            </div>
          </button>

          <button 
            onClick={() => onSelectMode('simultaneous')} 
            className="game-mode-option-btn simultaneous"
          >
            <div className="game-mode-icon">⚡</div>
            <div className="game-mode-info">
              <h3>En même temps</h3>
              <p>Course contre la montre ! 3 minutes pour trouver en premier.</p>
            </div>
          </button>
        </div>

        <button onClick={onCancel} className="cancel-game-mode-btn">
          Annuler
        </button>
      </div>
    </div>
  );
}