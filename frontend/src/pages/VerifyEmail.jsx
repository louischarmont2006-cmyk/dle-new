import { API_URL } from '../api.js';
import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './Auth.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    // Protection contre le double-appel de StrictMode
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Token manquant');
      return;
    }

    fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('error');
          setMessage(data.error);
        } else {
          setStatus('success');
          setMessage(data.message);
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Erreur de connexion');
      });
  }, [searchParams]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Verification Email</h1>

        {status === 'loading' && (
          <div className="auth-message">
            <p>Verification en cours...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-message success">
            <p>{message}</p>
            <Link to="/login" className="auth-btn">Se connecter</Link>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-message error">
            <p>{message}</p>
            <Link to="/login" className="auth-btn">Retour a la connexion</Link>
          </div>
        )}
      </div>
    </div>
  );
}