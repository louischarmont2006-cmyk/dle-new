import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    },
    historyApiFallback: true
  },
  build: {
    // Force la régénération complète des fichiers JS
    // pour vider le cache de Vercel
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
        // Force un nouveau hash à chaque build
        manualChunks: undefined
      }
    },
    // Vide le cache Vite
    emptyOutDir: true
  }
})
