import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('[DND] main.tsx: starting app mount')

const rootEl = document.getElementById('root')
if (!rootEl) {
  console.error('[DND] root element not found!')
} else {
  console.log('[DND] root element found, creating React root')
  try {
    const root = createRoot(rootEl)
    console.log('[DND] React root created, rendering App')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    console.log('[DND] render() called successfully')
  } catch (err) {
    console.error('[DND] Error during mount:', err)
    rootEl.innerHTML = `<div style="padding: 40px; color: red; font-family: sans-serif;"><h1>Ошибка при загрузке:</h1><pre>${err}</pre></div>`
  }
}
