const { getFeedbackObject } = require('./feedbackUtils');

class GameManager {
  constructor() {
    this.matchmakingQueues = new Map();
    this.gameRooms = new Map();
    this.playerRooms = new Map();
    this.userSockets = new Map();
    this.privateRooms = new Map();
    this.privateLobbyHosts = new Map();
  }

  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  pickTarget(characters) {
    const i = Math.floor(Math.random() * characters.length);
    return characters[i];
  }

  getQueueKey(category, gameId) {
    return `${category}-${gameId}`;
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.privateRooms.has(code));
    return code;
  }

  createPrivateRoom(socket, gameId, gameData, user = null, category = 'anime', gameMode = 'turnbased') {
    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) return { status: busyCheck.reason };
      this.userSockets.set(user.userId, socket.id);
    }

    if (this.privateLobbyHosts.has(socket.id)) {
      const existingCode = this.privateLobbyHosts.get(socket.id);
      return { status: 'already-hosting', code: existingCode };
    }

    const roomCode = this.generateRoomCode();
    const username = user?.username || 'Joueur 1';

    this.privateRooms.set(roomCode, {
      code: roomCode,
      host: socket,
      gameId,
      gameData,
      category,
      gameMode,
      user,
      username,
      createdAt: Date.now()
    });

    this.privateLobbyHosts.set(socket.id, roomCode);

    return { status: 'private-room-created', code: roomCode };
  }

  joinPrivateRoom(socket, roomCode, user = null, gameId = null) {
    const privateRoom = this.privateRooms.get(roomCode.toUpperCase());

    if (!privateRoom) return { status: 'room-not-found' };

    // ✅ BUG 1 FIX — Vérification stricte du gameId
    if (gameId && privateRoom.gameId !== gameId) {
      return { status: 'wrong-game' };
    }

    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) return { status: busyCheck.reason };
      this.userSockets.set(user.userId, socket.id);
    }

    if (privateRoom.host.id === socket.id) return { status: 'cannot-join-own-room' };

    const player1 = {
      socket: privateRoom.host,
      gameData: privateRoom.gameData,
      user: privateRoom.user,
      category: privateRoom.category,
      gameId: privateRoom.gameId
    };

    const player2 = {
      socket,
      gameData: privateRoom.gameData,
      user,
      category: privateRoom.category,
      gameId: privateRoom.gameId
    };

    this.privateRooms.delete(roomCode.toUpperCase());
    this.privateLobbyHosts.delete(privateRoom.host.id);

    return this.createRoom(player1, player2, privateRoom.gameId, privateRoom.category, privateRoom.gameMode);
  }

  cancelPrivateRoom(socket) {
    const roomCode = this.privateLobbyHosts.get(socket.id);
    if (!roomCode) return { status: 'no-room-to-cancel' };

    const privateRoom = this.privateRooms.get(roomCode);
    if (privateRoom?.user?.userId) this.userSockets.delete(privateRoom.user.userId);

    this.privateRooms.delete(roomCode);
    this.privateLobbyHosts.delete(socket.id);

    return { status: 'private-room-cancelled' };
  }

  isUserBusy(userId) {
    if (!userId) return false;

    const existingSocketId = this.userSockets.get(userId);
    if (existingSocketId) {
      if (this.playerRooms.has(existingSocketId)) {
        return { busy: true, reason: 'already-in-game' };
      }
      for (const [, queue] of this.matchmakingQueues) {
        if (queue.some(item => item.user?.userId === userId)) {
          return { busy: true, reason: 'already-in-queue' };
        }
      }
    }
    return { busy: false };
  }

  joinQueue(socket, gameId, gameData, user = null, category = 'anime', gameMode = 'turnbased') {
    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) return { status: busyCheck.reason };
      this.userSockets.set(user.userId, socket.id);
    }

    const queueKey = this.getQueueKey(category, gameId);

    if (!this.matchmakingQueues.has(queueKey)) {
      this.matchmakingQueues.set(queueKey, []);
    }

    const queue = this.matchmakingQueues.get(queueKey);

    const existingIndex = queue.findIndex(item => item.socket.id === socket.id);
    if (existingIndex !== -1) {
      return { status: 'already-in-queue', position: existingIndex + 1 };
    }

    queue.push({ socket, gameData, user, category, gameId, gameMode });
    const position = queue.length;

    if (queue.length >= 2) {
      const player1 = queue.shift();
      const player2 = queue.shift();
      return this.createRoom(player1, player2, gameId, category, player1.gameMode);
    }

    return { status: 'queue-joined', position };
  }

  leaveQueue(socket, gameId, category = 'anime') {
    const queueKey = this.getQueueKey(category, gameId);
    if (!this.matchmakingQueues.has(queueKey)) return;

    const queue = this.matchmakingQueues.get(queueKey);
    const index = queue.findIndex(item => item.socket.id === socket.id);
    if (index !== -1) {
      const player = queue[index];
      if (player.user?.userId) this.userSockets.delete(player.user.userId);
      queue.splice(index, 1);
    }
  }

  leaveAllQueues(socket) {
    for (const [, queue] of this.matchmakingQueues) {
      const index = queue.findIndex(item => item.socket.id === socket.id);
      if (index !== -1) {
        const player = queue[index];
        if (player.user?.userId) this.userSockets.delete(player.user.userId);
        queue.splice(index, 1);
      }
    }
  }

  createRoom(player1, player2, gameId, category = 'anime', gameMode = 'turnbased') {
    const roomId = this.generateRoomId();
    const gameData = player1.gameData;
    const characters = gameData.characters || [];
    const target = this.pickTarget(characters);

    const firstPlayer = Math.random() < 0.5 ? player1.socket.id : player2.socket.id;

    const username1 = player1.user?.username || 'Joueur 1';
    const username2 = player2.user?.username || 'Joueur 2';

    const room = {
      id: roomId,
      gameId,
      category,
      gameMode,
      target,
      gameData,
      players: {
        [player1.socket.id]: {
          attempts: [],
          rematchVote: false,
          username: username1,
          user: player1.user
        },
        [player2.socket.id]: {
          attempts: [],
          rematchVote: false,
          username: username2,
          user: player2.user
        }
      },
      sessionScores: {
        [player1.socket.id]: 0,
        [player2.socket.id]: 0
      },
      messages: [],
      currentTurn: gameMode === 'turnbased' ? firstPlayer : null,
      status: 'playing',
      winner: null,
      createdAt: Date.now(),
      timer: gameMode === 'simultaneous' ? {
        startTime: Date.now(),
        duration: 180000,
        timeoutId: null
      } : null
    };

    this.gameRooms.set(roomId, room);
    this.playerRooms.set(player1.socket.id, roomId);
    this.playerRooms.set(player2.socket.id, roomId);

    return {
      status: 'match-found',
      roomId,
      room,
      players: [player1.socket, player2.socket]
    };
  }

  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return null;
    return this.gameRooms.get(roomId);
  }

  getOpponentId(room, socketId) {
    const playerIds = Object.keys(room.players);
    return playerIds.find(id => id !== socketId);
  }

  addMessage(socketId, text) {
    const room = this.getPlayerRoom(socketId);
    if (!room) return null;

    const player = room.players[socketId];
    if (!player) return null;

    const message = {
      id: Date.now(),
      senderId: socketId,
      senderName: player.username,
      text: text.substring(0, 200),
      timestamp: Date.now()
    };

    room.messages.push(message);
    if (room.messages.length > 50) room.messages.shift();

    return { message, roomId: room.id };
  }

  makeGuess(socket, roomId, character) {
    const room = this.gameRooms.get(roomId);
    if (!room) return { error: 'Room introuvable' };
    if (room.status !== 'playing') return { error: 'La partie est terminée' };

    if (room.gameMode === 'turnbased' && room.currentTurn !== socket.id) {
      return { error: "Ce n'est pas ton tour" };
    }

    const player = room.players[socket.id];
    if (!player) return { error: 'Joueur introuvable dans la room' };

    const myAttempts = player.attempts;
    if (myAttempts.some(a => a.guess.id === character.id)) {
      return { error: 'Tu as déjà essayé ce personnage' };
    }

    if (room.gameMode === 'turnbased') {
      const allAttempts = Object.values(room.players).flatMap(p => p.attempts);
      if (allAttempts.some(a => a.guess.id === character.id)) {
        return { error: 'Ce personnage a déjà été joué' };
      }
    }

    const feedback = getFeedbackObject(character, room.target, room.gameData.attributes || []);
    const isCorrect = character.id === room.target.id;

    const attempt = { guess: character, feedback, isCorrect, timestamp: Date.now() };
    player.attempts.push(attempt);

    if (isCorrect) {
      room.status = 'finished';
      room.winner = socket.id;
      room.sessionScores[socket.id]++;

      // ✅ BUG 2 FIX — Nettoyer le timer dès qu'un joueur gagne
      if (room.timer?.timeoutId) {
        clearTimeout(room.timer.timeoutId);
        room.timer.timeoutId = null;
      }

      // Calculer le nombre de coups de chaque joueur
      const opponentId = this.getOpponentId(room, socket.id);
      const winnerAttempts = player.attempts.length;
      const loserAttempts = opponentId ? room.players[opponentId].attempts.length : 0;

      return {
        status: 'game-over',
        attempt,
        winner: socket.id,
        target: room.target,
        sessionScores: room.sessionScores,
        gameMode: room.gameMode,
        winnerAttempts,   // ✅ nb coups du gagnant
        loserAttempts     // ✅ nb coups du perdant
      };
    }

    if (room.gameMode === 'turnbased') {
      const opponentId = this.getOpponentId(room, socket.id);
      room.currentTurn = opponentId;
      return { status: 'guess-made', attempt, nextTurn: opponentId };
    }

    return { status: 'guess-made', attempt, gameMode: 'simultaneous' };
  }

  handleTimerExpired(roomId) {
    const room = this.gameRooms.get(roomId);
    if (!room || room.status !== 'playing') return null;

    room.status = 'finished';
    room.winner = null;

    return {
      status: 'timer-expired',
      target: room.target,
      sessionScores: room.sessionScores
    };
  }

  requestRematch(socket) {
    const room = this.getPlayerRoom(socket.id);
    if (!room) return { error: 'Room introuvable' };
    if (room.status !== 'finished') return { error: 'La partie n\'est pas terminée' };

    const player = room.players[socket.id];
    if (!player) return { error: 'Joueur introuvable' };

    player.rematchVote = true;

    const playerIds = Object.keys(room.players);
    const allVoted = playerIds.every(id => room.players[id].rematchVote);

    if (allVoted) {
      const newTarget = this.pickTarget(room.gameData.characters || []);
      room.target = newTarget;
      room.status = 'playing';
      room.winner = null;

      if (room.gameMode === 'turnbased') {
        room.currentTurn = playerIds[Math.floor(Math.random() * 2)];
      } else if (room.gameMode === 'simultaneous') {
        // ✅ BUG 2 FIX — Nettoyer l'ancien timer avant d'en créer un nouveau
        if (room.timer?.timeoutId) {
          clearTimeout(room.timer.timeoutId);
        }
        room.timer = {
          startTime: Date.now(),
          duration: 180000,
          timeoutId: null
        };
      }

      playerIds.forEach(id => {
        room.players[id].attempts = [];
        room.players[id].rematchVote = false;
      });

      return { status: 'rematch-starting', room };
    }

    return { status: 'rematch-requested', votedBy: socket.id };
  }

  leaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return null;

    const room = this.gameRooms.get(roomId);
    if (!room) {
      this.playerRooms.delete(socket.id);
      return null;
    }

    // Nettoyer le timer si besoin
    if (room.timer?.timeoutId) {
      clearTimeout(room.timer.timeoutId);
      room.timer.timeoutId = null;
    }

    const opponentId = this.getOpponentId(room, socket.id);

    const leavingPlayer = room.players[socket.id];
    if (leavingPlayer?.user?.userId) this.userSockets.delete(leavingPlayer.user.userId);

    this.gameRooms.delete(roomId);
    this.playerRooms.delete(socket.id);
    if (opponentId) {
      this.playerRooms.delete(opponentId);
      const opponentPlayer = room.players[opponentId];
      if (opponentPlayer?.user?.userId) this.userSockets.delete(opponentPlayer.user.userId);
    }

    return { opponentId, roomId };
  }

  handleDisconnect(socket) {
    this.leaveAllQueues(socket);
    this.cancelPrivateRoom(socket);
    return this.leaveRoom(socket);
  }
}

module.exports = GameManager;