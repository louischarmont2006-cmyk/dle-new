const GameManager = require('./gameManager');
const { verifyToken } = require('../auth/authUtils');
const { findUserById, recordDuoMatch } = require('../db/database');

function setupSocketHandlers(io) {
  const gameManager = new GameManager();

  // ★ NOUVEAU - Helper pour démarrer le timer et enregistrer le match à l'expiration
  function startTimerForRoom(roomId, room) {
    if (room.gameMode === 'simultaneous' && room.timer) {
      room.timer.timeoutId = setTimeout(() => {
        const timerResult = gameManager.handleTimerExpired(roomId);
        if (timerResult) {
          // Enregistrer le match nul
          const playerIds = Object.keys(room.players);
          const player1Id = playerIds[0];
          const player2Id = playerIds[1];
          const player1 = room.players[player1Id];
          const player2 = room.players[player2Id];

          if (player1.user?.userId && player2.user?.userId) {
            recordDuoMatch(
              player1.user.userId,
              player2.user.userId,
              room.gameId,
              null, // Match nul
              player1.attempts.length,
              player2.attempts.length,
              room.gameMode || 'simultaneous'
            );
          }

          io.to(roomId).emit('timer-expired', {
            target: timerResult.target,
            sessionScores: timerResult.sessionScores
          });
        }
      }, room.timer.duration);
    }
  }

  // Middleware pour authentifier les connexions Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        socket.user = verifyToken(token);
      } catch (err) {
        socket.user = null;
      }
    } else {
      socket.user = null;
    }
    next();
  });

  io.on('connection', (socket) => {
    const username = socket.user?.username || `Joueur`;
    console.log(`Player connected: ${socket.id} (${username})`);

    // ⭐ VERSION MISE À JOUR - Support animes ET jeux vidéo
    // Rejoindre la queue de matchmaking avec catégorie
    socket.on('join-queue', ({ animeId, gameId, gameData, category, gameMode }) => {
      // Pour compatibilité : si animeId est fourni, c'est un anime
      const finalGameId = gameId || animeId;
      const finalCategory = category || 'anime';
      const finalGameMode = gameMode || 'turnbased'; // ★ NOUVEAU
      
      console.log(`${socket.id} joining queue for ${finalCategory}/${finalGameId} (${finalGameMode})`);

      // Vérifier que l'utilisateur est connecté et a vérifié son email
      if (!socket.user) {
        socket.emit('queue-error', { error: 'Tu dois être connecté pour jouer en duo' });
        return;
      }

      const dbUser = findUserById(socket.user.userId);
      if (!dbUser || !dbUser.email_verified) {
        socket.emit('queue-error', { error: 'Tu dois vérifier ton email pour jouer en duo' });
        return;
      }

      const result = gameManager.joinQueue(socket, finalGameId, gameData, socket.user, finalCategory, finalGameMode); // ★ Passer gameMode

      if (result.status === 'already-in-game') {
        socket.emit('queue-error', { error: 'Tu es déjà dans une partie en cours' });
        return;
      } else if (result.status === 'already-in-queue') {
        socket.emit('queue-error', { error: 'Tu es déjà en recherche de partie' });
        return;
      } else if (result.status === 'queue-joined') {
        socket.emit('queue-joined', { position: result.position });
      } else if (result.status === 'match-found') {
        const { roomId, room, players } = result;

        // ★ NOUVEAU - Démarrer le timer en mode simultané
        startTimerForRoom(roomId, room);

        // Faire rejoindre les deux joueurs dans la room Socket.IO
        players.forEach((playerSocket, index) => {
          playerSocket.join(roomId);
          const isFirstTurn = room.currentTurn === playerSocket.id;
          const opponentId = players.find(p => p.id !== playerSocket.id)?.id;

          playerSocket.emit('match-found', {
            roomId,
            isYourTurn: isFirstTurn,
            opponentId,
            gameData: room.gameData,
            category: room.category,
            gameId: room.gameId,
            gameMode: room.gameMode, // ★ NOUVEAU
            maxAttempts: room.gameData.maxAttempts || 26,
            playerName: room.players[playerSocket.id].username,
            opponentName: room.players[opponentId].username,
            myScore: room.sessionScores[playerSocket.id],
            opponentScore: room.sessionScores[opponentId],
            // ★ NOUVEAU - Envoyer les infos du timer
            timer: room.timer ? {
              startTime: room.timer.startTime,
              duration: room.timer.duration
            } : null
          });
        });

        console.log(`Match created: ${roomId} (${room.category}/${room.gameId}) [${room.gameMode}]`);
      }
    });

    // Quitter la queue
    socket.on('leave-queue', ({ animeId, gameId, category }) => {
      const finalGameId = gameId || animeId;
      const finalCategory = category || 'anime';
      
      gameManager.leaveQueue(socket, finalGameId, finalCategory);
      socket.emit('queue-left');
      console.log(`${socket.id} left queue for ${finalCategory}/${finalGameId}`);
    });

    // ★ SALONS PRIVÉS - Créer un salon privé
    socket.on('create-private-room', ({ gameId, gameData, category, gameMode }) => {
      const finalCategory = category || 'anime';
      const finalGameMode = gameMode || 'turnbased'; // ★ NOUVEAU
      
      console.log(`${socket.id} creating private room for ${finalCategory}/${gameId} (${finalGameMode})`);

      // Vérifier que l'utilisateur est connecté et a vérifié son email
      if (!socket.user) {
        socket.emit('private-room-error', { error: 'Tu dois être connecté pour créer un salon privé' });
        return;
      }

      const dbUser = findUserById(socket.user.userId);
      if (!dbUser || !dbUser.email_verified) {
        socket.emit('private-room-error', { error: 'Tu dois vérifier ton email pour créer un salon privé' });
        return;
      }

      const result = gameManager.createPrivateRoom(socket, gameId, gameData, socket.user, finalCategory, finalGameMode); // ★ Passer gameMode

      if (result.status === 'already-in-game') {
        socket.emit('private-room-error', { error: 'Tu es déjà dans une partie en cours' });
        return;
      } else if (result.status === 'already-in-queue') {
        socket.emit('private-room-error', { error: 'Tu es déjà en recherche de partie' });
        return;
      } else if (result.status === 'already-hosting') {
        socket.emit('private-room-error', { error: 'Tu héberges déjà un salon privé' });
        return;
      } else if (result.status === 'private-room-created') {
        socket.emit('private-room-created', { code: result.code });
        console.log(`Private room created with code: ${result.code}`);
      }
    });

    // ★ SALONS PRIVÉS - Rejoindre un salon privé
    socket.on('join-private-room', ({ roomCode }) => {
      console.log(`${socket.id} trying to join private room: ${roomCode}`);

      // Vérifier que l'utilisateur est connecté et a vérifié son email
      if (!socket.user) {
        socket.emit('private-room-error', { error: 'Tu dois être connecté pour rejoindre un salon privé' });
        return;
      }

      const dbUser = findUserById(socket.user.userId);
      if (!dbUser || !dbUser.email_verified) {
        socket.emit('private-room-error', { error: 'Tu dois vérifier ton email pour rejoindre un salon privé' });
        return;
      }

      const result = gameManager.joinPrivateRoom(socket, roomCode, socket.user);

      if (result.status === 'room-not-found') {
        socket.emit('private-room-error', { error: 'Code de salon invalide' });
        return;
      } else if (result.status === 'already-in-game') {
        socket.emit('private-room-error', { error: 'Tu es déjà dans une partie en cours' });
        return;
      } else if (result.status === 'already-in-queue') {
        socket.emit('private-room-error', { error: 'Tu es déjà en recherche de partie' });
        return;
      } else if (result.status === 'cannot-join-own-room') {
        socket.emit('private-room-error', { error: 'Tu ne peux pas rejoindre ton propre salon' });
        return;
      } else if (result.status === 'match-found') {
        const { roomId, room, players } = result;

        // ★ NOUVEAU - Démarrer le timer en mode simultané
        startTimerForRoom(roomId, room);

        // Faire rejoindre les deux joueurs dans la room Socket.IO
        players.forEach((playerSocket) => {
          playerSocket.join(roomId);
          const isFirstTurn = room.currentTurn === playerSocket.id;
          const opponentId = players.find(p => p.id !== playerSocket.id)?.id;

          playerSocket.emit('match-found', {
            roomId,
            isYourTurn: isFirstTurn,
            opponentId,
            gameData: room.gameData,
            category: room.category,
            gameId: room.gameId,
            gameMode: room.gameMode, // ★ NOUVEAU
            maxAttempts: room.gameData.maxAttempts || 26,
            playerName: room.players[playerSocket.id].username,
            opponentName: room.players[opponentId].username,
            myScore: room.sessionScores[playerSocket.id],
            opponentScore: room.sessionScores[opponentId],
            // ★ NOUVEAU - Envoyer les infos du timer
            timer: room.timer ? {
              startTime: room.timer.startTime,
              duration: room.timer.duration
            } : null
          });
        });

        console.log(`Private match started: ${roomId} [${room.gameMode}]`);
      }
    });

    // ★ SALONS PRIVÉS - Annuler un salon privé
    socket.on('cancel-private-room', () => {
      const result = gameManager.cancelPrivateRoom(socket);
      if (result.status === 'private-room-cancelled') {
        socket.emit('private-room-cancelled');
        console.log(`${socket.id} cancelled their private room`);
      }
    });

    // Faire un guess
    socket.on('make-guess', ({ roomId, character }) => {
      const result = gameManager.makeGuess(socket, roomId, character);

      if (result.error) {
        socket.emit('guess-error', { error: result.error });
        return;
      }

      const room = gameManager.getPlayerRoom(socket.id);
      const opponentId = gameManager.getOpponentId(room, socket.id);

      if (result.status === 'game-over') {
        // Envoyer le résultat au joueur qui a deviné
        socket.emit('guess-result', {
          attempt: result.attempt,
          isCorrect: true
        });

        // ★ NOUVEAU - Enregistrer le match duo dans la base de données
        const playerIds = Object.keys(room.players);
        const player1Id = playerIds[0];
        const player2Id = playerIds[1];
        const player1 = room.players[player1Id];
        const player2 = room.players[player2Id];

        if (player1.user?.userId && player2.user?.userId) {
          const { recordDuoMatch } = require('../db/database');
          recordDuoMatch(
            player1.user.userId,
            player2.user.userId,
            room.gameId,
            result.winner ? room.players[result.winner].user?.userId : null,
            player1.attempts.length,
            player2.attempts.length,
            room.gameMode || 'turnbased'
          );
        }

        // Annoncer la fin de partie à chaque joueur avec ses scores
        playerIds.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            const opId = playerIds.find(id => id !== playerId);
            playerSocket.emit('game-over', {
              winner: result.winner,
              target: result.target,
              winnerId: socket.id,
              myScore: room.sessionScores[playerId],
              opponentScore: room.sessionScores[opId],
              gameMode: room.gameMode // ★ NOUVEAU
            });
          }
        });

        console.log(`Game over in ${roomId}, winner: ${socket.id} [${room.gameMode}]`);
      } else {
        // ★ MODIFIÉ - Comportement selon le mode
        if (room.gameMode === 'simultaneous') {
          // Mode simultané : envoyer seulement au joueur, pas à l'adversaire
          socket.emit('guess-result', {
            attempt: result.attempt,
            isCorrect: false
          });
        } else {
          // Mode tour par tour : comportement actuel
          socket.emit('guess-result', {
            attempt: result.attempt,
            isCorrect: false,
            isYourTurn: false
          });

          // Informer l'adversaire
          const opponentSocket = io.sockets.sockets.get(opponentId);
          if (opponentSocket) {
            opponentSocket.emit('opponent-guess', {
              attempt: result.attempt,
              isYourTurn: true
            });
          }
        }
      }
    });

    // Demander une revanche
    socket.on('request-rematch', () => {
      const room = gameManager.getPlayerRoom(socket.id);
      if (!room) {
        socket.emit('rematch-error', { error: 'Room introuvable' });
        return;
      }

      const result = gameManager.requestRematch(socket);

      if (result.error) {
        socket.emit('rematch-error', { error: result.error });
        return;
      }

      const opponentId = gameManager.getOpponentId(room, socket.id);

      if (result.status === 'rematch-starting') {
        // ★ NOUVEAU - Démarrer le timer en mode simultané
        startTimerForRoom(room.id, room);

        // Notifier les deux joueurs du nouveau match
        const playerIds = Object.keys(room.players);
        playerIds.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            const opId = playerIds.find(id => id !== playerId);
            playerSocket.emit('rematch-starting', {
              isYourTurn: result.room.currentTurn === playerId,
              myScore: room.sessionScores[playerId],
              opponentScore: room.sessionScores[opId],
              // ★ NOUVEAU - Envoyer les infos du timer pour le rematch
              timer: room.timer ? {
                startTime: room.timer.startTime,
                duration: room.timer.duration
              } : null
            });
          }
        });
        console.log(`Rematch starting in room ${room.id} [${room.gameMode}]`);
      } else {
        // Notifier l'adversaire de la demande de revanche
        const opponentSocket = io.sockets.sockets.get(opponentId);
        if (opponentSocket) {
          opponentSocket.emit('rematch-requested');
        }
        socket.emit('rematch-vote-registered');
      }
    });

    // Quitter la room
    socket.on('leave-room', () => {
      const result = gameManager.leaveRoom(socket);
      if (result && result.opponentId) {
        const opponentSocket = io.sockets.sockets.get(result.opponentId);
        if (opponentSocket) {
          opponentSocket.emit('opponent-left');
        }
      }
      socket.emit('room-left');
    });

    // Chat
    socket.on('send-chat', ({ text }) => {
      if (!text || typeof text !== 'string') return;

      const result = gameManager.addMessage(socket.id, text);
      if (result) {
        // Broadcast le message à tous les joueurs de la room
        io.to(result.roomId).emit('chat-message', result.message);
      }
    });

    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      const result = gameManager.handleDisconnect(socket);

      if (result && result.opponentId) {
        const opponentSocket = io.sockets.sockets.get(result.opponentId);
        if (opponentSocket) {
          opponentSocket.emit('opponent-disconnected');
        }
      }
    });
  });

  return gameManager;
}

module.exports = setupSocketHandlers;