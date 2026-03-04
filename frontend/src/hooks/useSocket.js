import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
)
  ? 'http://localhost:3000'
  : 'https://dle-backend.up.railway.app';

// Singleton — le socket persiste entre les navigations
let globalSocket = null;

export default function useSocket(token = null) {
  const socketRef = useRef(null);
  const tokenRef = useRef(token);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const [inQueue, setInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueError, setQueueError] = useState(null);

  const [roomId, setRoomId] = useState(null);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [opponentId, setOpponentId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [opponentName, setOpponentName] = useState(null);

  const [myAttempts, setMyAttempts] = useState([]);
  const [opponentAttempts, setOpponentAttempts] = useState([]);

  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [target, setTarget] = useState(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  const [messages, setMessages] = useState([]);

  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const [socketId, setSocketId] = useState(null);

  const [privateRoomCode, setPrivateRoomCode] = useState(null);
  const [privateRoomError, setPrivateRoomError] = useState(null);

  const [gameMode, setGameMode] = useState(null);
  const [timer, setTimer] = useState(null);

  // ✅ BUG 1 FIX — Fonction pour réinitialiser tout l'état de jeu
  const resetGameState = useCallback(() => {
    setInQueue(false);
    setQueuePosition(0);
    setQueueError(null);
    setRoomId(null);
    setIsYourTurn(false);
    setOpponentId(null);
    setGameData(null);
    setPlayerName(null);
    setOpponentName(null);
    setMyAttempts([]);
    setOpponentAttempts([]);
    setGameOver(false);
    setWinner(null);
    setTarget(null);
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    setMyScore(0);
    setOpponentScore(0);
    setMessages([]);
    setOpponentDisconnected(false);
    setOpponentLeft(false);
    setPrivateRoomCode(null);
    setPrivateRoomError(null);
    setGameMode(null);
    setTimer(null);
  }, []);

  const connect = useCallback(() => {
    // Réutiliser le socket global s'il existe déjà ET est connecté
    if (globalSocket && globalSocket.connected) {
      socketRef.current = globalSocket;
      setIsConnected(true);
      setSocketId(globalSocket.id);
      return;
    }

    // ✅ BUG 1 FIX — Si le socket global existe mais est déconnecté, le nettoyer
    if (globalSocket && !globalSocket.connected) {
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
    }

    const options = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      auth: {}
    };

    if (tokenRef.current) {
      options.auth.token = tokenRef.current;
    }

    socketRef.current = io(SOCKET_URL, options);
    globalSocket = socketRef.current;

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      setSocketId(socketRef.current?.id || null);
      console.log('Connected to server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      setSocketId(null);
      console.log('Disconnected from server');
    });

    socketRef.current.on('connect_error', (error) => {
      setConnectionError(error.message);
      console.error('Connection error:', error);
    });

    socketRef.current.on('queue-joined', ({ position }) => {
      setInQueue(true);
      setQueuePosition(position);
      setQueueError(null);
    });

    socketRef.current.on('queue-left', () => {
      setInQueue(false);
      setQueuePosition(0);
    });

    socketRef.current.on('queue-error', ({ error }) => {
      setQueueError(error);
      setInQueue(false);
    });

    socketRef.current.on('private-room-created', ({ code }) => {
      setPrivateRoomCode(code);
      setPrivateRoomError(null);
    });

    socketRef.current.on('private-room-error', ({ error }) => {
      setPrivateRoomError(error);
    });

    socketRef.current.on('private-room-cancelled', () => {
      setPrivateRoomCode(null);
      setPrivateRoomError(null);
    });

    socketRef.current.on('match-found', ({ roomId, isYourTurn, opponentId, gameData, playerName, opponentName, myScore, opponentScore, gameMode, timer }) => {
      // ✅ BUG 1 FIX — Réinitialiser TOUT l'état de jeu avant de démarrer une nouvelle partie
      setInQueue(false);
      setPrivateRoomCode(null);
      setPrivateRoomError(null);
      setRoomId(roomId);
      setIsYourTurn(isYourTurn);
      setOpponentId(opponentId);
      setGameData(gameData);
      setPlayerName(playerName);
      setOpponentName(opponentName);
      setMyScore(myScore || 0);
      setOpponentScore(opponentScore || 0);
      setGameMode(gameMode || 'turnbased');
      setTimer(timer);
      // Réinitialiser complètement les données de la partie précédente
      setMyAttempts([]);
      setOpponentAttempts([]);
      setMessages([]);
      setGameOver(false);
      setWinner(null);
      setTarget(null);
      setRematchRequested(false);
      setOpponentWantsRematch(false);
      setOpponentDisconnected(false);
      setOpponentLeft(false);
    });

    socketRef.current.on('guess-result', ({ attempt, isCorrect, isYourTurn }) => {
      setMyAttempts(prev => [attempt, ...prev]);
      if (!isCorrect) {
        setIsYourTurn(isYourTurn);
      }
    });

    socketRef.current.on('guess-error', ({ error }) => {
      console.error('Guess error:', error);
    });

    // ✅ BUG 2 FIX — opponent-guess : toujours remplacer les placeholders par le vrai essai
    socketRef.current.on('opponent-guess', ({ attempt, isYourTurn }) => {
      setOpponentAttempts(prev => {
        // Retirer le premier placeholder s'il existe (créé par opponent-attempt-update)
        // et le remplacer par le vrai attempt
        const withoutFirstPlaceholder = prev.filter((a, i) => {
          if (i === 0 && String(a.guess?.id).startsWith('placeholder-')) return false;
          return true;
        });
        return [attempt, ...withoutFirstPlaceholder];
      });
      setIsYourTurn(isYourTurn);
    });

    // ✅ BUG 2 FIX — opponent-attempt-update : ne créer un placeholder QUE si on n'a pas déjà le vrai attempt
    socketRef.current.on('opponent-attempt-update', ({ attempts }) => {
      setOpponentAttempts(prev => {
        // En mode turnbased, opponent-guess arrive aussi — ne pas interférer avec les vrais attempts
        // Compter les vrais attempts (non-placeholders)
        const realAttempts = prev.filter(a => !String(a.guess?.id).startsWith('placeholder-'));
        
        // Si on a déjà autant de vrais attempts que le total annoncé, ignorer
        if (realAttempts.length >= attempts) return prev;

        // Sinon reconstruire : vrais attempts + placeholders pour le reste
        const placeholderCount = attempts - realAttempts.length;
        const newPlaceholders = Array.from({ length: placeholderCount }, (_, i) => ({
          guess: { id: `placeholder-${realAttempts.length + i}`, name: '???' },
          feedback: {}
        }));

        return [...newPlaceholders, ...realAttempts];
      });
    });

    socketRef.current.on('game-over', ({ target, winnerId, myScore, opponentScore, winnerAttempts, loserAttempts }) => {
      setGameOver(true);
      setWinner(winnerId);
      setTarget(target);
      if (myScore !== undefined) setMyScore(myScore);
      if (opponentScore !== undefined) setOpponentScore(opponentScore);

      const currentSocketId = socketRef.current?.id;
      if (winnerAttempts !== undefined && loserAttempts !== undefined) {
        const iAmWinner = winnerId === currentSocketId;
        const opponentCount = iAmWinner ? loserAttempts : winnerAttempts;
        setOpponentAttempts(prev => {
          // Seulement remplacer si on n'a que des placeholders (mode simultané)
          const hasOnlyPlaceholders = prev.every(a => String(a.guess?.id).startsWith('placeholder-'));
          if (hasOnlyPlaceholders || prev.length === 0) {
            return Array.from({ length: opponentCount }, (_, i) => ({
              guess: { id: `placeholder-${i}`, name: '???' },
              feedback: {}
            }));
          }
          return prev;
        });
      }
    });

    socketRef.current.on('rematch-requested', () => {
      setOpponentWantsRematch(true);
    });

    socketRef.current.on('rematch-vote-registered', () => {
      setRematchRequested(true);
    });

    socketRef.current.on('rematch-starting', ({ isYourTurn, myScore, opponentScore, timer }) => {
      setMyAttempts([]);
      setOpponentAttempts([]);
      setGameOver(false);
      setWinner(null);
      setTarget(null);
      setIsYourTurn(isYourTurn);
      setRematchRequested(false);
      setOpponentWantsRematch(false);
      setTimer(timer);
      if (myScore !== undefined) setMyScore(myScore);
      if (opponentScore !== undefined) setOpponentScore(opponentScore);
    });

    socketRef.current.on('timer-expired', ({ target, sessionScores }) => {
      setGameOver(true);
      setWinner(null);
      setTarget(target);
      if (sessionScores) {
        const currentSocketId = socketRef.current?.id;
        if (currentSocketId) {
          setMyScore(sessionScores[currentSocketId] ?? 0);
          const opId = Object.keys(sessionScores).find(id => id !== currentSocketId);
          if (opId) setOpponentScore(sessionScores[opId] ?? 0);
        }
      }
    });

    socketRef.current.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socketRef.current.on('opponent-disconnected', () => {
      setOpponentDisconnected(true);
    });

    socketRef.current.on('opponent-left', () => {
      setOpponentLeft(true);
    });

    socketRef.current.on('room-left', () => {
      // ✅ BUG 1 FIX — Réinitialiser tout l'état de jeu proprement
      setRoomId(null);
      setIsYourTurn(false);
      setOpponentId(null);
      setGameData(null);
      setMyAttempts([]);
      setOpponentAttempts([]);
      setMessages([]);
      setGameOver(false);
      setWinner(null);
      setTarget(null);
      setRematchRequested(false);
      setOpponentWantsRematch(false);
      setOpponentDisconnected(false);
      setOpponentLeft(false);
      setGameMode(null);
      setTimer(null);
      setMyScore(0);
      setOpponentScore(0);
      setInQueue(false);
      setPrivateRoomCode(null);
      setPrivateRoomError(null);
    });
  }, []);

  useEffect(() => {
    const oldToken = tokenRef.current;
    tokenRef.current = token;

    if (oldToken !== token && socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      globalSocket = null;
      setIsConnected(false);
      setNeedsReconnect(true);
    }
  }, [token]);

  useEffect(() => {
    if (needsReconnect && !socketRef.current) {
      setNeedsReconnect(false);
      connect();
    }
  }, [needsReconnect, connect]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      globalSocket = null;
      setIsConnected(false);
      setSocketId(null);
      resetGameState();
    }
  }, [resetGameState]);

  const joinQueue = useCallback((gameId, gameData, category = 'anime', gameMode = 'turnbased') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-queue', { gameId, gameData, category, gameMode, animeId: gameId });
    }
  }, []);

  const leaveQueue = useCallback((gameId, category = 'anime') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-queue', { gameId, category, animeId: gameId });
    }
  }, []);

  const makeGuess = useCallback((character) => {
    if (socketRef.current?.connected && roomId) {
      socketRef.current.emit('make-guess', { roomId, character });
    }
  }, [roomId]);

  const requestRematch = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-rematch');
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room');
    }
  }, []);

  const sendChatMessage = useCallback((text) => {
    if (socketRef.current?.connected && text && text.trim()) {
      socketRef.current.emit('send-chat', { text: text.trim() });
    }
  }, []);

  const createPrivateRoom = useCallback((gameId, gameData, category = 'anime', gameMode = 'turnbased') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('create-private-room', { gameId, gameData, category, gameMode });
    }
  }, []);

  const joinPrivateRoom = useCallback((roomCode, gameId) => {
    if (socketRef.current?.connected) {
      setPrivateRoomError(null);
      socketRef.current.emit('join-private-room', { roomCode: roomCode.toUpperCase(), gameId });
    }
  }, []);

  const cancelPrivateRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cancel-private-room');
      setPrivateRoomCode(null);
      setPrivateRoomError(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Ne pas déconnecter au simple démontage du composant
      // Le socket reste actif pour survivre aux navigations
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connect, disconnect, isConnected, connectionError, socketId,
    joinQueue, leaveQueue, inQueue, queuePosition, queueError,
    roomId, isYourTurn, opponentId, gameData, playerName, opponentName, makeGuess,
    myAttempts, opponentAttempts,
    gameOver, winner, target,
    myScore, opponentScore,
    requestRematch, rematchRequested, opponentWantsRematch,
    opponentDisconnected, opponentLeft, leaveRoom,
    messages, sendChatMessage,
    createPrivateRoom, joinPrivateRoom, cancelPrivateRoom, privateRoomCode, privateRoomError,
    gameMode, timer,
    resetGameState
  };
}