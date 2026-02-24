// Fonction pour obtenir l'URL du backend selon l'environnement
export function getApiUrl() {
  // En développement, si on est sur localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Localhost → Backend local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // Vercel → Railway
    if (hostname.includes('vercel.app')) {
      return 'https://dle-backend.up.railway.app';
    }
  }
  
  // Fallback : localhost par défaut
  return 'http://localhost:3000';
}

// Export de l'URL pour compatibilité
export const API_URL = getApiUrl();

console.log('🔗 API_URL:', API_URL);