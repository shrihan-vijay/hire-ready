import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Clock,
  FileSearch,
  Home,
  LoaderCircle,
  Mic,
  ServerCrash,
  Sparkles,
  Target,
} from 'lucide-react'
import { ResumeUpload } from './components/ResumeUpload'
import { HowItWorks } from './components/HowItWorks'
import { Logo } from './components/Logo'
import { AuthGate } from './components/AuthGate'
import { ProfilePage } from './pages/ProfilePage'
import { InterviewPage } from './pages/InterviewPage'
import { HistoryPage } from './pages/HistoryPage'
import AppIntelPage from './pages/AppIntelPage'
import { ResumeProvider, useResume } from './context/ResumeContext'
import { useAuth } from './context/AuthContext'
import { ChatBot } from './components/ChatBot'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const FEATURES = [
  { icon: FileSearch, label: 'Resume Parser',  desc: 'Extracts and analyses your resume content' },
  { icon: Target,     label: 'ATS Scoring',    desc: 'See how you rank against applicant filters' },
  { icon: Sparkles,   label: 'JD Matching',    desc: 'Tailor your resume to any job description' },
  { icon: Mic,        label: 'Interview Prep', desc: 'AI-generated Q&A based on your resume' },
]

const NAV_TABS = [
  { to: '/home',      label: 'Home',          icon: Home },
  { to: '/interview', label: 'Interview Prep', icon: Mic  },
  { to: '/history',   label: 'History',        icon: Clock },
]

function Nav({ userInitial, onLogoClick, onSignIn }: { userInitial: string | null; onLogoClick?: () => void; onSignIn?: () => void }) {
  return (
    <nav className="nav">
      <div
        className="nav-brand"
        onClick={onLogoClick}
        role={onLogoClick ? 'button' : undefined}
        tabIndex={onLogoClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onLogoClick?.()}
        style={{ cursor: onLogoClick ? 'pointer' : undefined }}
      >
        <Logo size={30} />
        <span>HireReady</span>
      </div>

      <div className="nav-tabs">
        {NAV_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab--active' : ''}`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="nav-right">
        {userInitial ? (
          <NavLink to="/profile" className="nav-avatar" aria-label="Your profile">
            {userInitial}
          </NavLink>
        ) : (
          <button className="nav-signin" onClick={onSignIn}>
            Sign in
          </button>
        )}
      </div>
    </nav>
  )
}

function HomePage({ connected }: { connected: boolean | null }) {
  const { parseResult, analyzeResult } = useResume()

  const cardTitle = analyzeResult
    ? 'Your ATS results'
    : parseResult
    ? 'Match to a job'
    : 'Upload your resume'

  const cardSub = analyzeResult
    ? parseResult?.filename ?? ''
    : parseResult
    ? 'Paste a JD or drop a URL to get your ATS score'
    : 'PDF or DOCX · 5 MB max'

  return (
    <>
      <main className="main">
        <div className="hero">
          <div className="hero-badge">
            <Sparkles size={13} aria-hidden="true" />
            Powered by AI
          </div>
          <h1 className="hero-title">
            Land your<br />
            <span className="gradient-text">dream job</span><br />
            faster.
          </h1>
          <p className="hero-sub">
            Upload your resume and let AI score it against job descriptions,
            flag gaps, and prepare you for interviews.
          </p>
          <ul className="feature-list" aria-label="Features">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="feature-item">
                <div className="feature-icon-wrap" aria-hidden="true"><Icon size={15} /></div>
                <div>
                  <span className="feature-label">{label}</span>
                  <span className="feature-desc">{desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="upload-card">
          <div className="upload-card-header">
            <h2 className="upload-card-title">{cardTitle}</h2>
            {cardSub && <p className="upload-card-sub">{cardSub}</p>}
          </div>

          {connected === false ? (
            <div className="offline-banner" role="alert">
              <ServerCrash size={20} aria-hidden="true" />
              <div>
                <p className="offline-title">Backend offline</p>
                <p className="offline-hint">Run <code>./dev.sh</code> from the project root</p>
              </div>
            </div>
          ) : (
            <ResumeUpload />
          )}
        </div>
      </main>

      <HowItWorks />

      <section className="score-guide" id="score-guide">
        <h2 className="score-guide-title">What does your ATS score mean?</h2>
        <p className="score-guide-sub">
          ATS (Applicant Tracking Systems) filter resumes before a human ever sees them.
          Your score reflects how well your resume's language and skills align with the job description.
        </p>
        <div className="score-guide-grid">
          {[
            { range: '0 – 40',   label: 'Needs work',      color: '#ef4444', bg: '#fee2e2', border: '#fecaca', desc: "Major gaps between your resume and this role. The JD likely contains many skills and keywords that don't appear in your resume at all. Significant tailoring needed before applying." },
            { range: '41 – 60',  label: 'Partial match',   color: '#f59e0b', bg: '#fef3c7', border: '#fde68a', desc: "Some overlap exists but key requirements are missing. You may have the experience — it's just not phrased in a way ATS systems recognise. Rewrite to mirror the JD's exact language." },
            { range: '61 – 79',  label: 'Good match',      color: '#3b82f6', bg: '#dbeafe', border: '#bfdbfe', desc: "Strong alignment with the role. A few targeted additions — filling in the flagged missing skills and mirroring more of the JD's phrasing — could push you into the top tier of applicants." },
            { range: '80 – 100', label: 'Excellent match', color: '#22c55e', bg: '#dcfce7', border: '#bbf7d0', desc: 'Your resume speaks directly to this role. The keywords, skills, and experience align tightly with what the employer asked for. Apply with confidence — your resume will clear the filter.' },
          ].map(({ range, label, color, bg, border, desc }) => (
            <div key={range} className="score-guide-card" style={{ borderColor: border, background: bg }}>
              <div className="score-guide-card-header">
                <span className="score-guide-range" style={{ color }}>{range}</span>
                <span className="score-guide-label" style={{ color }}>{label}</span>
              </div>
              <p className="score-guide-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function AppInner({
  userInitial, connected, isAuthed, onAuthPage, handleGuest, handleSignIn,
}: {
  userInitial: string | null
  connected: boolean | null
  isAuthed: boolean
  onAuthPage: boolean
  handleGuest: () => void
  handleSignIn: () => void
}) {
  const { parseResult, analyzeResult, clearAll } = useResume()
  const navigate = useNavigate()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  function handleLogoClick() {
    if (parseResult || analyzeResult) {
      setShowResetConfirm(true)
    } else {
      navigate('/home')
    }
  }

  function confirmReset() {
    clearAll()
    setShowResetConfirm(false)
    navigate('/home', { replace: true })
  }

  return (
    <>
      {!onAuthPage && <Nav userInitial={userInitial} onLogoClick={handleLogoClick} onSignIn={handleSignIn} />}

      {showResetConfirm && (
        <div className="reset-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="reset-modal">
            <p className="reset-modal-title" id="reset-title">Start over?</p>
            <p className="reset-modal-sub">This will clear your uploaded resume and results.</p>
            <div className="reset-modal-actions">
              <button className="reset-modal-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="reset-modal-confirm" onClick={confirmReset}>Yes, restart</button>
            </div>
          </div>
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={isAuthed ? <Navigate to="/home" replace /> : <AuthGate onGuest={handleGuest} />}
        />
        <Route
          path="/home"
          element={isAuthed ? <HomePage connected={connected} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/interview"
          element={isAuthed ? <InterviewPage /> : <Navigate to="/" replace />}
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={isAuthed ? <HistoryPage /> : <Navigate to="/" replace />} />
        <Route path="/apply" element={isAuthed ? <AppIntelPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {isAuthed && !onAuthPage && <ChatBot />}
    </>
  )
}

function AppShell() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [guestMode, setGuestMode] = useState(() => sessionStorage.getItem('guestMode') === '1')
  const prevUserRef = useRef(user)

  useEffect(() => {
    axios
      .get(`${apiBaseUrl}/api/health`)
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  useEffect(() => {
    if (prevUserRef.current !== null && user === null) {
      sessionStorage.removeItem('guestMode')
      setGuestMode(false)
      navigate('/', { replace: true })
    }
    prevUserRef.current = user
  }, [user, navigate])

  function handleGuest() {
    sessionStorage.setItem('guestMode', '1')
    setGuestMode(true)
    navigate('/home', { replace: true })
  }

  function handleSignIn() {
    sessionStorage.removeItem('guestMode')
    setGuestMode(false)
    navigate('/', { replace: true })
  }

  const isAuthed = user !== null || guestMode
  const onAuthPage = location.pathname === '/'
  const userInitial = user?.email?.[0].toUpperCase() ?? null

  if (loading) {
    return (
      <div className="page">
        <div className="blob blob--teal" aria-hidden="true" />
        <div className="blob blob--blue" aria-hidden="true" />
        <div className="auth-loading">
          <LoaderCircle size={28} className="spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="blob blob--teal" aria-hidden="true" />
      <div className="blob blob--blue" aria-hidden="true" />

      <ResumeProvider key={user?.id ?? 'logged-out'}>
        <AppInner
          userInitial={userInitial}
          connected={connected}
          isAuthed={isAuthed}
          onAuthPage={onAuthPage}
          handleGuest={handleGuest}
          handleSignIn={handleSignIn}
        />
      </ResumeProvider>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
