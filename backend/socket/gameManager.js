const { getFeedbackObject } = require('./feedbackUtils');

class GameManager {
  constructor() {
    // Queue par catégorie-gameId: Map<'anime-chainsaw-man' | 'game-smashdle', Socket[]>
    this.matchmakingQueues = new Map();
    // Rooms de jeu: Map<roomId, GameRoom>
    this.gameRooms = new Map();
    // Map socket -> roomId pour retrouver la room d'un joueur
    this.playerRooms = new Map();
    // Map userId -> socketId pour empêcher les connexions multiples
    this.userSockets = new Map();
    // Salons privés en attente: Map<roomCode, PrivateRoomData>
    this.privateRooms = new Map();
    // Map socket -> roomCode pour les créateurs de salons privés
    this.privateLobbyHosts = new Map();
  }

  // Génère un ID unique pour une room
  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Sélection aléatoire d'une cible
  pickTarget(characters) {
    const i = Math.floor(Math.random() * characters.length);
    return characters[i];
  }

  // Créer une clé de queue unique basée sur catégorie et gameId
  getQueueKey(category, gameId) {
    return `${category}-${gameId}`;
  }

  // Générer un code de salon privé (format ABC123)
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

  // Créer un salon privé
  createPrivateRoom(socket, gameId, gameData, user = null, category = 'anime', gameMode = 'turnbased') {
    // Vérifier si l'utilisateur connecté est déjà occupé
    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) {
        return { status: busyCheck.reason };
      }
      // Enregistrer ce socket pour cet utilisateur
      this.userSockets.set(user.userId, socket.id);
    }

    // Vérifier si le joueur a déjà créé un salon
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
      gameMode, // ★ NOUVEAU
      user,
      username,
      createdAt: Date.now()
    });

    this.privateLobbyHosts.set(socket.id, roomCode);

    return {
      status: 'private-room-created',
      code: roomCode
    };
  }

  // Rejoindre un salon privé
  joinPrivateRoom(socket, roomCode, user = null) {
    const privateRoom = this.privateRooms.get(roomCode.toUpperCase());

    if (!privateRoom) {
      return { status: 'room-not-found' };
    }

    // Vérifier si l'utilisateur connecté est déjà occupé
    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) {
        return { status: busyCheck.reason };
      }
      // Enregistrer ce socket pour cet utilisateur
      this.userSockets.set(user.userId, socket.id);
    }

    // Vérifier que ce n'est pas l'hôte qui essaie de rejoindre
    if (privateRoom.host.id === socket.id) {
      return { status: 'cannot-join-own-room' };
    }

    // Créer la room de jeu
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

    // Supprimer le salon privé de la liste d'attente
    this.privateRooms.delete(roomCode.toUpperCase());
    this.privateLobbyHosts.delete(privateRoom.host.id);

    // Créer la room de jeu
    return this.createRoom(player1, player2, privateRoom.gameId, privateRoom.category, privateRoom.gameMode);
  }

  // Annuler un salon privé
  cancelPrivateRoom(socket) {
    const roomCode = this.privateLobbyHosts.get(socket.id);
    if (!roomCode) {
      return { status: 'no-room-to-cancel' };
    }

    const privateRoom = this.privateRooms.get(roomCode);
    if (privateRoom?.user?.userId) {
      this.userSockets.delete(privateRoom.user.userId);
    }

    this.privateRooms.delete(roomCode);
    this.privateLobbyHosts.delete(socket.id);

    return { status: 'private-room-cancelled' };
  }

  // Vérifier si un utilisateur est déjà en jeu ou en queue
  isUserBusy(userId) {
    if (!userId) return false;

    // Vérifier si l'utilisateur a déjà un socket actif
    const existingSocketId = this.userSockets.get(userId);
    if (existingSocketId) {
      // Vérifier s'il est dans une room
      if (this.playerRooms.has(existingSocketId)) {
        return { busy: true, reason: 'already-in-game' };
      }
      // Vérifier s'il est dans une queue
      for (const [, queue] of this.matchmakingQueues) {
        if (queue.some(item => item.user?.userId === userId)) {
          return { busy: true, reason: 'already-in-queue' };
        }
      }
    }
    return { busy: false };
  }

  // Ajouter un joueur à la queue (version mise à jour avec support catégorie)
  joinQueue(socket, gameId, gameData, user = null, category = 'anime', gameMode = 'turnbased') {
    // Vérifier si l'utilisateur connecté est déjà occupé
    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) {
        return { status: busyCheck.reason };
      }
      // Enregistrer ce socket pour cet utilisateur
      this.userSockets.set(user.userId, socket.id);
    }

    const queueKey = this.getQueueKey(category, gameId);

    if (!this.matchmakingQueues.has(queueKey)) {
      this.matchmakingQueues.set(queueKey, []);
    }

    const queue = this.matchmakingQueues.get(queueKey);

    // Vérifier si le joueur est déjà dans une queue (par socket.id)
    const existingIndex = queue.findIndex(item => item.socket.id === socket.id);
    if (existingIndex !== -1) {
      return { status: 'already-in-queue', position: existingIndex + 1 };
    }

    queue.push({ socket, gameData, user, category, gameId, gameMode }); // ★ Ajouter gameMode
    const position = queue.length;

    // Si on a 2 joueurs, créer une room
    if (queue.length >= 2) {
      const player1 = queue.shift();
      const player2 = queue.shift();
      return this.createRoom(player1, player2, gameId, category, player1.gameMode); // ★ Passer gameMode
    }

    return { status: 'queue-joined', position };
  }

  // Retirer un joueur de la queue
  leaveQueue(socket, gameId, category = 'anime') {
    const queueKey = this.getQueueKey(category, gameId);
    
    if (!this.matchmakingQueues.has(queueKey)) return;

    const queue = this.matchmakingQueues.get(queueKey);
    const index = queue.findIndex(item => item.socket.id === socket.id);
    if (index !== -1) {
      const player = queue[index];
      // Nettoyer le tracking utilisateur
      if (player.user?.userId) {
        this.userSockets.delete(player.user.userId);
      }
      queue.splice(index, 1);
    }
  }

  // Retirer un joueur de toutes les queues
  leaveAllQueues(socket) {
    for (const [, queue] of this.matchmakingQueues) {
      const index = queue.findIndex(item => item.socket.id === socket.id);
      if (index !== -1) {
        const player = queue[index];
        // Nettoyer le tracking utilisateur
        if (player.user?.userId) {
          this.userSockets.delete(player.user.userId);
        }
        queue.splice(index, 1);
      }
    }
  }

  // Créer une room de jeu
  createRoom(player1, player2, gameId, category = 'anime', gameMode = 'turnbased') {
    const roomId = this.generateRoomId();
    const gameData = player1.gameData;
    const characters = gameData.characters || [];
    const target = this.pickTarget(characters);

    // Choisir aléatoirement qui commence (seulement pour turnbased)
    const firstPlayer = Math.random() < 0.5 ? player1.socket.id : player2.socket.id;

    // Utiliser le username de l'utilisateur connecté ou un nom par défaut
    const username1 = player1.user?.username || 'Joueur 1';
    const username2 = player2.user?.username || 'Joueur 2';

    const room = {
      id: roomId,
      gameId,
      category,
      gameMode, // ★ NOUVEAU - Mode de jeu
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
      currentTurn: gameMode === 'turnbased' ? firstPlayer : null, // ★ Pas de tour en mode simultané
      status: 'playing',
      winner: null,
      createdAt: Date.now(),
      // ★ NOUVEAU - Timer pour mode simultané (3 minutes = 180000ms)
      timer: gameMode === 'simultaneous' ? {
        startTime: Date.now(),
        duration: 180000, // 3 minutes
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

  // Obtenir la room d'un joueur
  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return null;
    return this.gameRooms.get(roomId);
  }

  // Obtenir l'ID de l'adversaire
  getOpponentId(room, socketId) {
    const playerIds = Object.keys(room.players);
    return playerIds.find(id => id !== socketId);
  }

  // Ajouter un message au chat de la room
  addMessage(socketId, text) {
    const room = this.getPlayerRoom(socketId);
    if (!room) return null;

    const player = room.players[socketId];
    if (!player) return null;

    const message = {
      id: Date.now(),
      senderId: socketId,
      senderName: player.username,
      text: text.substring(0, 200), // Limite 200 caractères
      timestamp: Date.now()
    };

    room.messages.push(message);

    // Garder seulement les 50 derniers messages
    if (room.messages.length > 50) {
      room.messages.shift();
    }

    return { message, roomId: room.id };
  }

  // Traiter un guess
  makeGuess(socket, roomId, character) {
    const room = this.gameRooms.get(roomId);
    if (!room) {
      return { error: 'Room introuvable' };
    }

    if (room.status !== 'playing') {
      return { error: 'La partie est terminée' };
    }

    // ★ MODIFIÉ - Vérifier le tour seulement en mode turnbased
    if (room.gameMode === 'turnbased' && room.currentTurn !== socket.id) {
      return { error: "Ce n'est pas ton tour" };
    }

    const player = room.players[socket.id];
    if (!player) {
      return { error: 'Joueur introuvable dans la room' };
    }

    // ★ MODIFIÉ - En mode simultané, vérifier seulement ses propres tentatives
    const myAttempts = player.attempts;
    if (myAttempts.some(a => a.guess.id === character.id)) {
      return { error: 'Tu as déjà essayé ce personnage' };
    }

    // ★ MODIFIÉ - En mode turnbased, vérifier toutes les tentatives
    if (room.gameMode === 'turnbased') {
      const allAttempts = Object.values(room.players).flatMap(p => p.attempts);
      if (allAttempts.some(a => a.guess.id === character.id)) {
        return { error: 'Ce personnage a déjà été joué' };
      }
    }

    // Calculer le feedback
    const feedback = getFeedbackObject(character, room.target, room.gameData.attributes || []);
    const isCorrect = character.id === room.target.id;

    const attempt = { guess: character, feedback, isCorrect, timestamp: Date.now() };
    player.attempts.push(attempt);

    // Vérifier si la partie est terminée
    if (isCorrect) {
      room.status = 'finished';
      room.winner = socket.id;
      room.sessionScores[socket.id]++;
      
      // ★ NOUVEAU - Nettoyer le timer si mode simultané
      if (room.timer?.timeoutId) {
        clearTimeout(room.timer.timeoutId);
      }
      
      return {
        status: 'game-over',
        attempt,
        winner: socket.id,
        target: room.target,
        sessionScores: room.sessionScores,
        gameMode: room.gameMode // ★ Envoyer le mode
      };
    }

    // ★ MODIFIÉ - Changer de tour seulement en mode turnbased
    if (room.gameMode === 'turnbased') {
      const opponentId = this.getOpponentId(room, socket.id);
      room.currentTurn = opponentId;
      
      return {
        status: 'guess-made',
        attempt,
        nextTurn: opponentId
      };
    }

    // ★ NOUVEAU - En mode simultané, pas de changement de tour
    return {
      status: 'guess-made',
      attempt,
      gameMode: 'simultaneous'
    };
  }

  // ★ NOUVEAU - Gérer l'expiration du timer (mode simultané)
  handleTimerExpired(roomId) {
    const room = this.gameRooms.get(roomId);
    if (!room || room.status !== 'playing') return null;

    // Timer expiré = match nul
    room.status = 'finished';
    room.winner = null; // Match nul

    return {
      status: 'timer-expired',
      target: room.target,
      sessionScores: room.sessionScores
    };
  }

  // Demander une revanche
  requestRematch(socket) {
    const room = this.getPlayerRoom(socket.id);
    if (!room) {
      return { error: 'Room introuvable' };
    }

    if (room.status !== 'finished') {
      return { error: 'La partie n\'est pas terminée' };
    }

    const player = room.players[socket.id];
    if (!player) {
      return { error: 'Joueur introuvable' };
    }

    player.rematchVote = true;

    // Vérifier si les deux joueurs veulent une revanche
    const playerIds = Object.keys(room.players);
    const allVoted = playerIds.every(id => room.players[id].rematchVote);

    if (allVoted) {
      // Reset la room pour une nouvelle partie
      const newTarget = this.pickTarget(room.gameData.characters || []);
      room.target = newTarget;
      room.status = 'playing';
      room.winner = null;

      // ★ MODIFIÉ - Réinitialiser selon le mode de jeu
      if (room.gameMode === 'turnbased') {
        // Choisir aléatoirement qui commence
        room.currentTurn = playerIds[Math.floor(Math.random() * 2)];
      } else if (room.gameMode === 'simultaneous') {
        // Réinitialiser le timer
        room.timer = {
          startTime: Date.now(),
          duration: 180000, // 3 minutes
          timeoutId: null
        };
      }

      // Reset les joueurs
      playerIds.forEach(id => {
        room.players[id].attempts = [];
        room.players[id].rematchVote = false;
      });

      return {
        status: 'rematch-starting',
        room
      };
    }

    return {
      status: 'rematch-requested',
      votedBy: socket.id
    };
  }

  // Quitter une room
  leaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return null;

    const room = this.gameRooms.get(roomId);
    if (!room) {
      this.playerRooms.delete(socket.id);
      return null;
    }

    const opponentId = this.getOpponentId(room, socket.id);

    // Nettoyer le tracking utilisateur SEULEMENT pour le joueur qui part
    const leavingPlayer = room.players[socket.id];
    if (leavingPlayer?.user?.userId) {
      this.userSockets.delete(leavingPlayer.user.userId);
    }

    // Supprimer la room et nettoyer les deux joueurs de playerRooms
    this.gameRooms.delete(roomId);
    this.playerRooms.delete(socket.id);
    if (opponentId) {
      this.playerRooms.delete(opponentId);
      // Nettoyer aussi le tracking de l'adversaire car la room n'existe plus
      const opponentPlayer = room.players[opponentId];
      if (opponentPlayer?.user?.userId) {
        this.userSockets.delete(opponentPlayer.user.userId);
      }
    }

    return { opponentId, roomId };
  }

  // Nettoyer quand un joueur se déconnecte
  handleDisconnect(socket) {
    this.leaveAllQueues(socket);
    this.cancelPrivateRoom(socket); // Nettoyer le salon privé si c'était l'hôte
    return this.leaveRoom(socket);
  }
}

module.exports = GameManager;