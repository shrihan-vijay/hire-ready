import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, FileEdit, Loader2, Target } from 'lucide-react'
import { useResume } from '../context/ResumeContext'
import { useAuth } from '../context/AuthContext'
import './AppIntelPage.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type StepStatus = 'pending' | 'running' | 'done'

interface ResearchData {
  company_name: string
  tech_stack: string[]
  culture_signals: string[]
  key_themes: string[]
  role_context: string
}

interface BulletSuggestion {
  original: string
  improved: string
  reason: string
}

interface StrategicQuestion {
  question: string
  why_theyll_ask: string
  category: string
}

const STEPS = [
  { key: 'researcher', num: '01', label: 'Company Research',    sub: 'Extracting culture, tech stack, and role signals', Icon: Building2 },
  { key: 'optimizer',  num: '02', label: 'Resume Optimizer',    sub: 'Rewriting bullets to match company language',      Icon: FileEdit  },
  { key: 'strategist', num: '03', label: 'Strategy Builder',    sub: 'Generating company-specific interview questions',  Icon: Target    },
] as const

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: 'Waiting',
  running: 'Working…',
  done:    'Complete',
}

const Q_TAG: Record<string, string> = {
  technical:   'recon-q-tag--blue',
  situational: 'recon-q-tag--amber',
  behavioral:  'recon-q-tag--purple',
}

export default function AppIntelPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { parseResult, jd: ctxJd } = useResume()
  const { session } = useAuth()

  const incoming = location.state as { job_description?: string; file_id?: string } | null
  const jobDescription = incoming?.job_description ?? ctxJd ?? ''
  const fileId = incoming?.file_id ?? parseResult?.file_id ?? null

  const [steps, setSteps] = useState<Record<string, StepStatus>>({
    researcher: 'running',
    optimizer:  'pending',
    strategist: 'pending',
  })
  const [research,  setResearch]  = useState<ResearchData | null>(null)
  const [bullets,   setBullets]   = useState<BulletSuggestion[]>([])
  const [questions, setQuestions] = useState<StrategicQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done,  setDone]  = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !jobDescription) return
    started.current = true
    void runPipeline()
  }, [])

  async function runPipeline() {
    setError(null)
    try {
      const resp = await fetch(`${apiBaseUrl}/api/app-intel/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ job_description: jobDescription, file_id: fileId }),
      })

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail ?? 'Pipeline failed')
      }

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') {
            setDone(true)
            setSteps({ researcher: 'done', optimizer: 'done', strategist: 'done' })
            return
          }
          try {
            const ev = JSON.parse(raw) as { step?: string; data?: Record<string, unknown>; error?: string }
            if (ev.error) throw new Error(ev.error)
            if (!ev.step || !ev.data) continue

            if (ev.step === 'researcher') {
              setResearch(ev.data as unknown as ResearchData)
              setSteps((p) => ({ ...p, researcher: 'done', optimizer: 'running' }))
            } else if (ev.step === 'optimizer') {
              setBullets((ev.data.bullet_suggestions as BulletSuggestion[]) ?? [])
              setSteps((p) => ({ ...p, optimizer: 'done', strategist: 'running' }))
            } else if (ev.step === 'strategist') {
              setQuestions((ev.data.strategic_questions as StrategicQuestion[]) ?? [])
              setSteps((p) => ({ ...p, strategist: 'done' }))
            }
          } catch (e) {
            if (e instanceof Error) setError(e.message)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  function retry() {
    started.current = false
    setError(null)
    setDone(false)
    setResearch(null)
    setBullets([])
    setQuestions([])
    setSteps({ researcher: 'running', optimizer: 'pending', strategist: 'pending' })
    started.current = true
    void runPipeline()
  }

  if (!jobDescription) {
    return (
      <div className="recon-page">
        <div className="recon-empty">
          <p>No job description found. Analyze a resume on the home page first.</p>
          <button className="recon-back-btn" onClick={() => navigate('/home')}>
            <ArrowLeft size={14} /> Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="recon-page">

      {/* Header */}
      <div className="recon-header">
        <button className="recon-back-btn" onClick={() => navigate('/home')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="recon-hero">
          <h1 className="recon-title">Job Recon</h1>
          <p className="recon-tagline">Know the company before you walk in the door.</p>
          <p className="recon-subtitle">
            3 AI agents run in sequence, researching the company, tailoring your resume, and building your interview strategy.
          </p>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="recon-pipeline">
        {STEPS.map(({ key, num, label, sub, Icon }, i) => {
          const status = steps[key]
          return (
            <div key={key} className={`recon-step recon-step--${status}`}>
              <div className="recon-step-inner">
                <div className="recon-step-icon-wrap">
                  {status === 'done'    ? <CheckCircle2 size={16} /> :
                   status === 'running' ? <Loader2 size={16} className="spin" /> :
                                          <Circle size={16} />}
                </div>
                <div className="recon-step-body">
                  <span className="recon-step-num">Agent {num}</span>
                  <span className="recon-step-label">{label}</span>
                  <span className="recon-step-sub">{sub}</span>
                  <span className={`recon-step-status recon-step-status--${status}`}>
                    {status === 'running' && <Loader2 size={10} className="spin" />}
                    {STATUS_TEXT[status]}
                  </span>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="recon-step-arrow">
                  <ArrowRight size={14} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="recon-error">
          <span>{error}</span>
          <button className="recon-retry-btn" onClick={retry}>Retry</button>
        </div>
      )}

      {/* Company Research Card */}
      {research && (
        <div className="recon-card recon-card--indigo">
          <div className="recon-card-header recon-card-header--indigo">
            <Building2 size={14} />
            <span>Agent 01 · Company Research</span>
            <span className="recon-done-badge">Complete</span>
          </div>
          <div className="recon-card-body">
            {research.company_name && research.company_name !== 'Unknown' && (
              <h2 className="recon-company">{research.company_name}</h2>
            )}
            {research.role_context && (
              <blockquote className="recon-role-context">{research.role_context}</blockquote>
            )}
            <div className="recon-grid">
              {research.tech_stack.length > 0 && (
                <div className="recon-field">
                  <span className="recon-field-label">Tech Stack</span>
                  <div className="recon-chips">
                    {research.tech_stack.map((t) => <span key={t} className="recon-chip recon-chip--blue">{t}</span>)}
                  </div>
                </div>
              )}
              {research.culture_signals.length > 0 && (
                <div className="recon-field">
                  <span className="recon-field-label">Culture Signals</span>
                  <div className="recon-chips">
                    {research.culture_signals.map((c) => <span key={c} className="recon-chip recon-chip--purple">{c}</span>)}
                  </div>
                </div>
              )}
              {research.key_themes.length > 0 && (
                <div className="recon-field">
                  <span className="recon-field-label">Key Themes</span>
                  <div className="recon-chips">
                    {research.key_themes.map((t) => <span key={t} className="recon-chip recon-chip--green">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resume Optimizer Card */}
      {bullets.length > 0 && (
        <div className="recon-card recon-card--green">
          <div className="recon-card-header recon-card-header--green">
            <FileEdit size={14} />
            <span>Agent 02 · Resume Optimizer</span>
            <span className="recon-done-badge">Complete</span>
          </div>
          <div className="recon-card-body">
            <p className="recon-card-desc">Rewrites tuned to this company's language and priorities.</p>
            <div className="recon-bullets">
              {bullets.map((b, i) => (
                <div key={i} className="recon-bullet">
                  <div className="recon-bullet-before">
                    <span className="recon-bullet-label recon-bullet-label--before">Before</span>
                    <p>{b.original}</p>
                  </div>
                  <div className="recon-bullet-arrow">↓</div>
                  <div className="recon-bullet-after">
                    <span className="recon-bullet-label recon-bullet-label--after">After</span>
                    <p>{b.improved}</p>
                  </div>
                  <p className="recon-bullet-reason">
                    <span className="recon-reason-prefix">Why: </span>{b.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strategy Builder Card */}
      {questions.length > 0 && (
        <div className="recon-card recon-card--amber">
          <div className="recon-card-header recon-card-header--amber">
            <Target size={14} />
            <span>Agent 03 · Strategy Builder</span>
            <span className="recon-done-badge">Complete</span>
          </div>
          <div className="recon-card-body">
            <p className="recon-card-desc">Questions grounded in this company's specific context — not generic prep.</p>
            <div className="recon-questions">
              {questions.map((q, i) => (
                <div key={i} className="recon-question">
                  <div className="recon-q-top">
                    <span className="recon-q-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="recon-q-main">
                      <p className="recon-q-text">{q.question}</p>
                      <span className={`recon-q-tag ${Q_TAG[q.category] ?? 'recon-q-tag--purple'}`}>
                        {q.category}
                      </span>
                    </div>
                  </div>
                  <div className="recon-q-why">
                    <span className="recon-q-why-label">Why they'll ask</span>
                    <p>{q.why_theyll_ask}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="recon-actions">
          <button
            className="recon-action-btn recon-action-btn--ghost"
            onClick={() => navigate('/interview', { state: { file_id: fileId, job_description: jobDescription } })}
          >
            Prep for Interview
          </button>
          <button
            className="recon-action-btn recon-action-btn--primary"
            onClick={() => navigate('/home')}
          >
            Back to Home
          </button>
        </div>
      )}

    </div>
  )
}
