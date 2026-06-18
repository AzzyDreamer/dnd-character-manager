import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Веб (GitHub Pages) деплоится в подпапку с именем репозитория
// (https://<user>.github.io/dnd-character-manager/), поэтому ассеты резолвятся
// от этого подпути. Десктоп (Tauri, `--mode desktop`) отдаёт фронт с корня
// кастомного протокола — ему нужен base '/'. Vite прокидывает base в
// import.meta.env.BASE_URL, см. src/utils/asset.ts.
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? '/' : '/dnd-character-manager/',
  plugins: [tailwindcss(), react()],
  server: {
    host: '127.0.0.1',
  },
}))
