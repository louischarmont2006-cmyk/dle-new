import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './Auth.css';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, password, username);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Inscription</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Pseudo</label>
            <input
              type="text"
              id="username"
              name="display-name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="off"
            />
            <small>2-20 caracteres, lettres, chiffres et _ uniquement</small>
          </div>

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

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
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

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Inscription...' : "S'inscrire"}
          </button>
        </form>

        <p className="auth-link">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>

        <Link to="/" className="auth-back">Retour à l'accueil</Link>
      </div>
    </div>
  );
}
