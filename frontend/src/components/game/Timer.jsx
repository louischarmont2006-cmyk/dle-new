import { useState, useEffect } from 'react';
import './Timer.css';

export default function Timer({ startTime, duration, onExpire, gameOver = false }) { // ★ NOUVEAU - gameOver prop
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!startTime || !duration || gameOver) return; // ★ NOUVEAU - Arrêter si gameOver

    // Calculer le temps restant basé sur le temps de démarrage du serveur
    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    // Mise à jour immédiate
    updateTimer();

    // Mise à jour toutes les 100ms pour une précision fluide
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [startTime, duration, onExpire, gameOver]); // ★ NOUVEAU - Ajouter gameOver dans deps

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isLowTime = timeLeft < 30000; // Moins de 30 secondes

  return (
    <div className={`timer-display ${isLowTime && !gameOver ? 'low-time' : ''} ${gameOver ? 'game-over' : ''}`}>
      <div className="timer-icon">{gameOver ? '🏁' : '⏱️'}</div>
      <div className="timer-value">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
}