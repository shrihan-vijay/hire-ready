import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  FileSearch,
  LoaderCircle,
  Mic,
  ServerCrash,
  Sparkles,
  Target,
} from 'lucide-react'
import { ResumeUpload } from './components/ResumeUpload'
import { HowItWorks } from './components/HowItWorks'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const FEATURES = [
  {
    icon: FileSearch,
    label: 'Resume Parser',
    desc: 'Extracts and analyses your resume content',
  },
  {
    icon: Target,
    label: 'ATS Scoring',
    desc: 'See how you rank against applicant filters',
  },
  {
    icon: Sparkles,
    label: 'JD Matching',
    desc: 'Tailor your resume to any job description',
  },
  {
    icon: Mic,
    label: 'Interview Prep',
    desc: 'AI-generated Q&A based on your resume',
  },
]

function App() {
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    axios
      .get(`${apiBaseUrl}/api/health`)
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  const loading = connected === null

  return (
    <div className="page">
      <div className="blob blob--teal" aria-hidden="true" />
      <div className="blob blob--blue" aria-hidden="true" />

      <nav className="nav">
        <div className="nav-brand">
          <div className="brand-mark">HR</div>
          <span>HireReady</span>
        </div>
        <div
          className={`status-pill ${
            loading
              ? 'status-pill--loading'
              : connected
                ? 'status-pill--online'
                : 'status-pill--offline'
          }`}
        >
          {loading ? (
            <>
              <LoaderCircle size={11} className="spin" aria-hidden="true" />
              Connecting
            </>
          ) : connected ? (
            <span className="status-dot" aria-label="Connected" />
          ) : (
            <>
              <span className="status-dot" aria-hidden="true" />
              Offline
            </>
          )}
        </div>
      </nav>

      <main className="main">
        <div className="hero">
          <div className="hero-badge">
            <Sparkles size={13} aria-hidden="true" />
            Powered by AI
          </div>
          <h1 className="hero-title">
            Land your
            <br />
            <span className="gradient-text">dream job</span>
            <br />
            faster.
          </h1>
          <p className="hero-sub">
            Upload your resume and let AI score it against job descriptions,
            flag gaps, and prepare you for interviews.
          </p>
          <ul className="feature-list" aria-label="Features">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="feature-item">
                <div className="feature-icon-wrap" aria-hidden="true">
                  <Icon size={15} />
                </div>
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

          {!loading && !connected ? (
            <div className="offline-banner" role="alert">
              <ServerCrash size={20} aria-hidden="true" />
              <div>
                <p className="offline-title">Backend offline</p>
                <p className="offline-hint">
                  Run <code>./dev.sh</code> from the project root
                </p>
              </div>
            </div>
          ) : (
            <ResumeUpload />
          )}
        </div>
      </main>

      <HowItWorks />
    </div>
  )
}

export default App
