module.exports = {
  apps: [{
    name: 'dle-backend',
    script: 'main.js',
    env: {
      // Dev
      NODE_ENV: 'development',
      PORT: 3000,
      FRONTEND_URL: 'http://localhost:5173'
    },
    env_production: {
      // Prod
      NODE_ENV: 'production',
      PORT: 3333,
      FRONTEND_URL: 'https://dle.wireredblue.xyz'
    }
  }]
};
