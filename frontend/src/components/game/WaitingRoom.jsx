export default function WaitingRoom({ position, onCancel, animeName }) {
  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <div className="waiting-spinner"></div>
        <h2 className="waiting-title">Recherche d'adversaire...</h2>
        <p className="waiting-anime">{animeName}</p>
        <p className="waiting-position">Position dans la file : {position}</p>
        <button onClick={onCancel} className="cancel-queue-btn">
          Annuler
        </button>
      </div>
    </div>
  );
}
