require("dotenv").config();
const PORT = process.env.PORT || 3000;

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// ⭐ IMPORTANT - Trust proxy pour Render (nécessaire pour rate limiting et IP tracking)
app.set('trust proxy', 1);

// Configuration Socket.IO avec CORS
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      process.env.FRONTEND_URL,
      /\.vercel\.app$/, // Accepte tous les domaines Vercel
      /\.railway\.app$/ // ⭐ Accepte tous les domaines Railway
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

const fs = require("fs");
const path = require("path");

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // Désactivé pour permettre le chargement des images
}));

// CORS middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
    /\.vercel\.app$/,
    /\.railway\.app$/ // ⭐ Railway domains
  ].filter(Boolean),
  credentials: true
}));

// Middleware JSON
app.use(express.json());

// Routes d'authentification et stats
const authRoutes = require("./routes/authRoutes");
const statsRoutes = require("./routes/statsRoutes");
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);

// ⭐ NOUVELLE ROUTE - Jeux vidéo
const gamesRoutes = require("./routes/gamesRoutes");
app.use("/api/games", gamesRoutes);

// ★ NOUVEAU - Routes pour la liste d'amis
const friendsRoutes = require("./routes/friendsRoutes");
app.use("/api", friendsRoutes);

// Setup Socket.IO handlers
const setupSocketHandlers = require("./socket/socketHandler");
setupSocketHandlers(io);

// Route de santé (health check)
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "DLE Backend is running",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

// Images statiques avec headers CORS
app.use("/api/images", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "public/images")));

// Routes pour les mangas/animes
app.get("/api/animes", (req, res) => {
    const dossier = path.join(__dirname, "data");

    const fichiers = fs.readdirSync(dossier);
    const fichiersJson = fichiers.filter(f => f.endsWith(".json"));

    const objets = fichiersJson.map(fichier => {
        const contenu = fs.readFileSync(path.join(dossier, fichier), "utf-8");
        return JSON.parse(contenu);
    });

    res.send(objets)
});

app.get("/api/anime/:id", (req, res) => {
  const id = req.params.id;
  const dossier = path.join(__dirname, "data");
  const cheminFichier = path.join(dossier, `${id}.json`);

  if (!fs.existsSync(cheminFichier)) {
    return res.status(404).send("Anime introuvable");
  }

  const contenu = fs.readFileSync(cheminFichier, "utf-8");
  const objet = JSON.parse(contenu);

  res.json(objet);
});


server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Socket.IO enabled for multiplayer`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});