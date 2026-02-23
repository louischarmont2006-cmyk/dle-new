const { verifyToken } = require('./authUtils');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// Middleware optionnel - ajoute req.user si token présent, sinon continue
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
  } catch (error) {
    req.user = null;
  }

  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
