# MANGADLE 2.0 - CORRECTIONS ET AMÉLIORATIONS

## 📋 Vue d'ensemble des corrections

Ce document détaille toutes les corrections apportées au projet Mangadle 2.0 pour résoudre les bugs identifiés.

---

## 🔧 FICHIERS CORRIGÉS

### 1. **feedbackUtils.js** (Backend - Logique de comparaison)

#### Problèmes résolus :

✅ **Comparaison jaune pour attributs similaires** (text-group)
- Jujutsu Kaisen : Tokyo Jujutsu High / Kyoto Jujutsu High / Renchoku Girls' Junior High
- Jujutsu Kaisen : Zenin Clan / Kamo Clan
- Jujutsu Kaisen : Mahito's Group / Geto's Original Group / Kenjaku's Group
- Dragon Ball : Universe 6 / Universe 7 / Universe 10 / Universe 11
- Fire Force : toutes les Special Fire Force Company
- Gachiakuta : Cleaner Team Akuta / Cleaner Team Child / Cleaner
- Etc.

**Solution :** Utilisation du type `"text-group"` avec un tableau `groups` dans les attributs. Les valeurs dans le même groupe retournent `"close"` (jaune).

```javascript
// Exemple dans le JSON
{
  "key": "affiliation",
  "type": "text-group",
  "groups": [
    ["Tokyo Jujutsu High", "Kyoto Jujutsu High", "Renchoku Girls' Junior High"],
    ["Zenin Clan", "Kamo Clan"],
    ["Mahito's Group", "Geto's Original Group", "Kenjaku's Group"]
  ]
}
```

✅ **Pas de comparaison jaune entre éléments ordered (Arcs)**
- Les arcs ne doivent PAS avoir de matching partiel (substring matching)
- Solution : Vérification explicite du type `"ordered"` ou présence d'un `order` pour désactiver le matching partiel

✅ **Comparaison avec flèches pour Rank et Intelligence**
- Hell's Paradise : Rank
- One Punch Man : Rank et Class Rank
- Death Note : Intelligence
- Solution : Ces attributs doivent être de type `"ordered"` avec un tableau `order` défini

✅ **Gestion de "Unknown" dans les ordres**
- Jujutsu Kaisen : Grade (Unknown est entre None et Grade 4)
- Frieren : Mage Rank
- One Punch Man : Rank
- Solution : Si "Unknown" est dans l'array `order`, il est traité comme une valeur normale avec flèches

✅ **Above Dragon vs Dragon (One Punch Man)**
- "Above Dragon" ne doit PAS matcher avec "Dragon"
- Solution : Utilisation de `findIndex` avec égalité stricte (`===`) au lieu de `includes`

✅ **Kagune Type (Tokyo Ghoul)**
- Ukaku, Koukaku, etc. doivent avoir des comparaisons jaunes s'ils sont similaires
- Solution : Soit type `"text-group"` si groupes définis, soit type `"text"` normal

---

### 2. **CharactersTable.jsx** (Frontend - Liste des personnages)

#### Problèmes résolus :

✅ **Tri intelligent selon le type d'attribut**
- Type `"ordered"` : Tri selon l'ordre défini dans le JSON
- Type `"number"` : Tri numérique (pas alphabétique)
- Type `"text"` : Tri alphabétique standard

**Avant :**
- Age "1-20" venait après "100+" (tri alphabétique)
- Grade "Grade 1" venait avant "Grade 2" (tri alphabétique)

**Après :**
- Respect de l'ordre défini dans le JSON
- Les nombres sont triés numériquement

✅ **Affichage des colonnes multiples**
- Ajout du scroll horizontal avec scrollbar visible
- Table responsive qui s'adapte au nombre de colonnes
- Largeur minimale pour éviter l'écrasement

---

### 3. **Game.css** (Frontend - Styles)

#### Problèmes résolus :

✅ **Responsive mobile amélioré**
- Scroll horizontal fluide sur mobile
- Scrollbar visible (desktop + mobile)
- Tailles de cellules adaptées pour mobile
- Header et badges responsive

✅ **Tableau des essais scrollable**
- `-webkit-overflow-scrolling: touch` pour iOS
- Scrollbar stylisée visible
- Largeurs fixes pour les colonnes importantes (Image, Name)

---

## 📝 STRUCTURE DES ATTRIBUTS DANS LES JSON

### Types d'attributs supportés :

#### 1. **text** (Texte simple)
Matching partiel activé (substring matching pour jaune).

```json
{
  "key": "gender",
  "label": "Gender",
  "type": "text"
}
```

#### 2. **text-group** (Texte avec groupes)
Valeurs dans le même groupe = jaune.

```json
{
  "key": "affiliation",
  "label": "Affiliation",
  "type": "text-group",
  "groups": [
    ["Value1", "Value2", "Value3"],
    ["Value4", "Value5"]
  ],
  "hints": ["Value1", "Value2", ...]
}
```

#### 3. **ordered** (Valeurs ordonnées)
Flèches haut/bas, proche si différence de 1.

```json
{
  "key": "grade",
  "label": "Grade",
  "type": "ordered",
  "order": [
    "None",
    "Unknown",
    "Grade 4",
    "Grade 3",
    "Grade 2",
    "Grade 1",
    "Special Grade"
  ]
}
```

#### 4. **number** (Nombres)
Comparaison numérique avec flèches.

```json
{
  "key": "height",
  "label": "Height",
  "type": "number"
}
```

#### 5. **multiple** (Tableaux de valeurs)
Pour les attributs avec plusieurs valeurs (ex: Haki dans One Piece).

```json
{
  "key": "haki",
  "label": "Haki",
  "type": "multiple"
}
```

---

## 🎯 CAS SPÉCIAUX GÉRÉS

### 1. Unknown dans les ordres
Si "Unknown" est dans l'array `order`, il est comparé normalement.

**Exemple Jujutsu Kaisen :**
```
"None" < "Unknown" < "Grade 4" < ... < "Special Grade"
```

### 2. Above Dragon vs Dragon (OPM)
Utilisation de l'égalité stricte pour éviter les faux positifs.

### 3. Male vs Female
Exception explicite pour éviter que "female" matche avec "male" (substring).

### 4. Arcs (First Arc)
Pas de matching partiel même si type="text". Détection via présence de `order`.

---

## 📦 FICHIERS À REMPLACER

1. **Backend :**
   - `/backend/services/feedbackUtils.js`

2. **Frontend :**
   - `/frontend/src/components/CharactersTable.jsx`
   - `/frontend/src/pages/Game.css`

---

## 🔄 MIGRATION DES JSON

Pour que les corrections fonctionnent, les fichiers JSON doivent être mis à jour :

### Exemples de changements nécessaires :

#### Jujutsu Kaisen - Affiliation

**Avant :**
```json
{
  "key": "affiliation",
  "label": "Affiliation",
  "type": "text",
  "hints": [...]
}
```

**Après :**
```json
{
  "key": "affiliation",
  "label": "Affiliation",
  "type": "text-group",
  "groups": [
    ["Tokyo Jujutsu High", "Kyoto Jujutsu High", "Renchoku Girls' Junior High"],
    ["Zenin Clan", "Kamo Clan"],
    ["Mahito's Group", "Geto's Original Group", "Kenjaku's Group"]
  ],
  "hints": [...]
}
```

#### Dragon Ball - Residence

**Avant :**
```json
{
  "key": "residence",
  "label": "Residence",
  "type": "text",
  "hints": [...]
}
```

**Après :**
```json
{
  "key": "residence",
  "label": "Residence",
  "type": "text-group",
  "groups": [
    ["Universe 6", "Universe 7", "Universe 10", "Universe 11"]
  ],
  "hints": [...]
}
```

#### One Punch Man - Rank

**Avant (si c'était text) :**
```json
{
  "key": "rank",
  "label": "Rank",
  "type": "text"
}
```

**Après :**
```json
{
  "key": "rank",
  "label": "Rank",
  "type": "ordered",
  "order": [
    "Wolf",
    "Tiger",
    "Demon",
    "Dragon",
    "Above Dragon",
    "God"
  ]
}
```

---

## ✅ CHECKLIST DE VÉRIFICATION

- [ ] feedbackUtils.js remplacé
- [ ] CharactersTable.jsx remplacé
- [ ] Game.css remplacé
- [ ] JSON mis à jour avec `type: "text-group"` et `groups`
- [ ] JSON mis à jour avec `type: "ordered"` pour les rangs
- [ ] Test : Comparaison jaune entre groupes d'affiliation
- [ ] Test : Pas de jaune entre arcs différents
- [ ] Test : Flèches pour les rangs
- [ ] Test : Unknown dans les ordres
- [ ] Test : Above Dragon ≠ Dragon
- [ ] Test : Tri intelligent dans CharactersList
- [ ] Test : Scroll horizontal sur mobile
- [ ] Test : Toutes les colonnes visibles

---

## 🐛 PROBLÈMES CONNUS RÉSOLUS

| Problème | Statut | Fichier | Solution |
|----------|--------|---------|----------|
| Jaune entre affiliations similaires | ✅ | feedbackUtils.js | text-group + groups |
| Jaune entre arcs | ✅ | feedbackUtils.js | Désactivation matching partiel si order existe |
| Pas de flèches pour Rank/Intelligence | ✅ | feedbackUtils.js | Type ordered |
| Unknown pas comparé | ✅ | feedbackUtils.js | Inclusion dans order |
| Above Dragon = Dragon | ✅ | feedbackUtils.js | Égalité stricte |
| Colonnes écrasées | ✅ | Game.css | min-width + scroll |
| Tri alphabétique au lieu de numérique | ✅ | CharactersTable.jsx | Détection type |
| Responsive mobile cassé | ✅ | Game.css | Media queries |

---

## 📞 SUPPORT

Si un problème persiste après ces corrections, vérifier :

1. Le type de l'attribut dans le JSON
2. La présence de `groups` pour text-group
3. La présence de `order` pour ordered
4. Les valeurs exactes (casse, espaces)

---

*Document créé le 14/02/2026*
*Version Mangadle 2.0*