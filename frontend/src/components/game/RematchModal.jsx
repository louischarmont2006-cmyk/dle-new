import { API_URL } from '../../api.js';
export default function RematchModal({
  isWinner,
  target,
  myAttempts,
  opponentAttempts,
  onRematch,
  onLeave,
  rematchRequested,
  opponentWantsRematch,
  opponentDisconnected,
  opponentLeft,
  gameId,
  playerName,
  opponentName,
  myScore,
  opponentScore,
  category = 'anime', // ⭐ NOUVEAU - catégorie du jeu
  gameMode = 'turnbased' // ★ NOUVEAU - mode de jeu
}) {
  const opponentGone = opponentDisconnected || opponentLeft;

  // ⭐ NOUVEAU - Construire le bon chemin d'image selon la catégorie
  const imagePath = category === 'game'
    ? `${API_URL}/api/images/games/${gameId}/characters/${target?.image}`
    : `${API_URL}/api/images/${gameId}/characters/${target?.image}`;

  // ★ NOUVEAU - Déterminer le résultat en mode simultané (match nul si pas de winner)
  const isDrawMatch = gameMode === 'simultaneous' && !isWinner && myScore === opponentScore;

  return (
    <div className="rematch-modal-overlay">
      <div className="rematch-modal">
        <div className={`rematch-result ${isDrawMatch ? 'draw' : (isWinner ? 'win' : 'lose')}`}>
          {isDrawMatch 
            ? 'Match nul !' 
            : (isWinner 
                ? (myAttempts === 1 ? 'ONE Shot !!! Victoire !' : 'Victoire !') 
                : 'Défaite...'
              )
          }
        </div>

        {/* ★ NOUVEAU - Message selon le mode */}
        {gameMode === 'simultaneous' && (
          <div className="game-mode-info">
            ⚡ Mode simultané - {isDrawMatch ? 'Temps écoulé !' : 'Premier à trouver gagne !'}
          </div>
        )}

        {/* Score de la série */}
        <div className="series-score">
          <span className="series-player me">{playerName || 'Toi'}</span>
          <span className="series-numbers">
            <span className="score me">{myScore}</span>
            <span className="separator">-</span>
            <span className="score opponent">{opponentScore}</span>
          </span>
          <span className="series-player opponent">{opponentName || 'Adversaire'}</span>
        </div>

        <div className="rematch-target">
          <p>Le personnage était :</p>
          <div className="target-character">
            <img src={imagePath} alt={target?.name} />
            <span>{target?.name}</span>
          </div>
        </div>

        <div className="rematch-stats">
          <div className="stat-item">
            <span className="stat-label">Tes essais</span>
            <span className="stat-value">{myAttempts}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Essais adversaire</span>
            <span className="stat-value">{opponentAttempts}</span>
          </div>
        </div>

        {opponentGone ? (
          <div className="opponent-gone">
            <p>{opponentDisconnected ? "L'adversaire s'est deconnecte" : "L'adversaire a quitte"}</p>
            <button onClick={onLeave} className="leave-btn">
              Retour
            </button>
          </div>
        ) : (
          <div className="rematch-actions">
            {opponentWantsRematch && !rematchRequested && (
              <p className="rematch-notification">L'adversaire veut une revanche !</p>
            )}

            {rematchRequested ? (
              <p className="rematch-waiting">En attente de l'adversaire...</p>
            ) : (
              <button onClick={onRematch} className="rematch-btn">
                {opponentWantsRematch ? 'Accepter la revanche' : 'Demander revanche'}
              </button>
            )}

            <button onClick={onLeave} className="leave-btn">
              Quitter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}