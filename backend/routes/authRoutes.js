const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  findUserByVerificationToken,
  verifyUserEmail,
  createPasswordResetToken,
  findUserByResetToken,
  updateUserPassword,
  resendVerificationToken,
  updateUserAvatar
} = require('../db/database');
const { hashPassword, verifyPassword, generateToken } = require('../auth/authUtils');
const { authMiddleware } = require('../auth/authMiddleware');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives par fenêtre
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives par heure
  message: { error: 'Trop de tentatives de connexion échouées, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Ne compte que les échecs
});

// Validation helpers
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUsername(username) {
  // 2-20 caractères, lettres, chiffres, underscores uniquement
  const usernameRegex = /^[a-zA-Z0-9_]{2,20}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) {
    errors.push('au moins 8 caractères');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('une majuscule');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('une minuscule');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('un chiffre');
  }
  return errors;
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, mot de passe et username requis' });
    }

    // Validation email
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    // Validation username
    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: 'Le pseudo doit faire 2-20 caractères (lettres, chiffres, underscores uniquement)'
      });
    }

    // Validation mot de passe
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir ${passwordErrors.join(', ')}`
      });
    }

    // Vérifier si l'email existe déjà
    const existingEmail = findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Vérifier si le username existe déjà
    const existingUsername = findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    }

    const passwordHash = await hashPassword(password);
    const { id: userId, avatarColor, verificationToken } = createUser(email, passwordHash, username);

    // ⭐ AUTO-VÉRIFIER le compte pour le développement
    // L'email est quand même envoyé (si Resend fonctionne) mais le compte est utilisable immédiatement
    verifyUserEmail(userId);
    console.log('✅ Account auto-verified for development (email still sent)');

    // Envoyer l'email de vérification (optionnel maintenant que le compte est vérifié)
    try {
      await sendVerificationEmail(email, username, verificationToken);
      console.log('✅ Verification email sent to', email);
    } catch (error) {
      console.error('❌ Failed to send verification email (but account is already verified):', error.message);
    }

    const user = { id: userId, username };
    const token = generateToken(user);

    res.status(201).json({
      user: { id: userId, email, username, avatar_color: avatarColor, avatar_image: null, email_verified: 1 }, // ✅ Compte vérifié
      token,
      message: 'Compte créé avec succès ! Vous pouvez jouer immédiatement.' // Message mis à jour
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', [authLimiter, strictLimiter], async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_color: user.avatar_color,
        avatar_image: user.avatar_image,
        email_verified: user.email_verified
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requis' });
    }

    const user = findUserByVerificationToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Vérifier l'expiration
    if (new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expiré, demandez un nouveau lien' });
    }

    verifyUserEmail(user.id);

    res.json({ message: 'Email vérifié avec succès' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, authMiddleware, async (req, res) => {
  try {
    const user = findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }

    const verificationToken = resendVerificationToken(user.id);
    await sendVerificationEmail(user.email, user.username, verificationToken);

    res.json({ message: 'Email de vérification envoyé' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const user = findUserByEmail(email);

    // Toujours répondre OK pour ne pas révéler si l'email existe
    if (!user) {
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    const resetToken = createPasswordResetToken(user.id);
    await sendPasswordResetEmail(email, user.username, resetToken);

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token et mot de passe requis' });
    }

    // Validation mot de passe
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir ${passwordErrors.join(', ')}`
      });
    }

    const user = findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Vérifier l'expiration
    if (new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expiré, demandez un nouveau lien' });
    }

    const passwordHash = await hashPassword(password);
    updateUserPassword(user.id, passwordHash);

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/auth/avatar
router.put('/avatar', authMiddleware, (req, res) => {
  try {
    const { avatarImage } = req.body;
    const userId = req.user.userId;

    // avatarImage peut être null (retour à l'avatar par défaut) ou un chemin d'image
    updateUserAvatar(userId, avatarImage || null);

    const user = findUserById(userId);
    res.json({ user });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;