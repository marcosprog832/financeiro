import { useEffect, useState } from 'react'
import { isoDate } from '../lib/format'

// "Hoje" que se atualiza sozinho (virada do dia ou volta para a aba).
export default function useToday() {
  const [today, setToday] = useState(() => isoDate(new Date()))
  useEffect(() => {
    const tick = () => setToday(isoDate(new Date()))
    const id = setInterval(tick, 60000)
    const visible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', visible) }
  }, [])
  return today
}
