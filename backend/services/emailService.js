const Resend = require('resend').Resend;

// Vérifier si Resend est configuré
const isEmailConfigured = () => {
  return !!process.env.RESEND_API_KEY;
};

let resend = null;

// Créer le client Resend si configuré
if (isEmailConfigured()) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✅ Email service ready - Resend configured');
} else {
  console.log('⚠️  Email service not configured (missing RESEND_API_KEY)');
  console.log('   Emails will be simulated (logged to console)');
}

/**
 * Simuler l'envoi d'un email (pour développement)
 */
function simulateEmail(to, subject, html) {
  console.log('\n📧 ========== EMAIL SIMULATION ==========');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`HTML Preview: ${html.substring(0, 200)}...`);
  console.log('=========================================\n');
  return true;
}

/**
 * Envoyer un email de vérification
 */
async function sendVerificationEmail(to, username, verificationToken) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; padding: 40px 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 32px; }
        h1 { color: #3b82f6; margin: 0 0 16px 0; font-size: 24px; }
        p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px 0; }
        .button { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
        .button:hover { background: #2563eb; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }
        .code { background: #0f0f23; padding: 12px 16px; border-radius: 8px; font-family: monospace; color: #3b82f6; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Bienvenue sur Mangadle, ${username} !</h1>
        <p>Merci de t'être inscrit. Clique sur le bouton ci-dessous pour confirmer ton adresse email :</p>
        <a href="${verificationUrl}" class="button">Confirmer mon email</a>
        <p>Ou copie ce lien dans ton navigateur :</p>
        <div class="code">${verificationUrl}</div>
        <p class="footer">Ce lien expire dans 24 heures. Si tu n'as pas créé de compte sur Mangadle, ignore cet email.</p>
      </div>
    </body>
    </html>
  `;

  // Si pas de Resend configuré, simuler l'envoi
  if (!resend) {
    return simulateEmail(to, 'Confirme ton compte Mangadle', emailHtml);
  }

  try {
    await resend.emails.send({
      from: 'Mangadle <onboarding@resend.dev>', // ⚠️ Changez ceci une fois votre domaine vérifié
      to: [to],
      subject: 'Confirme ton compte Mangadle',
      html: emailHtml
    });
    console.log(`✅ Verification email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send verification email:', error.message);
    // Simuler l'envoi en cas d'échec
    return simulateEmail(to, 'Confirme ton compte Mangadle', emailHtml);
  }
}

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
async function sendPasswordResetEmail(to, username, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; padding: 40px 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 32px; }
        h1 { color: #3b82f6; margin: 0 0 16px 0; font-size: 24px; }
        p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px 0; }
        .button { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }
        .code { background: #0f0f23; padding: 12px 16px; border-radius: 8px; font-family: monospace; color: #3b82f6; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Réinitialisation du mot de passe</h1>
        <p>Salut ${username}, tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous :</p>
        <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
        <p>Ou copie ce lien dans ton navigateur :</p>
        <div class="code">${resetUrl}</div>
        <p class="footer">Ce lien expire dans 1 heure. Si tu n'as pas demandé cette réinitialisation, ignore cet email.</p>
      </div>
    </body>
    </html>
  `;

  // Si pas de Resend configuré, simuler l'envoi
  if (!resend) {
    return simulateEmail(to, 'Réinitialise ton mot de passe Mangadle', emailHtml);
  }

  try {
    await resend.emails.send({
      from: 'Mangadle <onboarding@resend.dev>', // ⚠️ Changez ceci une fois votre domaine vérifié
      to: [to],
      subject: 'Réinitialise ton mot de passe Mangadle',
      html: emailHtml
    });
    console.log(`✅ Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error.message);
    // Simuler l'envoi en cas d'échec
    return simulateEmail(to, 'Réinitialise ton mot de passe Mangadle', emailHtml);
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};