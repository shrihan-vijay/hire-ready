import { useState } from 'react'
import { LogOut, Mail, UserCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './ProfilePage.css'

type Mode = 'signin' | 'signup'

export function ProfilePage() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
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

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-spinner" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="profile-page">
        <div className="profile-avatar">
          <UserCircle2 size={40} />
        </div>
        <h1 className="profile-title">Your Account</h1>
        <p className="profile-email">
          <Mail size={14} />
          {user.email}
        </p>
        <button className="profile-signout-btn" onClick={signOut}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-avatar">
        <UserCircle2 size={40} />
      </div>
      <h1 className="profile-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <p className="profile-sub">
        {mode === 'signin'
          ? 'Sign in to save your resumes and track your scores.'
          : 'Create an account to save your resumes and track your scores.'}
      </p>

      <form className="profile-form" onSubmit={handleSubmit}>
        <input
          className="profile-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="profile-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          minLength={6}
        />

        {error && <p className="profile-error">{error}</p>}
        {info && <p className="profile-info">{info}</p>}

        <button className="profile-submit-btn" type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button
        className="profile-toggle"
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
      >
        {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
