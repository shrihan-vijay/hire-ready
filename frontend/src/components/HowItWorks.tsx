import { Fragment, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Mic,
  Sparkles,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import './HowItWorks.css'

/* ── Step 1: Upload ────────────────────────────────────── */

function UploadMock() {
  return (
    <div className="mock mock-upload">
      <div className="mock-zone">
        <UploadCloud size={38} className="mock-cloud" aria-hidden="true" />
        <p className="mock-zone-title">Drag &amp; drop your resume</p>
        <p className="mock-zone-hint">PDF or DOCX · 5 MB max</p>
      </div>
      <div className="mock-file-row">
        <FileText size={18} className="mock-file-icon" aria-hidden="true" />
        <div className="mock-file-info">
          <span className="mock-filename">resume_2024.pdf</span>
          <span className="mock-filesize">142 KB · ready to upload</span>
        </div>
        <CheckCircle2 size={18} className="mock-file-check" aria-hidden="true" />
      </div>
      <div className="mock-upload-btn">Upload Resume</div>
    </div>
  )
}

/* ── Step 2: ATS Score (animated ring + counter) ───────── */

const BARS = [
  { label: 'Keywords', pct: 82 },
  { label: 'Skills',   pct: 64 },
  { label: 'Format',   pct: 91 },
]
const SCORE_TARGET = 78
const R = 50
const CIRC = 2 * Math.PI * R

function ScoreMock() {
  const [score, setScore] = useState(0)

  useEffect(() => {
    let raf: number
    const start = performance.now()
    const duration = 1200

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setScore(Math.round(SCORE_TARGET * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const dashFilled = (score / 100) * CIRC

  return (
    <div className="mock mock-score">
      <p className="mock-score-job">Senior Frontend Engineer · Google</p>
      <div className="mock-score-body">
        <div className="mock-ring-wrap" aria-label={`ATS score ${score}%`}>
          <svg viewBox="0 0 120 120" className="mock-ring">
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f766e" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke="url(#scoreGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dashFilled} ${CIRC}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="mock-ring-label">
            <span className="mock-ring-number">{score}</span>
            <span className="mock-ring-pct">%</span>
            <span className="mock-ring-sub">ATS Match</span>
          </div>
        </div>

        <div className="mock-bars">
          {BARS.map(({ label, pct }) => (
            <div key={label} className="mock-bar-row">
              <span className="mock-bar-label">{label}</span>
              <div className="mock-bar-track">
                <div
                  className="mock-bar-fill"
                  style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
                />
              </div>
              <span className="mock-bar-pct">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Step 3: Gap Analysis ──────────────────────────────── */

const SKILLS = [
  { name: 'React',      has: true  },
  { name: 'TypeScript', has: true  },
  { name: 'Node.js',    has: true  },
  { name: 'Python',     has: true  },
  { name: 'Docker',     has: false },
  { name: 'Kubernetes', has: false },
  { name: 'AWS',        has: false },
  { name: 'GraphQL',    has: false },
]
const MISSING_KW = ['CI/CD pipelines', 'System design', 'Distributed systems']

function GapMock() {
  return (
    <div className="mock mock-gap">
      <p className="mock-gap-heading">Skills Gap Analysis</p>
      <div className="mock-skills-grid">
        {SKILLS.map(({ name, has }) => (
          <div
            key={name}
            className={`mock-skill ${has ? 'mock-skill--has' : 'mock-skill--missing'}`}
          >
            {has
              ? <CheckCircle2 size={12} aria-hidden="true" />
              : <XCircle size={12} aria-hidden="true" />}
            {name}
          </div>
        ))}
      </div>
      <div className="mock-gap-keywords">
        <p className="mock-gap-kw-label">Missing from job description:</p>
        <div className="mock-kw-tags">
          {MISSING_KW.map((kw) => (
            <span key={kw} className="mock-kw-tag">{kw}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Step 4: Interview Prep ────────────────────────────── */

function InterviewMock() {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="mock mock-interview">
      <div className="mock-interview-badge">
        <Mic size={13} aria-hidden="true" />
        Behavioral Question #1
      </div>

      <p className="mock-question">
        "Tell me about a time you had to debug a critical production issue under
        pressure. What was your approach?"
      </p>

      <div className="mock-textarea-wrap">
        <textarea
          className="mock-answer-textarea"
          placeholder="Type your answer here…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          aria-label="Your answer"
        />
        {answer.length > 0 && (
          <span className="mock-char-count">{answer.length} chars</span>
        )}
      </div>

      {!revealed ? (
        <button className="mock-reveal-btn" onClick={() => setRevealed(true)}>
          <Sparkles size={13} aria-hidden="true" />
          See AI-suggested answer
        </button>
      ) : (
        <div className="mock-suggested">
          <p className="mock-suggested-label">
            <Sparkles size={12} aria-hidden="true" />
            Suggested · STAR method
          </p>
          <p className="mock-suggested-text">
            "At my last role, our payment service went down at peak load. I
            isolated it to a recent deploy, rolled back in 8 minutes, and sent
            stakeholder updates every 10 minutes until resolved."
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Step definitions ──────────────────────────────────── */

const STEPS = [
  {
    id: 'upload',
    label: 'Upload',
    title: 'Upload your resume',
    description:
      'Drop your PDF or DOCX and we instantly extract every skill, keyword, and experience line — no copy-paste needed.',
    Preview: UploadMock,
  },
  {
    id: 'score',
    label: 'ATS Score',
    title: 'Get your ATS score',
    description:
      'Paste any job description and we score your resume against it — keyword coverage, skill match, and formatting quality.',
    Preview: ScoreMock,
  },
  {
    id: 'gaps',
    label: 'Gap Analysis',
    title: "See what you're missing",
    description:
      "We highlight every keyword and skill the job requires that isn't in your resume, so you know exactly what to add.",
    Preview: GapMock,
  },
  {
    id: 'interview',
    label: 'Interview Prep',
    title: 'Ace the interview',
    description:
      'Get AI-generated behavioral and technical questions tailored to the role, with STAR-method coaching on every answer.',
    Preview: InterviewMock,
  },
]

/* ── Component ─────────────────────────────────────────── */

export function HowItWorks() {
  const [current, setCurrent] = useState(0)
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const [animKey, setAnimKey] = useState(0)

  function go(next: number) {
    if (next < 0 || next >= STEPS.length) return
    setDir(next > current ? 'fwd' : 'back')
    setAnimKey((k) => k + 1)
    setCurrent(next)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(current + 1)
      if (e.key === 'ArrowLeft') go(current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  const { title, description, Preview } = STEPS[current]

  return (
    <section className="hiw-section" aria-labelledby="hiw-heading">
      <div className="hiw-inner">

        <div className="hiw-header">
          <p className="hiw-eyebrow">How it works</p>
          <h2 className="hiw-title" id="hiw-heading">From upload to offer</h2>
          <p className="hiw-sub">
            Four steps · Use arrow keys or click to navigate
          </p>
        </div>

        {/* Stepper — connectors are siblings of buttons, not children */}
        <div className="hiw-stepper" role="tablist" aria-label="Workflow steps">
          {STEPS.map((step, i) => (
            <Fragment key={step.id}>
              <button
                role="tab"
                aria-selected={i === current}
                className={`hiw-step-btn${i === current ? ' hiw-step-btn--active' : ''}${i < current ? ' hiw-step-btn--done' : ''}`}
                onClick={() => go(i)}
              >
                <div className="hiw-step-circle">
                  {i < current
                    ? <CheckCircle2 size={15} aria-hidden="true" />
                    : <span>{i + 1}</span>}
                </div>
                <span className="hiw-step-label">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`hiw-connector${i < current ? ' hiw-connector--done' : ''}`}
                  aria-hidden="true"
                />
              )}
            </Fragment>
          ))}
        </div>

        {/* Content card */}
        <div className="hiw-card">
          <div className="hiw-card-text">
            <p className="hiw-step-num">Step {current + 1} of {STEPS.length}</p>
            <h3 className="hiw-step-title">{title}</h3>
            <p className="hiw-step-desc">{description}</p>
            <div className="hiw-nav">
              <button
                className="hiw-nav-btn"
                onClick={() => go(current - 1)}
                disabled={current === 0}
                aria-label="Previous step"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                Back
              </button>
              <div className="hiw-dots" aria-hidden="true">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    className={`hiw-dot${i === current ? ' hiw-dot--active' : ''}`}
                    onClick={() => go(i)}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <button
                className="hiw-nav-btn hiw-nav-btn--primary"
                onClick={() => go(current + 1)}
                disabled={current === STEPS.length - 1}
                aria-label="Next step"
              >
                Next
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            key={animKey}
            className={`hiw-preview-wrap hiw-preview-wrap--${dir}`}
          >
            <Preview />
          </div>
        </div>

      </div>
    </section>
  )
}
