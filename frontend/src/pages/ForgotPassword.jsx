import { API_URL } from '../api.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, sent
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('loading');

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStatus('idle');
      } else {
        setStatus('sent');
      }
    } catch {
      setError('Erreur de connexion');
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Email envoye</h1>
          <div className="auth-message success">
            <p>Si un compte existe avec cet email, tu recevras un lien de reinitialisation.</p>
            <p>Verifie ta boite mail (et tes spams).</p>
          </div>
          <Link to="/login" className="auth-back">Retour a la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Mot de passe oublie</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <p className="auth-description">
            Entre ton adresse email et nous t'enverrons un lien pour reinitialiser ton mot de passe.
          </p>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={status === 'loading'}>
            {status === 'loading' ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>

        <Link to="/login" className="auth-back">Retour a la connexion</Link>
      </div>
    </div>
  );
}