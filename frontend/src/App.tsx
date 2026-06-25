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
import { ResumeProvider } from './context/ResumeContext'
import { useAuth } from './context/AuthContext'
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

function Nav({ userInitial }: { userInitial: string | null }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
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
        {userInitial && (
          <NavLink to="/profile" className="nav-avatar" aria-label="Your profile">
            {userInitial}
          </NavLink>
        )}
      </div>
    </nav>
  )
}

function HomePage({ connected }: { connected: boolean | null }) {
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
            <h2 className="upload-card-title">Upload your resume</h2>
            <p className="upload-card-sub">PDF or DOCX · 5 MB max</p>
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

      {!onAuthPage && <Nav userInitial={userInitial} />}

      <ResumeProvider>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
