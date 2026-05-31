import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Деплой на GitHub Pages идёт в подпапку с именем репозитория
  // (https://<user>.github.io/dnd-character-manager/), поэтому ассеты
  // должны резолвиться от этого подпути. Локальная разработка/preview
  // используют тот же base. См. src/utils/asset.ts.
  base: '/dnd-character-manager/',
  plugins: [tailwindcss(), react()],
  server: {
    host: '127.0.0.1',
  },
})
