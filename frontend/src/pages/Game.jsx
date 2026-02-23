import { API_URL } from '../api.js';
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import DuoGame from "./DuoGame";
import GameNavbar from "../components/GameNavbar";
import useAuth from "../hooks/useAuth";
import "./Game.css";

// ⭐ Détecter le type (anime ou game)
function useGameType() {
  const location = useLocation();
  const isGame = location.pathname.startsWith('/game/');
  const apiPath = isGame ? 'games' : 'anime';
  const imagePath = isGame ? 'games' : '';
  return { isGame, apiPath, imagePath };
}

// Hook pour persister l'état
function useStats(animeId) {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!animeId) return;

    if (token && user) {
      fetch(`${API_URL}/api/stats/${animeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          setStats(data);
          setLoaded(true);
        })
        .catch(() => loadFromLocalStorage());
    } else {
      loadFromLocalStorage();
    }

    function loadFromLocalStorage() {
      try {
        const raw = localStorage.getItem(`stats-${animeId}`);
        if (raw) setStats(JSON.parse(raw));
      } catch { /* ignore parse errors */ }
      setLoaded(true);
    }
  }, [animeId, token, user]);

  const updateStats = useCallback((won, attempts = 0, isDuo = false) => {
    if (token && user) {
      fetch(`${API_URL}/api/stats/${animeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ won, attempts, isDuo })
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setStats(data))
        .catch(() => updateLocalStorage(won));
    } else {
      updateLocalStorage(won);
    }

    function updateLocalStorage(won) {
      setStats(s => {
        const newStats = {
          played: s.played + 1,
          wins: s.wins + (won ? 1 : 0),
          streak: won ? s.streak + 1 : 0,
          maxStreak: Math.max(s.maxStreak, won ? s.streak + 1 : 0)
        };
        try {
          localStorage.setItem(`stats-${animeId}`, JSON.stringify(newStats));
        } catch { /* ignore storage errors */ }
        return newStats;
      });
    }
  }, [animeId, token, user]);

  return { stats, updateStats, loaded };
}

function pickTarget(list) {
  const i = Math.floor(Math.random() * list.length);
  // Don't log the target - it would reveal the answer in console!
  return list[i];
}

function computeFieldFeedback(guessVal, targetVal, attribute) {
  const { type, order, groups, hints } = attribute;

  const gLower = guessVal ? guessVal.toString().toLowerCase().trim() : null;
  const tLower = targetVal ? targetVal.toString().toLowerCase().trim() : null;

  // Si les deux sont identiques, c'est correct
  if (gLower && tLower && gLower === tLower) {
    return { type: "correct", label: guessVal };
  }

  const gIsUnknown = !gLower || gLower === "unknown" || gLower === "none";
  const tIsUnknown = !tLower || tLower === "unknown" || tLower === "none";

  // Pour les types ordered, vérifier si "unknown" ou "none" est dans l'ordre
  if (type === "ordered" && order) {
    const orderLower = order.map(item => item.toLowerCase());
    const unknownInOrder = orderLower.includes("unknown");
    const noneInOrder = orderLower.includes("none");
    
    // Si unknown/none n'est PAS dans l'ordre mais qu'une valeur est unknown/none → wrong
    if (gIsUnknown && !unknownInOrder && !noneInOrder) {
      return { type: "wrong", label: guessVal || "-" };
    }
    if (tIsUnknown && !unknownInOrder && !noneInOrder) {
      return { type: "wrong", label: guessVal || "-" };
    }
  } else if (gIsUnknown || tIsUnknown) {
    return { type: "wrong", label: guessVal || "-" };
  }

  // Type numérique
  if (type === "number") {
    const g = Number(guessVal);
    const t = Number(targetVal);

    if (isNaN(g) || isNaN(t)) {
      return { type: "wrong", label: guessVal };
    }

    if (g === t) return { type: "correct", label: guessVal };
    if (Math.abs(g - t) === 1) return { type: "close", label: guessVal, direction: g > t ? "higher" : "lower" };
    if (g > t) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type ordonné
  if (type === "ordered" && order) {
    // ⭐ LOGIQUE HYBRIDE : Si les deux valeurs sont numériques, comparer comme des nombres
    const gNum = Number(gLower);
    const tNum = Number(tLower);
    const bothAreNumbers = !isNaN(gNum) && !isNaN(tNum);
    
    if (bothAreNumbers) {
      // Comparaison numérique directe (comme type "number")
      if (gNum === tNum) return { type: "correct", label: guessVal };
      if (Math.abs(gNum - tNum) === 1) {
        return { type: "close", label: guessVal, direction: gNum < tNum ? "higher" : "lower" };
      }
      if (gNum < tNum) return { type: "higher", label: guessVal };
      return { type: "lower", label: guessVal };
    }
    
    // Sinon, comparaison ordered classique (pour les strings comme "Wolf", "Dragon", "God")
    const guessIndex = order.findIndex(item => item.toLowerCase() === gLower);
    const targetIndex = order.findIndex(item => item.toLowerCase() === tLower);

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    
    const diff = Math.abs(guessIndex - targetIndex);
    if (diff === 1) {
      return { type: "close", label: guessVal, direction: guessIndex < targetIndex ? "lower" : "higher" };
    }
    
    if (guessIndex < targetIndex) return { type: "lower", label: guessVal };
    return { type: "higher", label: guessVal };
  }

  // Type text-group
  if (type === "text-group" && groups) {
    for (const group of groups) {
      const groupLower = group.map(g => g.toLowerCase());
      const gInGroup = groupLower.includes(gLower);
      const tInGroup = groupLower.includes(tLower);
      
      if (gInGroup && tInGroup) {
        return { type: "close", label: guessVal };
      }
    }
    return { type: "wrong", label: guessVal };
  }

  // Type texte
  const isMaleFemale = (gLower === "male" && tLower === "female") || (gLower === "female" && tLower === "male");

  if (type === "text") {
    // Arc avec ordre défini
    if (order && order.length > 0) {
      return { type: "wrong", label: guessVal };
    }
    
    // Liste fermée avec hints - PAS de matching partiel
    // ⭐ Comparer en retirant les parenthèses des hints (ex: "Ukaku (Ailé)" → "ukaku")
    if (hints && hints.length > 0) {
      const hintsClean = hints.map(h => h.split('(')[0].trim().toLowerCase());
      // Si la valeur est dans la liste des hints, pas de matching partiel
      if (hintsClean.includes(gLower)) {
        return { type: "wrong", label: guessVal };
      }
    }
    
    // Match partiel seulement pour attributs sans hints
    if (!isMaleFemale && (tLower.includes(gLower) || gLower.includes(tLower))) {
      return { type: "close", label: guessVal };
    }
  }

  return { type: "wrong", label: guessVal };
}

function getFeedbackObject(guess, target, attributes) {
  const obj = {};
  attributes.forEach((attr) => {
    obj[attr.key] = computeFieldFeedback(guess[attr.key], target[attr.key], attr);
  });
  return obj;
}

function SoloGame() {
  const { id } = useParams();
  const { apiPath, imagePath } = useGameType();

  const [gameData, setGameData] = useState(null);
  const [pool, setPool] = useState([]);
  const [target, setTarget] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [statsUpdated, setStatsUpdated] = useState(false);

  const { stats, updateStats } = useStats(id);
  const searchRef = useRef(null);

  useEffect(() => {
    const fullUrl = `${API_URL}/api/${apiPath}/${id}`;
    
    let retryCount = 0;
    const maxRetries = 3;
    
    function loadData() {
      fetch(fullUrl)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          }
          return r.json();
        })
        .then((data) => {
          setGameData(data);
          const characters = data.characters || [];
          setPool(characters);
          setTarget(pickTarget(characters));
        })
        .catch((err) => {
          console.error('Error loading data:', err);
          
          // Retry si backend endormi
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(loadData, 2000);
          } else {
            console.error('Max retries reached. Backend may be asleep.');
            alert('Impossible de charger les données. Le serveur met peut-être du temps à démarrer. Veuillez réessayer dans 30 secondes.');
          }
        });
    }
    
    loadData();
  }, [id, apiPath]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!gameOver || statsUpdated) return;
    const won = attempts.some((a) => a.isCorrect);
    updateStats(won, attempts.length, false);
  }, [gameOver, statsUpdated, attempts, updateStats]);

  useEffect(() => {
    if (gameOver && !statsUpdated) {
      const timer = setTimeout(() => setStatsUpdated(true), 0);
      return () => clearTimeout(timer);
    }
  }, [gameOver, statsUpdated]);

  function validateSelection(char) {
    if (gameOver || !target || !gameData) return;

    if (attempts.some((a) => a.guess.id === char.id)) {
      alert("Tu as deja essaye ce personnage !");
      return;
    }

    const isCorrect = char.id === target.id;
    const feedback = getFeedbackObject(char, target, gameData.attributes || []);
    
    // ⭐ FIX: Ajouter la nouvelle tentative AU DÉBUT (unshift au lieu de push)
    const next = [{ guess: char, feedback, isCorrect }, ...attempts];
    setAttempts(next);
    setQuery("");
    setShowSuggestions(false);

    if (isCorrect) {
      setGameOver(true);
      return;
    }
    if (next.length >= (gameData.maxAttempts || 26)) {
      setGameOver(true);
      return;
    }
  }

  function newGame() {
    setTarget(pickTarget(pool));
    setAttempts([]);
    setGameOver(false);
    setStatsUpdated(false);
    setQuery("");
    setShowSuggestions(false);
  }

  function revealAnswer() {
    setGameOver(true);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && filteredSuggestions.length > 0) {
      validateSelection(filteredSuggestions[0]);
    }
  }

  const filteredSuggestions = query.trim()
    ? pool.filter((c) => {
        if (attempts.some((a) => a.guess.id === c.id)) return false;
        return c.name.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  if (!gameData || !target || pool.length === 0) {
    return <div className="loading">Chargement...</div>;
  }

  const attributes = gameData.attributes || [];
  const maxAttempts = gameData.maxAttempts || 26;
  const hintsData = attributes.filter(attr => attr.hints && attr.hints.length > 0);

  const imageBasePath = imagePath ? `${API_URL}/api/images/${imagePath}/${id}` : `${API_URL}/api/images/${id}`;

  return (
    <div className="game-container" style={{ backgroundImage: `url(${imageBasePath}/${gameData.background})` }}>
      <GameNavbar gameId={id} />
      <div className="game-overlay">
        <div className="game-header">
          <h1 className="game-title">{gameData.name}</h1>

          <div className="header-buttons">
            <button onClick={newGame} className="new-game-btn">
              Nouvelle partie
            </button>
            <button onClick={revealAnswer} className="reveal-btn">
              Révéler
            </button>
          </div>

          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              placeholder={`Rechercher un personnage...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="search-input"
              disabled={gameOver}
            />

            {showSuggestions && filteredSuggestions.length > 0 && !gameOver && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => validateSelection(char)}
                    className="suggestion-item"
                  >
                    <div className="suggestion-image">
                      <img src={`${imageBasePath}/characters/${char.image}`} alt={char.name} />
                    </div>
                    <div className="suggestion-name">{char.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="attempts-wrapper">
          <div className="attempts-table">
            <div className="table-headers">
              <div className="table-header">Image</div>
              <div className="table-header">Name</div>
              {attributes.map((attr) => (
                <div key={attr.key} className="table-header">
                  {attr.label}
                </div>
              ))}
            </div>

            <div className="attempts-list">
              {attempts.map((a, i) => (
                <div key={i} className="attempt-row">
                  <div className="cell-image">
                    <div className="character-image">
                      <img src={`${imageBasePath}/characters/${a.guess.image}`} alt={a.guess.name} />
                    </div>
                  </div>

                  <div className={`cell bg-${a.isCorrect ? "correct" : "wrong"}`}>
                    <div className="cell-text">{a.guess.name}</div>
                  </div>

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
              ))}
            </div>
          </div>
        </div>

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

        {gameOver && (
          <div className="game-over-message">
            <div className={`game-over-title ${attempts.some((a) => a.isCorrect) ? "win" : "lose"}`}>
              {attempts.some((a) => a.isCorrect)
                ? attempts.length === 1
                  ? `🎆 ONE Shot !!! Tu as trouvé : ${target.name}`
                  : `🎉 Bravo ! Tu as trouvé : ${target.name}`
                : `😢 La réponse était : ${target.name}`}
            </div>
            <div className="game-over-stats">
              Essais : {attempts.length}/{maxAttempts} |
              Parties : {stats.played} |
              Victoires : {stats.wins} |
              Série : {stats.streak}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Game() {
  const search = new URLSearchParams(useLocation().search);
  const mode = search.get("mode") || "solo";
  const { user, loading } = useAuth();

  if (mode === "duo") {
    if (loading) {
      return <div className="loading">Chargement...</div>;
    }

    if (!user) {
      const returnUrl = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(returnUrl)}`;
      return <div className="loading">Redirection...</div>;
    }

    return <DuoGame />;
  }

  return <SoloGame />;
}