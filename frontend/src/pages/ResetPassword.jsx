import { API_URL } from '../api.js';
import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import './Auth.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStatus('idle');
      } else {
        setStatus('success');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch {
      setError('Erreur de connexion');
      setStatus('idle');
    }
  }

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Lien invalide</h1>
          <div className="auth-message error">
            <p>Ce lien de reinitialisation est invalide.</p>
          </div>
          <Link to="/forgot-password" className="auth-btn">Demander un nouveau lien</Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Mot de passe modifie</h1>
          <div className="auth-message success">
            <p>Ton mot de passe a ete mis a jour avec succes.</p>
            <p>Redirection vers la connexion...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Nouveau mot de passe</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="password">Nouveau mot de passe</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <small>Min 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={status === 'loading'}>
            {status === 'loading' ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>

        <Link to="/login" className="auth-back">Retour a la connexion</Link>
      </div>
    </div>
  );
}