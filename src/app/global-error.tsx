'use client'
// Catches unhandled errors at the root layout level (including the root layout itself).
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Nexus] Global error:', error)
  }, [error])

  return (
    <html lang="en" className="dark">
      <body style={{ margin: 0, background: '#0d0d0f', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 32,
        }}>
          <div style={{ fontSize: 48 }}>💥</div>
          <h2 style={{ color: '#e8e8ed', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Critical error
          </h2>
          <p style={{ color: '#6b6b75', fontSize: '0.875rem', margin: 0, textAlign: 'center', maxWidth: 400 }}>
            {error.message || 'A critical error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#7c6af7',
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              padding: '10px 24px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
