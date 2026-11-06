import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PlayerDemo from './dev/PlayerDemo.tsx'

// 개발용 미리보기: ?demo=player
const demo = new URLSearchParams(location.search).get('demo')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {demo === 'player' ? <PlayerDemo /> : <App />}
  </StrictMode>,
)
