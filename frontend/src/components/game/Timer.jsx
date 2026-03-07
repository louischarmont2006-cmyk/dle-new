import { useState, useEffect, useRef } from 'react';
import './Timer.css';

export default function Timer({ startTime, duration, onExpire, gameOver = false }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const frozenTimeRef = useRef(null); // Mémoriser le temps au moment du game over

  useEffect(() => {
    if (!startTime || !duration) return;

    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [startTime, duration, onExpire]); // gameOver retiré des deps — ne pas relancer l'effet

  // Geler le temps affiché quand la partie se termine
  useEffect(() => {
    if (gameOver && frozenTimeRef.current === null) {
      frozenTimeRef.current = timeLeft;
    }
    if (!gameOver) {
      frozenTimeRef.current = null;
    }
  }, [gameOver, timeLeft]);

  const displayTime = gameOver && frozenTimeRef.current !== null ? frozenTimeRef.current : timeLeft;
  const minutes = Math.floor(displayTime / 60000);
  const seconds = Math.floor((displayTime % 60000) / 1000);
  const isLowTime = displayTime < 30000;

  return (
    <div className={`timer-display ${isLowTime && !gameOver ? 'low-time' : ''} ${gameOver ? 'game-over' : ''}`}>
      <div className="timer-icon">{gameOver ? '🏁' : '⏱️'}</div>
      <div className="timer-value">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
}