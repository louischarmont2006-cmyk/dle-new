import { API_URL } from '../api.js';
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import useSocket from "../hooks/useSocket";
import useAuth from "../hooks/useAuth";
import WaitingRoom from "../components/game/WaitingRoom";
import GameModeSelector from "../components/game/GameModeSelector";
import DuoModeSelector from "../components/game/DuoModeSelector";
import CreatePrivateRoom from "../components/game/CreatePrivateRoom";
import JoinPrivateRoom from "../components/game/JoinPrivateRoom";
import TurnIndicator from "../components/game/TurnIndicator";
import Timer from "../components/game/Timer";
import RematchModal from "../components/game/RematchModal";
import ChatBox from "../components/game/ChatBox";
import "./Game.css";

export default function DuoGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  const [localGameData, setLocalGameData] = useState(null);
  const [pool, setPool] = useState([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [statsUpdated, setStatsUpdated] = useState(false);
  
  // ★ NOUVEAU - États pour gérer les modes de jeu
  const [selectedGameMode, setSelectedGameMode] = useState(null); // null | 'turnbased' | 'simultaneous'
  const [duoMode, setDuoMode] = useState(null); // null | 'game-mode-selector' | 'duo-mode-selector' | 'matchmaking' | 'create-private' | 'join-private'

  const searchRef = useRef(null);

  // ⭐ NOUVEAU - Détecter la catégorie basée sur l'URL
  const category = location.pathname.includes('/video-games') || 
                   location.pathname.includes('/game/') ? 'game' : 'anime';

  const {
    connect,
    disconnect,
    isConnected,
    connectionError,
    socketId,
    joinQueue,
    leaveQueue,
    inQueue,
    queuePosition,
    queueError,
    roomId,
    isYourTurn,
    playerName,
    opponentName,
    makeGuess,
    myAttempts,
    opponentAttempts,
    gameOver,
    winner,
    target,
    myScore,
    opponentScore,
    requestRematch,
    rematchRequested,
    opponentWantsRematch,
    opponentDisconnected,
    opponentLeft,
    leaveRoom,
    messages,
    sendChatMessage,
    // ★ NOUVEAU - Fonctions et états pour les salons privés
    createPrivateRoom,
    joinPrivateRoom,
    cancelPrivateRoom,
    privateRoomCode,
    privateRoomError,
    // ★ NOUVEAU - Game mode et timer
    gameMode,
    timer
  } = useSocket(token);

  const [chatOpen, setChatOpen] = useState(false);

  // ⭐ MODIFIÉ - Charger les données selon la catégorie avec retry
  useEffect(() => {
    const endpoint = category === 'game' ? `/api/games/${id}` : `/api/anime/${id}`;
    const fullUrl = `${API_URL}${endpoint}`;
    
    let retryCount = 0;
    const maxRetries = 3;
    
    function loadData() {
      console.log(`Loading ${fullUrl} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      fetch(fullUrl)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          }
          return r.json();
        })
        .then((data) => {
          console.log('Data loaded successfully:', data);
          setLocalGameData(data);
          setPool(data.characters || []);
        })
        .catch((err) => {
          console.error('Error loading data:', err);
          
          // Retry si backend endormi (souvent timeout ou HTML au lieu de JSON)
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying in 2 seconds... (${retryCount}/${maxRetries})`);
            setTimeout(loadData, 2000);
          } else {
            console.error('Max retries reached. Backend may be asleep.');
            alert('Impossible de charger les données. Le serveur met peut-être du temps à démarrer. Veuillez réessayer dans 30 secondes.');
          }
        });
    }
    
    loadData();
  }, [id, category]);

  // Se connecter au serveur Socket.IO
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // ★ MODIFIÉ - Afficher le sélecteur de mode de jeu en premier
  useEffect(() => {
    if (isConnected && localGameData && !roomId && !duoMode) {
      setDuoMode('game-mode-selector'); // Afficher d'abord le sélecteur de mode
    }
  }, [isConnected, localGameData, roomId, duoMode]);

  // ★ NOUVEAU - Réinitialiser duoMode quand un match est trouvé
  useEffect(() => {
    if (roomId) {
      setDuoMode(null); // Reset le mode pour afficher le jeu
    }
  }, [roomId]);

  // Fermer les suggestions au clic exterieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Envoyer les stats duo quand la partie se termine
  useEffect(() => {
    if (!gameOver || statsUpdated || !token || !socketId) return;

    const isWinner = winner === socketId;
    fetch(`${API_URL}/api/stats/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        won: isWinner,
        attempts: myAttempts.length,
        isDuo: true
      })
    }).catch(console.error);

    setStatsUpdated(true);
  }, [gameOver, statsUpdated, token, id, winner, socketId, myAttempts.length]);

  // Reset statsUpdated quand une nouvelle partie commence (rematch)
  useEffect(() => {
    if (!gameOver && statsUpdated) {
      setStatsUpdated(false);
    }
  }, [gameOver, statsUpdated]);

  // ★ MODIFIÉ - Combine toutes les tentatives (moi + adversaire seulement en turnbased)
  const allAttempts = gameMode === 'simultaneous' 
    ? myAttempts.map(a => ({ ...a, isMe: true })) // Mode simultané : seulement mes tentatives
    : [ // Mode tour par tour : toutes les tentatives
        ...myAttempts.map(a => ({ ...a, isMe: true })),
        ...opponentAttempts.map(a => ({ ...a, isMe: false }))
      ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // ★ MODIFIÉ - IDs déjà joués (selon le mode)
  const playedIds = gameMode === 'simultaneous'
    ? new Set(myAttempts.map(a => a.guess.id)) // Mode simultané : seulement mes tentatives
    : new Set([ // Mode tour par tour : toutes les tentatives
        ...myAttempts.map(a => a.guess.id),
        ...opponentAttempts.map(a => a.guess.id)
      ]);

  function validateSelection(char) {
    if (gameOver || (gameMode === 'turnbased' && !isYourTurn)) return;

    if (playedIds.has(char.id)) {
      alert("Ce personnage a deja ete joue !");
      return;
    }

    makeGuess(char);
    setQuery("");
    setShowSuggestions(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && filteredSuggestions.length > 0) {
      validateSelection(filteredSuggestions[0]);
    }
  }

  function handleLeave() {
    leaveRoom();
    setDuoMode(null); // Reset mode
    // ⭐ MODIFIÉ - Retourner à la bonne page selon la catégorie
    if (category === 'game') {
      navigate(`/game/${id}`);
    } else {
      navigate(`/anime/${id}`);
    }
  }

  function handleCancel() {
    // Annuler selon le mode actuel
    if (duoMode === 'matchmaking') {
      leaveQueue(id, category);
    } else if (duoMode === 'create-private') {
      cancelPrivateRoom();
    } else if (duoMode === 'duo-mode-selector') {
      // Retour au sélecteur de mode de jeu
      setDuoMode('game-mode-selector');
      setSelectedGameMode(null);
      return;
    }
    setDuoMode(null); // Retour complet
  }

  // ★ NOUVEAU - Handler pour la sélection du mode de jeu (turnbased/simultaneous)
  function handleGameModeSelect(mode) {
    setSelectedGameMode(mode);
    setDuoMode('duo-mode-selector'); // Passer au sélecteur de connexion
  }

  // ★ NOUVEAU - Handler pour la sélection du mode de connexion (matchmaking/private)
  function handleDuoModeSelect(mode) {
    setDuoMode(mode);
    
    if (mode === 'matchmaking') {
      // Rejoindre la queue publique avec le gameMode
      joinQueue(id, localGameData, category, selectedGameMode);
    } else if (mode === 'create-private') {
      // Créer un salon privé avec le gameMode
      createPrivateRoom(id, localGameData, category, selectedGameMode);
    }
    // join-private sera géré dans le composant JoinPrivateRoom
  }

  // ★ NOUVEAU - Handler pour rejoindre un salon avec un code
  function handleJoinPrivate(code) {
    joinPrivateRoom(code);
  }

  // ★ NOUVEAU - Handler pour annuler le sélecteur
  function handleCancelSelector() {
    setDuoMode(null);
    setSelectedGameMode(null);
    if (category === 'game') {
      navigate(`/game/${id}`);
    } else {
      navigate(`/anime/${id}`);
    }
  }

  const filteredSuggestions = query.trim()
    ? pool.filter((c) => {
        if (playedIds.has(c.id)) return false;
        return c.name.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  // Erreur de connexion
  if (connectionError) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="connection-error">
            <h2>Erreur de connexion</h2>
            <p>{connectionError}</p>
            <button onClick={() => navigate(category === 'game' ? `/game/${id}` : `/anime/${id}`)} className="back-btn">
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Erreur de queue (déjà en partie, etc.)
  if (queueError) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="connection-error">
            <h2>Impossible de rejoindre</h2>
            <p>{queueError}</p>
            <button onClick={() => navigate(category === 'game' ? `/game/${id}` : `/anime/${id}`)} className="back-btn">
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chargement
  if (!localGameData || pool.length === 0) {
    return <div className="loading">Chargement...</div>;
  }

  // ★ NOUVEAU - Afficher le sélecteur de mode de jeu
  if (duoMode === 'game-mode-selector') {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <GameModeSelector
            onSelectMode={handleGameModeSelect}
            onCancel={handleCancelSelector}
            animeName={localGameData.name}
          />
        </div>
      </div>
    );
  }

  // ★ NOUVEAU - Afficher le sélecteur de mode de connexion
  if (duoMode === 'duo-mode-selector') {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <DuoModeSelector
            onSelectMode={handleDuoModeSelect}
            onCancel={handleCancel}
            animeName={localGameData.name}
          />
        </div>
      </div>
    );
  }

  // ★ NOUVEAU - En attente de matchmaking public
  if (duoMode === 'matchmaking' && inQueue) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <WaitingRoom
            position={queuePosition || 1}
            onCancel={handleCancel}
            animeName={localGameData.name}
          />
        </div>
      </div>
    );
  }

  // ★ NOUVEAU - Salon privé créé, en attente d'un adversaire
  if (duoMode === 'create-private' && privateRoomCode) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <CreatePrivateRoom
            roomCode={privateRoomCode}
            onCancel={handleCancel}
            animeName={localGameData.name}
          />
        </div>
      </div>
    );
  }

  // ★ NOUVEAU - Interface pour rejoindre un salon privé
  if (duoMode === 'join-private') {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <JoinPrivateRoom
            onJoin={handleJoinPrivate}
            onCancel={handleCancel}
            animeName={localGameData.name}
            error={privateRoomError}
          />
        </div>
      </div>
    );
  }

  // Pas encore connecte
  if (!isConnected) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="loading">Connexion au serveur...</div>
        </div>
      </div>
    );
  }

  const attributes = localGameData.attributes || [];
  const hintsData = attributes.filter(attr => attr.hints || attr.order);
  const isWinner = winner === socketId;

  // ⭐ MODIFIÉ - Chemin de l'image de fond selon la catégorie
  const backgroundPath = category === 'game' 
    ? `${API_URL}/api/images/games/${id}/${localGameData.background}`
    : `${API_URL}/api/images/${id}/${localGameData.background}`;

  return (
    <div className="game-container duo-mode" style={{ backgroundImage: `url(${backgroundPath})` }}>
      <div className="game-overlay">
        {/* Bouton retour */}
        <div className="nav-back">
          <Link 
            to={category === 'game' ? `/game/${id}` : `/anime/${id}`} 
            className="back-btn" 
            onClick={() => leaveRoom()}
          >
            &larr; Quitter
          </Link>
        </div>

        {/* Header */}
        <div className="game-header">
          <h1 className="game-title">{localGameData.name}</h1>
          <div className="mode-badge">Mode Duo</div>

          {/* Affichage des joueurs et score */}
          <div className="players-display">
            <span className="player-name me">{playerName || "Joueur 1"}</span>
            <span className="session-score">
              <span className="score me">{myScore}</span>
              <span className="score-separator">-</span>
              <span className="score opponent">{opponentScore}</span>
            </span>
            <span className="player-name opponent">{opponentName || "Joueur 2"}</span>
          </div>

          {/* ★ MODIFIÉ - Afficher Timer en mode simultané, TurnIndicator en mode tour par tour */}
          {gameMode === 'simultaneous' && timer ? (
            <Timer 
              startTime={timer.startTime} 
              duration={timer.duration}
              onExpire={() => {/* Géré par le serveur */}}
            />
          ) : (
            <TurnIndicator isYourTurn={isYourTurn} gameOver={gameOver} />
          )}

          {/* Barre de recherche */}
          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              placeholder={gameMode === 'simultaneous' ? "Rechercher un personnage..." : (isYourTurn ? "Rechercher un personnage..." : "Attends ton tour...")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="search-input"
              disabled={gameOver || (gameMode === 'turnbased' && !isYourTurn)}
            />

            {/* Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && !gameOver && (gameMode === 'simultaneous' || isYourTurn) && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.map((char) => {
                  // ⭐ MODIFIÉ - Chemin de l'image selon la catégorie
                  const imagePath = category === 'game'
                    ? `${API_URL}/api/images/games/${id}/characters/${char.image}`
                    : `${API_URL}/api/images/${id}/characters/${char.image}`;
                  
                  return (
                    <button
                      key={char.id}
                      onClick={() => validateSelection(char)}
                      className="suggestion-item"
                    >
                      <div className="suggestion-image">
                        <img src={imagePath} alt={char.name} />
                      </div>
                      <div className="suggestion-name">{char.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Toutes les tentatives combinées */}
        <div className="attempts-section">
          <h3 className="section-title">
            {gameMode === 'simultaneous' 
              ? `Tes essais (${myAttempts.length})`
              : `Essais (${allAttempts.length}) - Toi: ${myAttempts.length} | Adversaire: ${opponentAttempts.length}`
            }
          </h3>
          <div className="attempts-wrapper">
            <div className="attempts-table">
              {/* En-tetes */}
              <div className="table-headers">
                {gameMode !== 'simultaneous' && <div className="table-header">Joueur</div>}
                <div className="table-header">Image</div>
                <div className="table-header">Name</div>
                {attributes.map((attr) => (
                  <div key={attr.key} className="table-header">
                    {attr.label}
                  </div>
                ))}
              </div>

              {/* Lignes */}
              <div className="attempts-list">
                {allAttempts.map((a, i) => {
                  // ⭐ MODIFIÉ - Chemin de l'image selon la catégorie
                  const imagePath = category === 'game'
                    ? `${API_URL}/api/images/games/${id}/characters/${a.guess.image}`
                    : `${API_URL}/api/images/${id}/characters/${a.guess.image}`;
                  
                  return (
                    <div key={i} className={`attempt-row ${a.isMe ? "my-attempt" : "opponent-attempt"}`}>
                      {/* Badge joueur - masqué en mode simultané */}
                      {gameMode !== 'simultaneous' && (
                        <div className={`cell-player ${a.isMe ? "player-me" : "player-opponent"}`}>
                          {a.isMe ? (playerName || "Toi") : (opponentName || "Adv")}
                        </div>
                      )}

                      {/* Image */}
                      <div className="cell-image">
                        <div className="character-image">
                          <img src={imagePath} alt={a.guess.name} />
                        </div>
                      </div>

                      {/* Nom */}
                      <div className={`cell bg-${a.isCorrect ? "correct" : "wrong"}`}>
                        <div className="cell-text">{a.guess.name}</div>
                      </div>

                      {/* Attributs dynamiques */}
                      {attributes.map((attr) => {
                        const fb = a.feedback[attr.key];
                        const showArrow = attr.type === "number" || attr.type === "ordered";
                        const cellClass = showArrow ? "cell-with-arrow" : "cell";

                        return (
                          <div
                            key={attr.key}
                            className={`${cellClass} bg-${fb?.type || "wrong"}`}
                          >
                            <div className="cell-text-sm">
                              {a.guess[attr.key] || "-"}
                            </div>
                            {showArrow && fb?.type === "higher" && <div className="arrow">▼</div>}
                            {showArrow && fb?.type === "lower" && <div className="arrow">▲</div>}
                            {showArrow && fb?.type === "close" && fb?.direction === "higher" && <div className="arrow">▼</div>}
                            {showArrow && fb?.type === "close" && fb?.direction === "lower" && <div className="arrow">▲</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section des indices */}
        {hintsData.length > 0 && (
          <div className="hints-section">
            <button onClick={() => setShowHints(!showHints)} className="hints-toggle">
              {showHints ? "▲ Masquer les indices" : "▼ Afficher les indices"}
            </button>

            {showHints && (
              <div className="hints-content">
                {hintsData.map((attr) => (
                  <div key={attr.key} className="hint-category">
                    <h3 className="hint-title">{attr.label}</h3>
                    <div className="hint-list">
                      {(attr.hints || attr.order || []).map((item, i) => (
                        <div key={i} className="hint-item">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal de fin de partie */}
        {gameOver && (
          <RematchModal
            isWinner={isWinner}
            target={target}
            myAttempts={myAttempts.length}
            opponentAttempts={opponentAttempts.length}
            onRematch={requestRematch}
            onLeave={handleLeave}
            rematchRequested={rematchRequested}
            opponentWantsRematch={opponentWantsRematch}
            opponentDisconnected={opponentDisconnected}
            opponentLeft={opponentLeft}
            gameId={id}
            playerName={playerName}
            opponentName={opponentName}
            myScore={myScore}
            opponentScore={opponentScore}
            category={category}
            gameMode={gameMode} // ★ NOUVEAU
          />
        )}

        {/* Notification adversaire deconnecte pendant la partie */}
        {(opponentDisconnected || opponentLeft) && !gameOver && (
          <div className="opponent-gone-overlay">
            <div className="opponent-gone-modal">
              <h2>{opponentDisconnected ? "Adversaire deconnecte" : "Adversaire parti"}</h2>
              <p>La partie est terminee.</p>
              <button onClick={handleLeave} className="leave-btn">
                Retour
              </button>
            </div>
          </div>
        )}

        {/* Chat */}
        <ChatBox
          messages={messages}
          onSend={sendChatMessage}
          mySocketId={socketId}
          isOpen={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      </div>
    </div>
  );
}