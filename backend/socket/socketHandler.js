const GameManager = require('./gameManager');
const { verifyToken } = require('../auth/authUtils');
const { findUserById, recordDuoMatch } = require('../db/database');

function setupSocketHandlers(io) {
  const gameManager = new GameManager();

  async function startTimerForRoom(roomId, room) {
    if (room.gameMode === 'simultaneous' && room.timer) {
      room.timer.timeoutId = setTimeout(async () => {
        const timerResult = gameManager.handleTimerExpired(roomId);
        if (timerResult) {
          const playerIds = Object.keys(room.players);
          const player1 = room.players[playerIds[0]];
          const player2 = room.players[playerIds[1]];

          if (player1.user?.userId && player2.user?.userId) {
            await recordDuoMatch(
              player1.user.userId, player2.user.userId,
              room.gameId, null,
              player1.attempts.length, player2.attempts.length,
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

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try { socket.user = verifyToken(token); }
      catch (err) { socket.user = null; }
    } else {
      socket.user = null;
    }
    next();
  });

  io.on('connection', (socket) => {
    const username = socket.user?.username || 'Joueur';
    console.log(`Player connected: ${socket.id} (${username})`);

    socket.on('join-queue', async ({ animeId, gameId, gameData, category, gameMode }) => {
      const finalGameId = gameId || animeId;
      const finalCategory = category || 'anime';
      const finalGameMode = gameMode || 'turnbased';

      console.log(`${socket.id} joining queue for ${finalCategory}/${finalGameId} (${finalGameMode})`);

      if (!socket.user) {
        socket.emit('queue-error', { error: 'Tu dois être connecté pour jouer en duo' });
        return;
      }
      const dbUser = await findUserById(socket.user.userId);
      if (!dbUser || !dbUser.email_verified) {
        socket.emit('queue-error', { error: 'Tu dois vérifier ton email pour jouer en duo' });
        return;
      }

      const result = gameManager.joinQueue(socket, finalGameId, gameData, socket.user, finalCategory, finalGameMode);

      if (result.status === 'already-in-game') {
        socket.emit('queue-error', { error: 'Tu es déjà dans une partie en cours' });
      } else if (result.status === 'already-in-queue') {
        socket.emit('queue-error', { error: 'Tu es déjà en recherche de partie' });
      } else if (result.status === 'queue-joined') {
        socket.emit('queue-joined', { position: result.position });
      } else if (result.status === 'match-found') {
        const { roomId, room, players } = result;
        startTimerForRoom(roomId, room);

        players.forEach((playerSocket) => {
          playerSocket.join(roomId);
          const isFirstTurn = room.currentTurn === playerSocket.id;
          const opId = players.find(p => p.id !== playerSocket.id)?.id;
          playerSocket.emit('match-found', {
            roomId, isYourTurn: isFirstTurn, opponentId: opId,
            gameData: room.gameData, category: room.category, gameId: room.gameId,
            gameMode: room.gameMode, maxAttempts: room.gameData.maxAttempts || 26,
            playerName: room.players[playerSocket.id].username,
            opponentName: room.players[opId].username,
            myScore: room.sessionScores[playerSocket.id],
            opponentScore: room.sessionScores[opId],
            timer: room.timer ? { startTime: room.timer.startTime, duration: room.timer.duration } : null
          });
        });
        console.log(`Match created: ${roomId} (${room.category}/${room.gameId}) [${room.gameMode}]`);
      }
    });

    socket.on('leave-queue', async ({ animeId, gameId, category }) => {
      const finalGameId = gameId || animeId;
      const finalCategory = category || 'anime';
      gameManager.leaveQueue(socket, finalGameId, finalCategory);
      socket.emit('queue-left');
    });

    socket.on('create-private-room', async ({ gameId, gameData, category, gameMode }) => {
      const finalCategory = category || 'anime';
      const finalGameMode = gameMode || 'turnbased';

      console.log(`${socket.id} creating private room for ${finalCategory}/${gameId} (${finalGameMode})`);

      if (!socket.user) {
        socket.emit('private-room-error', { error: 'Tu dois être connecté pour créer un salon privé' });
        return;
      }
      const dbUser = await findUserById(socket.user.userId);
      if (!dbUser || !dbUser.email_verified) {
        socket.emit('private-room-error', { error: 'Tu dois vérifier ton email pour créer un salon privé' });
        return;
      }

      const result = gameManager.createPrivateRoom(socket, gameId, gameData, socket.user, finalCategory, finalGameMode);

      if (result.status === 'already-in-game') {
        socket.emit('private-room-error', { error: 'Tu es déjà dans une partie en cours' });
      } else if (result.status === 'already-in-queue') {
        socket.emit('private-room-error', { error: 'Tu es déjà en recherche de partie' });
      } else if (result.status === 'already-hosting') {
        socket.emit('private-room-error', { error: 'Tu héberges déjà un salon privé' });
      } else if (result.status === 'private-room-created') {
        socket.emit('private-room-created', { code: result.code });
        console.log(`Private room created with code: ${result.code}`);
      }
    });

    socket.on('join-private-room', async ({ roomCode, gameId, gameMode }) => {
      console.log(`${socket.id} trying to join private room: ${roomCode} for game: ${gameId} (${gameMode})`);

      if (!socket.user) {
        socket.emit('private-room-error', { error: 'Tu dois être connecté pour rejoindre un salon privé' });
        return;
      }
      const dbUser = await findUserById(socket.user.userId);
      if (!dbUser || !dbUser.email_verified) {
        socket.emit('private-room-error', { error: 'Tu dois vérifier ton email pour rejoindre un salon privé' });
        return;
      }

      const result = gameManager.joinPrivateRoom(socket, roomCode, socket.user, gameId, gameMode);

      if (result.status === 'room-not-found') {
        socket.emit('private-room-error', { error: 'Code de salon invalide' });
      } else if (result.status === 'wrong-game') {
        socket.emit('private-room-error', { error: 'Ce salon est pour un autre jeu !' });
      } else if (result.status === 'wrong-gamemode') {
        socket.emit('private-room-error', { error: 'Ce salon utilise un mode de jeu différent !' });
      } else if (result.status === 'already-in-game') {
        socket.emit('private-room-error', { error: 'Tu es déjà dans une partie en cours' });
      } else if (result.status === 'already-in-queue') {
        socket.emit('private-room-error', { error: 'Tu es déjà en recherche de partie' });
      } else if (result.status === 'cannot-join-own-room') {
        socket.emit('private-room-error', { error: 'Tu ne peux pas rejoindre ton propre salon' });
      } else if (result.status === 'match-found') {
        const { roomId, room, players } = result;
        startTimerForRoom(roomId, room);

        players.forEach((playerSocket) => {
          playerSocket.join(roomId);
          const isFirstTurn = room.currentTurn === playerSocket.id;
          const opId = players.find(p => p.id !== playerSocket.id)?.id;
          playerSocket.emit('match-found', {
            roomId, isYourTurn: isFirstTurn, opponentId: opId,
            gameData: room.gameData, category: room.category, gameId: room.gameId,
            gameMode: room.gameMode, maxAttempts: room.gameData.maxAttempts || 26,
            playerName: room.players[playerSocket.id].username,
            opponentName: room.players[opId].username,
            myScore: room.sessionScores[playerSocket.id],
            opponentScore: room.sessionScores[opId],
            timer: room.timer ? { startTime: room.timer.startTime, duration: room.timer.duration } : null
          });
        });
        console.log(`Private match started: ${roomId} [${room.gameMode}]`);
      }
    });

    socket.on('cancel-private-room', async () => {
      const result = gameManager.cancelPrivateRoom(socket);
      if (result.status === 'private-room-cancelled') {
        socket.emit('private-room-cancelled');
      }
    });

    socket.on('make-guess', async ({ roomId, character }) => {
      const result = gameManager.makeGuess(socket, roomId, character);

      if (result.error) {
        socket.emit('guess-error', { error: result.error });
        return;
      }

      const room = gameManager.getPlayerRoom(socket.id);
      const opponentId = gameManager.getOpponentId(room, socket.id);

      if (result.status === 'game-over') {
        socket.emit('guess-result', { attempt: result.attempt, isCorrect: true });

        const playerIds = Object.keys(room.players);
        const player1 = room.players[playerIds[0]];
        const player2 = room.players[playerIds[1]];

        if (player1.user?.userId && player2.user?.userId) {
          await recordDuoMatch(
            player1.user.userId, player2.user.userId, room.gameId,
            result.winner ? room.players[result.winner].user?.userId : null,
            player1.attempts.length, player2.attempts.length,
            room.gameMode || 'turnbased'
          );
        }

        // ✅ BUG 3 FIX — envoyer winnerAttempts + loserAttempts dans game-over
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
              gameMode: room.gameMode,
              winnerAttempts: result.winnerAttempts,
              loserAttempts: result.loserAttempts
            });
          }
        });

        console.log(`Game over in ${roomId}, winner: ${socket.id} [${room.gameMode}]`);

      } else {
        const opponentSocket = io.sockets.sockets.get(opponentId);
        const currentPlayerAttempts = room.players[socket.id].attempts.length;

        if (opponentSocket) {
          opponentSocket.emit('opponent-attempt-update', { attempts: currentPlayerAttempts });
        }

        if (room.gameMode === 'simultaneous') {
          socket.emit('guess-result', { attempt: result.attempt, isCorrect: false });
        } else {
          socket.emit('guess-result', { attempt: result.attempt, isCorrect: false, isYourTurn: false });
          if (opponentSocket) {
            opponentSocket.emit('opponent-guess', { attempt: result.attempt, isYourTurn: true });
          }
        }
      }
    });

    socket.on('request-rematch', async () => {
      const room = gameManager.getPlayerRoom(socket.id);
      if (!room) { socket.emit('rematch-error', { error: 'Room introuvable' }); return; }

      const result = gameManager.requestRematch(socket);
      if (result.error) { socket.emit('rematch-error', { error: result.error }); return; }

      const opponentId = gameManager.getOpponentId(room, socket.id);

      if (result.status === 'rematch-starting') {
        startTimerForRoom(room.id, room);
        const playerIds = Object.keys(room.players);
        playerIds.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            const opId = playerIds.find(id => id !== playerId);
            playerSocket.emit('rematch-starting', {
              isYourTurn: result.room.currentTurn === playerId,
              myScore: room.sessionScores[playerId],
              opponentScore: room.sessionScores[opId],
              timer: room.timer ? { startTime: room.timer.startTime, duration: room.timer.duration } : null
            });
          }
        });
        console.log(`Rematch starting in room ${room.id} [${room.gameMode}]`);
      } else {
        const opponentSocket = io.sockets.sockets.get(opponentId);
        if (opponentSocket) opponentSocket.emit('rematch-requested');
        socket.emit('rematch-vote-registered');
      }
    });

    socket.on('leave-room', async () => {
      const result = gameManager.leaveRoom(socket);
      if (result?.opponentId) {
        const opponentSocket = io.sockets.sockets.get(result.opponentId);
        if (opponentSocket) opponentSocket.emit('opponent-left');
      }
      socket.emit('room-left');
    });

    socket.on('send-chat', async ({ text }) => {
      if (!text || typeof text !== 'string') return;
      const result = gameManager.addMessage(socket.id, text);
      if (result) io.to(result.roomId).emit('chat-message', result.message);
    });

    socket.on('disconnect', async () => {
      console.log(`Player disconnected: ${socket.id}`);
      const result = gameManager.handleDisconnect(socket);
      if (result?.opponentId) {
        const opponentSocket = io.sockets.sockets.get(result.opponentId);
        if (opponentSocket) opponentSocket.emit('opponent-disconnected');
      }
    });
  });

  return gameManager;
}

module.exports = setupSocketHandlers;