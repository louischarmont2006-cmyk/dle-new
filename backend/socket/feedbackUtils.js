// Calcul du feedback pour un champ
function computeFieldFeedback(guessVal, targetVal, attribute) {
  const { type, order, groups, hints } = attribute;

  // Type multiple (tableaux de valeurs, ex: haki)
  if (type === "multiple") {
    const gArray = Array.isArray(guessVal) ? guessVal : [];
    const tArray = Array.isArray(targetVal) ? targetVal : [];
    const gSet = new Set(gArray.map(v => v.toLowerCase()));
    const tSet = new Set(tArray.map(v => v.toLowerCase()));

    const label = gArray.length > 0 ? gArray.join(", ") : "None";

    if (gSet.size === 0 && tSet.size === 0) {
      return { type: "correct", label };
    }

    if (gSet.size === 0 || tSet.size === 0) {
      return { type: "wrong", label };
    }

    if (gSet.size === tSet.size && [...gSet].every(v => tSet.has(v))) {
      return { type: "correct", label };
    }

    const hasCommon = [...gSet].some(v => tSet.has(v));
    if (hasCommon) {
      return { type: "close", label };
    }

    return { type: "wrong", label };
  }

  const gLower = guessVal ? guessVal.toString().toLowerCase().trim() : null;
  const tLower = targetVal ? targetVal.toString().toLowerCase().trim() : null;

  // Si les deux sont identiques (y compris "unknown" === "unknown"), c'est correct
  if (gLower && tLower && gLower === tLower) {
    return { type: "correct", label: guessVal };
  }

  // Vérifier si un des deux est vide ou "unknown" ou "none"
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

  // Type ordonné (ex: arcs, ranks)
  if (type === "ordered" && order) {
    // ⭐ LOGIQUE HYBRIDE : Si les deux valeurs sont numériques, comparer comme des nombres
    const gNum = Number(gLower);
    const tNum = Number(tLower);
    const bothAreNumbers = !isNaN(gNum) && !isNaN(tNum);
    
    if (bothAreNumbers) {
      // Comparaison numérique directe (comme type "number")
      if (gNum === tNum) return { type: "correct", label: guessVal };
      if (Math.abs(gNum - tNum) === 1) {
        return { type: "close", label: guessVal, direction: gNum > tNum ? "higher" : "lower" };
      }
      if (gNum > tNum) return { type: "higher", label: guessVal };
      return { type: "lower", label: guessVal };
    }
    
    // Sinon, comparaison ordered classique (pour les strings)
    // Utiliser une correspondance exacte pour éviter les faux positifs (Dragon vs Above Dragon)
    const guessIndex = order.findIndex(item => item.toLowerCase() === gLower);
    const targetIndex = order.findIndex(item => item.toLowerCase() === tLower);

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    
    const diff = Math.abs(guessIndex - targetIndex);
    if (diff === 1) {
      // Close si différence de 1
      return { type: "close", label: guessVal, direction: guessIndex < targetIndex ? "lower" : "higher" };
    }
    
    // Higher/Lower
    if (guessIndex < targetIndex) return { type: "lower", label: guessVal };
    return { type: "higher", label: guessVal };
  }

  // ⭐ Type text-group - groupes de valeurs considérées comme "proches"
  if (type === "text-group" && groups) {
    // Chercher si les deux valeurs sont dans le même groupe
    for (const group of groups) {
      const groupLower = group.map(g => g.toLowerCase());
      
      // Vérifier si guess et target sont tous les deux dans ce groupe
      const gInGroup = groupLower.includes(gLower);
      const tInGroup = groupLower.includes(tLower);
      
      if (gInGroup && tInGroup) {
        // Les deux sont dans le même groupe ET ne sont pas identiques → JAUNE
        return { type: "close", label: guessVal };
      }
    }
    // Sinon, c'est wrong (pas de matching partiel pour text-group)
    return { type: "wrong", label: guessVal };
  }

  // Exception pour male/female (female contient male mais c'est pas un match)
  const isMaleFemale = (gLower === "male" && tLower === "female") || (gLower === "female" && tLower === "male");

  // ⭐ Type texte - PAS de matching partiel SI hints définis (liste fermée)
  if (type === "text") {
    // Vérifier si l'attribut a un ordre défini (arc)
    if (order && order.length > 0) {
      return { type: "wrong", label: guessVal };
    }
    
    // ⭐ Si l'attribut a des hints définis, c'est une liste fermée
    // donc PAS de matching partiel (ex: Kagune Type, Occupation avec liste)
    if (hints && hints.length > 0) {
      return { type: "wrong", label: guessVal };
    }
    
    // Match partiel SEULEMENT pour les attributs sans hints (affiliations libres, etc.)
    if (!isMaleFemale && (tLower.includes(gLower) || gLower.includes(tLower))) {
      return { type: "close", label: guessVal };
    }
  }

  return { type: "wrong", label: guessVal };
}

// Calcul du feedback pour tous les attributs
function getFeedbackObject(guess, target, attributes) {
  const obj = {};
  attributes.forEach((attr) => {
    obj[attr.key] = computeFieldFeedback(guess[attr.key], target[attr.key], attr);
  });
  return obj;
}

module.exports = { computeFieldFeedback, getFeedbackObject };