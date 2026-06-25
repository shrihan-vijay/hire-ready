import { useState } from 'react'
import { Logo } from './Logo'
import { useAuth } from '../context/AuthContext'
import './AuthGate.css'

interface Props {
  onGuest: () => void
}

type Mode = 'signin' | 'signup'

export function AuthGate({ onGuest }: Props) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password)
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
        setPassword('')
      } else {
        await signIn(email, password)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate-card">
        <div className="auth-gate-brand">
          <Logo size={36} />
          <span className="auth-gate-brand-name">HireReady</span>
        </div>

        <h1 className="auth-gate-title">
          {mode === 'signin' ? 'Welcome back' : 'Get started'}
        </h1>
        <p className="auth-gate-sub">
          {mode === 'signin'
            ? 'Sign in to access your resumes and scores.'
            : 'Create an account to save your resumes and track your scores.'}
        </p>

        <form className="auth-gate-form" onSubmit={handleSubmit}>
          <input
            className="auth-gate-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="auth-gate-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={6}
          />

          {error && <p className="auth-gate-error">{error}</p>}
          {info && <p className="auth-gate-info">{info}</p>}

          <button className="auth-gate-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="auth-gate-toggle"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>

        <div className="auth-gate-divider">
          <span>or</span>
        </div>

        <button className="auth-gate-guest" onClick={onGuest}>
          Continue without signing in
        </button>
      </div>
    </div>
  )
}
