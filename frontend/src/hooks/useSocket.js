import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// URL EN DUR pour éviter les problèmes de variable d'environnement
const SOCKET_URL = 'https://dle-backend.up.railway.app';

export default function useSocket(token = null) {
  const socketRef = useRef(null);
  const tokenRef = useRef(token);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Reconnexion nécessaire quand le token change
  const [needsReconnect, setNeedsReconnect] = useState(false);

  // État du matchmaking
  const [inQueue, setInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueError, setQueueError] = useState(null);

  // État de la partie
  const [roomId, setRoomId] = useState(null);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [opponentId, setOpponentId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [opponentName, setOpponentName] = useState(null);

  // État des tentatives
  const [myAttempts, setMyAttempts] = useState([]);
  const [opponentAttempts, setOpponentAttempts] = useState([]);

  // État de fin de partie
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [target, setTarget] = useState(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

  // Scores de session
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  // Chat
  const [messages, setMessages] = useState([]);

  // État adversaire
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  // Socket ID comme état
  const [socketId, setSocketId] = useState(null);

  // ★ États pour les salons privés
  const [privateRoomCode, setPrivateRoomCode] = useState(null);
  const [privateRoomError, setPrivateRoomError] = useState(null);

  // ★ NOUVEAU - États pour le mode de jeu et timer
  const [gameMode, setGameMode] = useState(null); // 'turnbased' | 'simultaneous'
  const [timer, setTimer] = useState(null); // { startTime, duration }

  // Connexion au serveur
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const options = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      auth: {}
    };

    // Ajouter le token si disponible
    if (tokenRef.current) {
      options.auth.token = tokenRef.current;
    }

    socketRef.current = io(SOCKET_URL, options);

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

    // Matchmaking events
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

    // ★ Événements pour les salons privés
    socketRef.current.on('private-room-created', ({ code }) => {
      setPrivateRoomCode(code);
      setPrivateRoomError(null);
      console.log('Private room created:', code);
    });

    socketRef.current.on('private-room-error', ({ error }) => {
      setPrivateRoomError(error);
      console.error('Private room error:', error);
    });

    socketRef.current.on('private-room-cancelled', () => {
      setPrivateRoomCode(null);
      setPrivateRoomError(null);
      console.log('Private room cancelled');
    });

    socketRef.current.on('match-found', ({ roomId, isYourTurn, opponentId, gameData, playerName, opponentName, myScore, opponentScore, gameMode, timer }) => {
      setInQueue(false);
      setPrivateRoomCode(null); // ★ Reset salon privé
      setPrivateRoomError(null); // ★ Reset erreur salon privé
      setRoomId(roomId);
      setIsYourTurn(isYourTurn);
      setOpponentId(opponentId);
      setGameData(gameData);
      setPlayerName(playerName);
      setOpponentName(opponentName);
      setMyScore(myScore || 0);
      setOpponentScore(opponentScore || 0);
      setGameMode(gameMode || 'turnbased'); // ★ NOUVEAU
      setTimer(timer); // ★ NOUVEAU
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

    // Game events
    socketRef.current.on('guess-result', ({ attempt, isCorrect, isYourTurn }) => {
      setMyAttempts(prev => [attempt, ...prev]);
      if (!isCorrect) {
        setIsYourTurn(isYourTurn);
      }
    });

    socketRef.current.on('guess-error', ({ error }) => {
      console.error('Guess error:', error);
    });

    socketRef.current.on('opponent-guess', ({ attempt, isYourTurn }) => {
      setOpponentAttempts(prev => [attempt, ...prev]);
      setIsYourTurn(isYourTurn);
    });

    socketRef.current.on('game-over', ({ target, winnerId, myScore, opponentScore }) => {
      setGameOver(true);
      setWinner(winnerId);
      setTarget(target);
      if (myScore !== undefined) setMyScore(myScore);
      if (opponentScore !== undefined) setOpponentScore(opponentScore);
    });

    // Rematch events
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
      setTimer(timer); // ★ NOUVEAU - Réinitialiser le timer pour rematch
      if (myScore !== undefined) setMyScore(myScore);
      if (opponentScore !== undefined) setOpponentScore(opponentScore);
    });

    // ★ NOUVEAU - Événement timer expiré
    socketRef.current.on('timer-expired', ({ target, sessionScores }) => {
      setGameOver(true);
      setWinner(null); // Match nul
      setTarget(target);
      // Mettre à jour les scores si fournis
      if (sessionScores && socketId) {
        setMyScore(sessionScores[socketId] || myScore);
        const opId = Object.keys(sessionScores).find(id => id !== socketId);
        if (opId) setOpponentScore(sessionScores[opId] || opponentScore);
      }
    });

    // Chat events
    socketRef.current.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Opponent events
    socketRef.current.on('opponent-disconnected', () => {
      setOpponentDisconnected(true);
    });

    socketRef.current.on('opponent-left', () => {
      setOpponentLeft(true);
    });

    socketRef.current.on('room-left', () => {
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
    });
  }, []);

  // Mettre à jour la ref du token et marquer pour reconnexion si nécessaire
  useEffect(() => {
    const oldToken = tokenRef.current;
    tokenRef.current = token;

    // Si le token a changé et qu'on est connecté, déconnecter et marquer pour reconnexion
    if (oldToken !== token && socketRef.current) {
      console.log('Token changed, will reconnect socket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setNeedsReconnect(true);
    }
  }, [token]);

  // Reconnexion automatique après changement de token
  useEffect(() => {
    if (needsReconnect && !socketRef.current) {
      setNeedsReconnect(false);
      connect();
    }
  }, [needsReconnect, connect]);

  // Déconnexion du serveur
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setInQueue(false);
      setRoomId(null);
    }
  }, []);

  // ⭐ MODIFIÉ - Actions avec support de la catégorie et gameMode
  const joinQueue = useCallback((gameId, gameData, category = 'anime', gameMode = 'turnbased') => {
    if (socketRef.current?.connected) {
      console.log(`[useSocket] Joining queue: ${category}/${gameId} (${gameMode})`);
      socketRef.current.emit('join-queue', { 
        gameId,
        gameData, 
        category,
        gameMode, // ★ NOUVEAU
        animeId: gameId  // Rétrocompatibilité
      });
    }
  }, []);

  const leaveQueue = useCallback((gameId, category = 'anime') => {
    if (socketRef.current?.connected) {
      console.log(`[useSocket] Leaving queue: ${category}/${gameId}`);
      socketRef.current.emit('leave-queue', { 
        gameId,
        category,      // ⭐ NOUVEAU
        animeId: gameId  // Rétrocompatibilité
      });
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

  // ★ Fonctions pour les salons privés
  const createPrivateRoom = useCallback((gameId, gameData, category = 'anime', gameMode = 'turnbased') => {
    if (socketRef.current?.connected) {
      console.log(`[useSocket] Creating private room: ${category}/${gameId} (${gameMode})`);
      socketRef.current.emit('create-private-room', {
        gameId,
        gameData,
        category,
        gameMode // ★ NOUVEAU
      });
    }
  }, []);

  const joinPrivateRoom = useCallback((roomCode) => {
    if (socketRef.current?.connected) {
      console.log(`[useSocket] Joining private room: ${roomCode}`);
      setPrivateRoomError(null); // Reset error avant de tenter
      socketRef.current.emit('join-private-room', {
        roomCode: roomCode.toUpperCase()
      });
    }
  }, []);

  const cancelPrivateRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[useSocket] Cancelling private room');
      socketRef.current.emit('cancel-private-room');
      setPrivateRoomCode(null);
      setPrivateRoomError(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection
    connect,
    disconnect,
    isConnected,
    connectionError,
    socketId,

    // Queue
    joinQueue,
    leaveQueue,
    inQueue,
    queuePosition,
    queueError,

    // Room/Game
    roomId,
    isYourTurn,
    opponentId,
    gameData,
    playerName,
    opponentName,
    makeGuess,

    // Attempts
    myAttempts,
    opponentAttempts,

    // Game over
    gameOver,
    winner,
    target,

    // Session scores
    myScore,
    opponentScore,

    // Rematch
    requestRematch,
    rematchRequested,
    opponentWantsRematch,

    // Opponent status
    opponentDisconnected,
    opponentLeft,
    leaveRoom,

    // Chat
    messages,
    sendChatMessage,

    // ★ Private rooms
    createPrivateRoom,
    joinPrivateRoom,
    cancelPrivateRoom,
    privateRoomCode,
    privateRoomError,

    // ★ NOUVEAU - Game mode et timer
    gameMode,
    timer
  };
}