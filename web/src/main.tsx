import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PREVIEW } from './preview/mode'
import './styles.css'

const mount = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// The shareable prototype unpacks its baked layouts and images before the first render.
if (PREVIEW) void import('./preview/load').then((m) => m.ready()).then(mount)
else mount()
