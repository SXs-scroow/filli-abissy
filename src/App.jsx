import { useEffect, useState } from 'react'

export default function App() {
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    import('./legacy/app.js').catch((err) => {
      console.error('Falha ao iniciar A Profecia:', err)
      if (active) setError(err)
    })

    return () => { active = false }
  }, [])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#070606', color: '#f2e7d0', fontFamily: 'Georgia, serif' }}>
        <div style={{ maxWidth: 760, border: '1px solid #7a4b2a', padding: 24, background: '#120d0d' }}>
          <h1>A Profecia não conseguiu iniciar</h1>
          <p>O projeto carregou, mas o sistema interno encontrou um erro.</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#e0b36a' }}>{String(error?.stack || error)}</pre>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="abyss-bg" aria-hidden="true" />
      <div id="root" />
      <div id="global-player" />
      <div id="soundboard-root" />
      <div id="toast-root" aria-live="polite" />
    </>
  )
}
