import { useEffect, useState } from 'react'

/** Matches ThemeProvider: `dark` class on documentElement. */
export function useResolvedTheme(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setMode(root.classList.contains('dark') ? 'dark' : 'light')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => {
      if (!localStorage.getItem('qtelescope-theme') || localStorage.getItem('qtelescope-theme') === 'system') {
        sync()
      }
    }
    mq.addEventListener('change', onMq)
    return () => {
      obs.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [])

  return mode
}
