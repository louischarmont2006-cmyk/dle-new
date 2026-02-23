export default function TurnIndicator({ isYourTurn, gameOver }) {
  if (gameOver) return null;

  return (
    <div className={`turn-indicator ${isYourTurn ? 'your-turn' : 'opponent-turn'}`}>
      <div className="turn-dot"></div>
      <span className="turn-text">
        {isYourTurn ? "C'est ton tour !" : "Tour de l'adversaire..."}
      </span>
    </div>
  );
}
