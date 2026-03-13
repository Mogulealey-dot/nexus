'use client'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function LoginForm() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password)
      if (err) setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7c6af7] to-[#9080ff] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8ed] tracking-tight">Project Nexus</h1>
          <p className="text-sm text-[#6b6b75] mt-1">The world&apos;s best note-taking app</p>
        </div>

        <div className="bg-[#141416] border border-[#1e1e22] rounded-2xl p-6">
          <div className="flex mb-6 bg-[#0d0d0f] rounded-xl p-1">
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-all ${mode === m ? 'bg-[#1a1a1d] text-[#e8e8ed] shadow-sm' : 'text-[#6b6b75] hover:text-[#a0a0aa]'}`}
              >{m === 'signin' ? 'Sign In' : 'Sign Up'}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-[#0d0d0f] border border-[#1e1e22] rounded-xl px-4 py-3 text-sm text-[#e8e8ed] placeholder-[#3a3a3f] outline-none focus:border-[#7c6af7] transition-colors"
            />
            <input
              type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-[#0d0d0f] border border-[#1e1e22] rounded-xl px-4 py-3 text-sm text-[#e8e8ed] placeholder-[#3a3a3f] outline-none focus:border-[#7c6af7] transition-colors"
            />
            {error && <p className="text-xs text-[#f56565]">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#7c6af7] to-[#9080ff] text-white py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >{loading ? '…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#1e1e22]" />
            <span className="text-xs text-[#3a3a3f]">or</span>
            <div className="flex-1 h-px bg-[#1e1e22]" />
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 bg-[#0d0d0f] border border-[#1e1e22] text-[#a0a0aa] py-3 rounded-xl text-sm hover:border-[#2a2a2e] hover:text-[#e8e8ed] transition-colors"
          >
            <span>🔵</span> Continue with Google
          </button>
        </div>

        <p className="text-center text-xs text-[#3a3a3f] mt-4">
          🔒 Local-first · End-to-end encrypted · Your data, always
        </p>
      </div>
    </div>
  )
}
