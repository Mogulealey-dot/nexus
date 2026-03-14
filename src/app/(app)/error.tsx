'use client'
// Next.js App Router error boundary — catches unhandled errors in the (app) route group.
// Must be a Client Component.
import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Nexus] Unhandled app error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d0d0f] gap-4 px-6">
      <div className="text-5xl select-none">💥</div>
      <h2 className="text-lg font-bold text-[#e8e8ed]">Something went wrong</h2>
      <p className="text-sm text-[#6b6b75] text-center max-w-sm">
        {error.message || 'An unexpected error occurred. Your notes are safe — this is a display error.'}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 text-sm bg-[#7c6af7] hover:bg-[#9080ff] text-white font-semibold px-5 py-2.5 rounded-full transition-colors"
      >
        <RotateCcw size={13} />
        Try again
      </button>
    </div>
  )
}
