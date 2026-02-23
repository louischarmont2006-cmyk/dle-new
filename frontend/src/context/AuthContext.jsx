import { API_URL } from '../api.js';
import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));

  // Vérifier le token au montage
  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('Token invalide');
        return r.json();
      })
      .then(data => {
        if (!cancelled) {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erreur de connexion');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, username) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Erreur d'inscription");
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}