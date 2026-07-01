import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Mic,
  Sparkles,
  MessageSquare,
  List,
  Square,
  TrendingUp,
} from 'lucide-react'
import './InterviewPage.css'

type Mode = 'mock' | 'question-bank'
type ViewMode = 'all' | 'one-by-one'

interface Question {
  id: string
  question: string
  category: 'behavioral' | 'technical'
  hint: string
}

interface QuestionState {
  answer: string
  feedback: string | null
  loadingFeedback: boolean
  expanded: boolean
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const BEHAVIORAL: Question[] = [
  { id: 'b1',  question: 'Tell me about yourself.',                                                              category: 'behavioral', hint: 'Cover current role → key experience → why you\'re here. Aim for 90 seconds.',                         },
  { id: 'b2',  question: 'What is your greatest professional strength?',                                         category: 'behavioral', hint: 'Pick one, give a concrete example (STAR), tie it to this type of role.',                           },
  { id: 'b3',  question: 'What is your biggest weakness?',                                                       category: 'behavioral', hint: 'Be honest, show self-awareness, always follow with what you\'re actively doing about it.',          },
  { id: 'b4',  question: 'Where do you see yourself in 5 years?',                                               category: 'behavioral', hint: 'Show ambition but tie it to growth that makes sense within this kind of company or role.',           },
  { id: 'b5',  question: 'Tell me about a time you had a conflict with a coworker. How did you resolve it?',     category: 'behavioral', hint: 'STAR format. Focus on the resolution and what you learned — not the drama itself.',                 },
  { id: 'b6',  question: 'Describe a time you disagreed with your manager\'s decision.',                         category: 'behavioral', hint: 'Show you can raise concerns respectfully. What did you say, and what was the outcome?',             },
  { id: 'b7',  question: 'Tell me about a time you had to work with a very difficult team member.',              category: 'behavioral', hint: 'Emphasise empathy, communication, and finding common ground — not winning the argument.',           },
  { id: 'b8',  question: 'Tell me about a time you led a project from start to finish.',                         category: 'behavioral', hint: 'Cover scope, your specific role, how you kept things on track, and the measurable result.',         },
  { id: 'b9',  question: 'Describe a situation where you had to motivate a team that was struggling.',          category: 'behavioral', hint: 'What was the root cause of the struggle? What did you do? What changed measurably?',                },
  { id: 'b10', question: 'Tell me about a time you made a tough decision with incomplete information.',           category: 'behavioral', hint: 'Show your decision-making framework and how you mitigated the risk of being wrong.',                },
  { id: 'b11', question: 'Tell me about your biggest professional failure.',                                     category: 'behavioral', hint: 'Own it fully — the story is about what you did next and what permanently changed in your approach.',  },
  { id: 'b12', question: 'Describe a time you received harsh critical feedback. How did you respond?',           category: 'behavioral', hint: 'Show you can hear hard truths without defensiveness, and that you actually acted on the feedback.',   },
  { id: 'b13', question: 'What motivates you at work?',                                                          category: 'behavioral', hint: '"Impact" alone is weak — get specific about what type of work genuinely energises you and why.',    },
  { id: 'b14', question: 'Why are you interested in this role specifically?',                                    category: 'behavioral', hint: 'Research the company. Connect their mission to your skills and career interests by name.',            },
  { id: 'b15', question: 'Why are you leaving your current position?',                                          category: 'behavioral', hint: 'Keep it forward-looking and positive. Never badmouth. Frame it as seeking growth, not fleeing.',      },
]

const GROUPS = ['All', 'Self', 'Conflict', 'Leadership', 'Growth', 'Motivation']
const GROUP_MAP: Record<string, string[]> = {
  Self:       ['b1','b2','b3','b4'],
  Conflict:   ['b5','b6','b7'],
  Leadership: ['b8','b9','b10'],
  Growth:     ['b11','b12'],
  Motivation: ['b13','b14','b15'],
}

function initStates(questions: Question[]): Record<string, QuestionState> {
  return Object.fromEntries(
    questions.map((q) => [q.id, { answer: '', feedback: null, loadingFeedback: false, expanded: false }])
  )
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="ip-view-toggle">
      <button
        className={`ip-view-btn ${view === 'all' ? 'ip-view-btn--active' : ''}`}
        onClick={() => onChange('all')}
        title="All questions"
      >
        <List size={14} /> All
      </button>
      <button
        className={`ip-view-btn ${view === 'one-by-one' ? 'ip-view-btn--active' : ''}`}
        onClick={() => onChange('one-by-one')}
        title="One by one"
      >
        <Layers size={14} /> One by one
      </button>
    </div>
  )
}

function OneByOneCard({
  questions,
  states,
  fileId,
  onChangeAnswer,
  onFeedback,
}: {
  questions: Question[]
  states: Record<string, QuestionState>
  fileId?: string
  onChangeAnswer: (id: string, answer: string) => void
  onFeedback: (q: Question) => void
}) {
  const [index, setIndex] = useState(0)
  const q = questions[index]
  const state = states[q.id]

  return (
    <div className="ip-obo">
      <div className="ip-obo-nav">
        <button
          className="ip-obo-arrow"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="ip-obo-progress">
          {index + 1} <span className="ip-obo-of">of</span> {questions.length}
        </span>
        <button
          className="ip-obo-arrow"
          disabled={index === questions.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="ip-obo-card">
        <CategoryBadge category={q.category} />
        <p className="ip-obo-question">{q.question}</p>
        <p className="ip-hint">💡 {q.hint}</p>

        <textarea
          className="ip-textarea"
          placeholder="Type your answer here…"
          rows={6}
          value={state.answer}
          onChange={(e) => onChangeAnswer(q.id, e.target.value)}
          autoFocus
        />

        <div className="ip-actions-row">
          <VoiceMicButton
            onTranscript={(text) => onChangeAnswer(q.id, (state.answer ? state.answer + ' ' : '') + text)}
          />
          <button
            className="ip-feedback-btn"
            disabled={!state.answer.trim() || state.loadingFeedback}
            onClick={() => onFeedback(q)}
          >
            {state.loadingFeedback ? (
              <><Loader2 size={15} className="spin" /> Getting feedback…</>
            ) : (
              <><MessageSquare size={15} /> Get AI Feedback</>
            )}
          </button>
        </div>

        {state.answer.trim() && state.answer.trim().split(/\s+/).length < 10 && !state.loadingFeedback && (
          <p className="ip-answer-warning">⚠ Give a complete answer first — the AI can only coach what you write.</p>
        )}

        {state.feedback && (
          <div className="ip-feedback">
            <p className="ip-feedback-label">AI Feedback</p>
            <p className="ip-feedback-text">{state.feedback}</p>
          </div>
        )}
      </div>

      <div className="ip-obo-dots">
        {questions.map((_, i) => (
          <button
            key={i}
            className={`ip-obo-dot ${i === index ? 'ip-obo-dot--active' : ''} ${states[questions[i].id]?.answer ? 'ip-obo-dot--answered' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

function VoiceMicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recState, setRecState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  async function toggle() {
    if (recState === 'recording') {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      return
    }
    if (recState !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        setRecState('transcribing')
        const blobType = recorder.mimeType || 'audio/webm'
        const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        try {
          const fd = new FormData()
          fd.append('file', blob, `recording.${ext}`)
          const res = await axios.post<{ text: string }>(`${apiBaseUrl}/api/interview/transcribe`, fd)
          if (res.data.text) onTranscript(res.data.text)
        } catch { /* silent on network error */ } finally {
          setRecState('idle')
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecState('recording')
    } catch { /* microphone permission denied */ }
  }

  return (
    <button
      type="button"
      className={`ip-mic-btn ip-mic-btn--${recState}`}
      onClick={toggle}
      disabled={recState === 'transcribing'}
      title={recState === 'idle' ? 'Record your answer' : recState === 'recording' ? 'Stop recording' : 'Transcribing…'}
    >
      {recState === 'idle' && <><Mic size={13} /> Record</>}
      {recState === 'recording' && <><Square size={13} /> Stop</>}
      {recState === 'transcribing' && <><Loader2 size={13} className="spin" /> Transcribing…</>}
    </button>
  )
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`ip-badge ip-badge--${category}`}>
      {category === 'behavioral' ? 'Behavioral' : 'Technical'}
    </span>
  )
}

// ── Mock Interview ────────────────────────────────────────────────────────────

type MockPhase = 'setup' | 'starting' | 'active' | 'thinking' | 'complete'

interface MockQuestion {
  text: string
  category: string
  hint: string
}

interface PerQuestionDebrief {
  question: string
  score: number
  feedback: string
}

interface DebriefData {
  overall_score: number
  hire_recommendation: string
  overall_assessment: string
  strengths: string[]
  improvements: string[]
  per_question: PerQuestionDebrief[]
}

function scoreColor(score: number): { color: string; bg: string } {
  if (score >= 80) return { color: '#15803d', bg: '#dcfce7' }
  if (score >= 60) return { color: '#1d4ed8', bg: '#dbeafe' }
  if (score >= 40) return { color: '#b45309', bg: '#fef3c7' }
  return { color: '#dc2626', bg: '#fee2e2' }
}

function hireColor(rec: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    'Strong Yes': { color: '#15803d', bg: '#dcfce7' },
    'Yes': { color: '#1d4ed8', bg: '#dbeafe' },
    'Maybe': { color: '#b45309', bg: '#fef3c7' },
    'No': { color: '#dc2626', bg: '#fee2e2' },
  }
  return map[rec] ?? { color: '#475569', bg: '#f1f5f9' }
}

function MockInterviewPanel({ fileId, initialJd }: { fileId?: string; initialJd: string }) {
  const [phase, setPhase] = useState<MockPhase>('setup')
  const [jd, setJd] = useState(initialJd)
  const [error, setError] = useState('')

  const [sessionId, setSessionId] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState<MockQuestion | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [isFollowup, setIsFollowup] = useState(false)
  const [prevQuestion, setPrevQuestion] = useState('')
  const [prevAnswer, setPrevAnswer] = useState('')
  const [answer, setAnswer] = useState('')

  const [debrief, setDebrief] = useState<DebriefData | null>(null)
  const [expandedDebriefQ, setExpandedDebriefQ] = useState<number | null>(null)

  async function startInterview() {
    if (!jd.trim()) return
    setPhase('starting')
    setError('')
    try {
      const res = await axios.post<{
        session_id: string
        question: MockQuestion
        question_number: number
        total_questions: number
      }>(`${apiBaseUrl}/api/mock-interview/start`, { job_description: jd, file_id: fileId ?? null })
      setSessionId(res.data.session_id)
      setCurrentQuestion(res.data.question)
      setQuestionNumber(res.data.question_number)
      setTotalQuestions(res.data.total_questions)
      setIsFollowup(false)
      setAnswer('')
      setPhase('active')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Failed to start interview. Try again.')
      setPhase('setup')
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || !currentQuestion) return
    const submitted = answer
    setPhase('thinking')
    try {
      const res = await axios.post<
        | { type: 'followup'; followup: string }
        | { type: 'next_question'; question: MockQuestion; question_number: number; total_questions: number }
        | { type: 'debrief'; debrief: DebriefData }
      >(`${apiBaseUrl}/api/mock-interview/answer`, { session_id: sessionId, answer: submitted })

      const data = res.data
      setAnswer('')

      if (data.type === 'followup') {
        setPrevQuestion(isFollowup ? prevQuestion : currentQuestion.text)
        setPrevAnswer(submitted)
        setCurrentQuestion({ text: data.followup, category: currentQuestion.category, hint: '' })
        setIsFollowup(true)
        setPhase('active')
      } else if (data.type === 'next_question') {
        setCurrentQuestion(data.question)
        setQuestionNumber(data.question_number)
        setIsFollowup(false)
        setPrevQuestion('')
        setPrevAnswer('')
        setPhase('active')
      } else if (data.type === 'debrief') {
        setDebrief(data.debrief)
        setPhase('complete')
      }
    } catch {
      setAnswer(submitted)
      setError('Something went wrong. Try again.')
      setPhase('active')
    }
  }

  function reset() {
    setPhase('setup')
    setSessionId('')
    setCurrentQuestion(null)
    setIsFollowup(false)
    setPrevQuestion('')
    setPrevAnswer('')
    setAnswer('')
    setDebrief(null)
    setError('')
    setExpandedDebriefQ(null)
  }

  if (phase === 'setup') {
    return (
      <div className="ip-jd-setup">
        {initialJd ? (
          <>
            <div className="ip-mock-jd-loaded">
              <span className="ip-mock-jd-loaded-check">✓</span>
              <div>
                <p className="ip-mock-jd-loaded-title">
                  {fileId ? 'Resume + job description loaded from ATS analysis' : 'Job description loaded from ATS analysis'}
                </p>
                <p className="ip-mock-jd-loaded-sub">Questions will be tailored to this role{fileId ? ' and your resume' : ''}.</p>
              </div>
            </div>
            {error && (
              <div className="ip-error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <button className="ip-generate-btn" onClick={startInterview}>
              <Bot size={15} /> Begin Mock Interview
            </button>
          </>
        ) : (
          <>
            <p className="ip-jd-label">Paste a job description to begin your mock interview.</p>
            <textarea
              className="ip-jd-textarea"
              placeholder="Paste the full job description here…"
              rows={8}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            {error && (
              <div className="ip-error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <button className="ip-generate-btn" disabled={!jd.trim()} onClick={startInterview}>
              <Bot size={15} /> Begin Mock Interview
            </button>
          </>
        )}
      </div>
    )
  }

  if (phase === 'starting') {
    return (
      <div className="ip-generating">
        <Loader2 size={28} className="spin ip-generating-icon" />
        <p>Preparing your interview questions…</p>
      </div>
    )
  }

  if (phase === 'thinking') {
    return (
      <div className="ip-generating">
        <Loader2 size={28} className="spin ip-generating-icon" />
        <p>Evaluating your answer…</p>
      </div>
    )
  }

  if (phase === 'active' && currentQuestion) {
    const progressPct = ((questionNumber - 1) / totalQuestions) * 100
    return (
      <div className="ip-mock-active">
        {error && (
          <div className="ip-error" style={{ marginBottom: 8 }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="ip-mock-progress">
          <span className="ip-mock-progress-label">
            Question {questionNumber} of {totalQuestions}
          </span>
          <div className="ip-mock-progress-track">
            <div className="ip-mock-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {isFollowup && (
          <div className="ip-mock-prev-qa">
            <p className="ip-mock-prev-q">{prevQuestion}</p>
            <p className="ip-mock-prev-a">"{prevAnswer}"</p>
          </div>
        )}

        <div className="ip-obo-card">
          {isFollowup ? (
            <span className="ip-mock-followup-badge">Follow-up</span>
          ) : (
            <CategoryBadge category={currentQuestion.category} />
          )}
          <p className="ip-obo-question">{currentQuestion.text}</p>
          {currentQuestion.hint && <p className="ip-hint">💡 {currentQuestion.hint}</p>}

          <textarea
            className="ip-textarea"
            placeholder="Type your answer here…"
            rows={6}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
          />

          <div className="ip-actions-row">
            <VoiceMicButton
              onTranscript={(text) => setAnswer((prev) => (prev ? prev + ' ' : '') + text)}
            />
            <button
              className="ip-feedback-btn"
              disabled={!answer.trim()}
              onClick={submitAnswer}
            >
              <TrendingUp size={15} /> Submit Answer
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'complete' && debrief) {
    const sc = scoreColor(debrief.overall_score)
    const hc = hireColor(debrief.hire_recommendation)
    return (
      <div className="ip-mock-debrief">
        <div className="ip-mock-debrief-header">
          <div className="ip-mock-score-block" style={{ background: sc.bg }}>
            <span className="ip-mock-score-num" style={{ color: sc.color }}>
              {debrief.overall_score}
            </span>
            <span className="ip-mock-score-denom" style={{ color: sc.color }}>/100</span>
          </div>
          <div className="ip-mock-debrief-summary">
            <span className="ip-mock-hire-badge" style={{ background: hc.bg, color: hc.color }}>
              {debrief.hire_recommendation}
            </span>
            <p className="ip-mock-assessment">{debrief.overall_assessment}</p>
          </div>
        </div>

        <div className="ip-mock-section">
          <p className="ip-mock-section-label">Strengths</p>
          <div className="ip-mock-chips">
            {debrief.strengths.map((s, i) => (
              <span key={i} className="ip-mock-chip ip-mock-chip--green">{s}</span>
            ))}
          </div>
        </div>

        <div className="ip-mock-section">
          <p className="ip-mock-section-label">Areas to Improve</p>
          <div className="ip-mock-chips">
            {debrief.improvements.map((imp, i) => (
              <span key={i} className="ip-mock-chip ip-mock-chip--amber">{imp}</span>
            ))}
          </div>
        </div>

        <div className="ip-mock-section">
          <p className="ip-mock-section-label">Question Breakdown</p>
          <div className="ip-questions">
            {debrief.per_question.map((pq, i) => {
              const qsc = scoreColor(pq.score)
              const open = expandedDebriefQ === i
              return (
                <div key={i} className={`ip-card ${open ? 'ip-card--open' : ''}`}>
                  <button className="ip-card-header" onClick={() => setExpandedDebriefQ(open ? null : i)}>
                    <div className="ip-card-header-left">
                      <span
                        className="ip-mock-q-score"
                        style={{ background: qsc.bg, color: qsc.color }}
                      >
                        {pq.score}
                      </span>
                      <span className="ip-card-question">{pq.question}</span>
                    </div>
                    <ChevronDown size={17} className={`ip-chevron ${open ? 'ip-chevron--open' : ''}`} />
                  </button>
                  {open && (
                    <div className="ip-card-body">
                      <p className="ip-feedback-text">{pq.feedback}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <button className="ip-regenerate ip-mock-retry" onClick={reset}>
          Try Again
        </button>
      </div>
    )
  }

  return null
}

function QuestionCard({
  q,
  state,
  fileId,
  onChange,
  onToggle,
  onFeedback,
}: {
  q: Question
  state: QuestionState
  fileId?: string
  onChange: (answer: string) => void
  onToggle: () => void
  onFeedback: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (state.expanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [state.expanded])

  return (
    <div className={`ip-card ${state.expanded ? 'ip-card--open' : ''}`}>
      <button className="ip-card-header" onClick={onToggle}>
        <div className="ip-card-header-left">
          <CategoryBadge category={q.category} />
          <span className="ip-card-question">{q.question}</span>
        </div>
        <ChevronDown size={17} className={`ip-chevron ${state.expanded ? 'ip-chevron--open' : ''}`} />
      </button>

      {state.expanded && (
        <div className="ip-card-body">
          <p className="ip-hint">💡 {q.hint}</p>

          <textarea
            ref={textareaRef}
            className="ip-textarea"
            placeholder="Type your answer here…"
            rows={5}
            value={state.answer}
            onChange={(e) => onChange(e.target.value)}
          />

          <div className="ip-actions-row">
            <VoiceMicButton
              onTranscript={(text) => onChange((state.answer ? state.answer + ' ' : '') + text)}
            />
            <button
              className="ip-feedback-btn"
              disabled={!state.answer.trim() || state.loadingFeedback}
              onClick={onFeedback}
            >
              {state.loadingFeedback ? (
                <><Loader2 size={15} className="spin" /> Getting feedback…</>
              ) : (
                <><MessageSquare size={15} /> Get AI Feedback</>
              )}
            </button>
          </div>

          {state.answer.trim() && state.answer.trim().split(/\s+/).length < 10 && !state.loadingFeedback && (
            <p className="ip-answer-warning">⚠ Give a complete answer first — the AI can only coach what you write.</p>
          )}

          {state.feedback && (
            <div className="ip-feedback">
              <p className="ip-feedback-label">AI Feedback</p>
              <p className="ip-feedback-text">{state.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InterviewPage() {
  const location = useLocation()
  const incoming = location.state as { file_id?: string; job_description?: string } | null

  const [mode, setMode] = useState<Mode>('mock')
  const [qbTab, setQbTab] = useState<'behavioral' | 'role-specific'>('behavioral')
  const [behavioralViewMode, setBehavioralViewMode] = useState<ViewMode>('one-by-one')
  const [roleViewMode, setRoleViewMode] = useState<ViewMode>('one-by-one')
  const [group, setGroup] = useState('All')

  // Behavioral state
  const [behavioralStates, setBehavioralStates] = useState<Record<string, QuestionState>>(
    () => initStates(BEHAVIORAL)
  )

  // Role-specific state
  const [jd, setJd] = useState(incoming?.job_description ?? '')
  const [fileId] = useState(incoming?.file_id)
  const [roleQuestions, setRoleQuestions] = useState<Question[]>([])
  const [roleStates, setRoleStates] = useState<Record<string, QuestionState>>({})
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // When switching to Question Bank with a pre-loaded JD, go straight to role-specific and generate
  useEffect(() => {
    if (mode === 'question-bank' && jd.trim()) {
      setQbTab('role-specific')
      if (roleQuestions.length === 0 && !generating) {
        void fetchRoleQuestions()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function fetchRoleQuestions() {
    if (!jd.trim()) return
    if (jd.trim().split(/\s+/).length < 20) {
      setGenerateError('Job description is not long enough.')
      return
    }
    setGenerating(true)
    setGenerateError('')
    setRoleQuestions([])
    try {
      const res = await axios.post<{ questions: Question[] }>(
        `${apiBaseUrl}/api/interview/questions`,
        { job_description: jd, file_id: fileId ?? null }
      )
      const qs = res.data.questions.map((q, i) => ({ ...q, id: `r${i}` }))
      setRoleQuestions(qs)
      setRoleStates(initStates(qs))
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setGenerateError(detail ?? 'Failed to generate questions. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function fetchFeedback(
    q: Question,
    states: Record<string, QuestionState>,
    setStates: React.Dispatch<React.SetStateAction<Record<string, QuestionState>>>,
    currentFileId?: string
  ) {
    const answer = states[q.id]?.answer
    if (!answer?.trim()) return

    setStates((prev) => ({ ...prev, [q.id]: { ...prev[q.id], loadingFeedback: true } }))
    try {
      const res = await axios.post<{ feedback: string }>(
        `${apiBaseUrl}/api/interview/feedback`,
        { question: q.question, user_answer: answer, file_id: currentFileId ?? null }
      )
      setStates((prev) => ({
        ...prev,
        [q.id]: { ...prev[q.id], feedback: res.data.feedback, loadingFeedback: false },
      }))
    } catch {
      setStates((prev) => ({
        ...prev,
        [q.id]: { ...prev[q.id], feedback: 'Could not get feedback. Try again.', loadingFeedback: false },
      }))
    }
  }

  const filteredBehavioral =
    group === 'All' ? BEHAVIORAL : BEHAVIORAL.filter((q) => GROUP_MAP[group]?.includes(q.id))

  return (
    <div className="ip-page">
      <div className="ip-header">
        <div className="ip-header-icon">
          <Mic size={28} />
        </div>
        <div>
          <h1 className="ip-title">Interview Prep</h1>
          <p className="ip-subtitle">Practice your answers and get instant AI coaching</p>
        </div>
      </div>

      {/* Mode switcher + description */}
      <div className="ip-nav">
        <div className="ip-mode-switcher">
          <button
            className={`ip-mode-btn ${mode === 'mock' ? 'ip-mode-btn--active' : ''}`}
            onClick={() => setMode('mock')}
          >
            <Bot size={14} />
            Mock Interview
          </button>
          <button
            className={`ip-mode-btn ${mode === 'question-bank' ? 'ip-mode-btn--active' : ''}`}
            onClick={() => setMode('question-bank')}
          >
            <Sparkles size={14} />
            Question Bank
          </button>
        </div>
        <p className="ip-mode-desc">
          {mode === 'mock'
            ? 'The AI conducts a live interview, asks follow-up questions based on your answers, and scores your performance at the end.'
            : 'Browse questions and practice at your own pace. Get AI feedback on any answer, no pressure.'}
        </p>
      </div>

      {/* ── Mock Interview ── */}
      {mode === 'mock' && (
        <div className="ip-content">
          <MockInterviewPanel fileId={fileId} initialJd={jd} />
        </div>
      )}

      {/* ── Question Bank ── */}
      {mode === 'question-bank' && (
        <div className="ip-content">

          {/* Sub-tabs */}
          <div className="ip-qb-tabs">
            <button
              className={`ip-qb-tab ${qbTab === 'behavioral' ? 'ip-qb-tab--active' : ''}`}
              onClick={() => setQbTab('behavioral')}
            >
              Behavioral
            </button>
            <button
              className={`ip-qb-tab ${qbTab === 'role-specific' ? 'ip-qb-tab--active' : ''}`}
              onClick={() => setQbTab('role-specific')}
            >
              Role-Specific
            </button>
          </div>

          {/* Behavioral sub-tab */}
          {qbTab === 'behavioral' && (
            <>
              <div className="ip-toolbar">
                <div className="ip-group-pills">
                  {GROUPS.map((g) => (
                    <button
                      key={g}
                      className={`ip-group-pill ${group === g ? 'ip-group-pill--active' : ''}`}
                      onClick={() => setGroup(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <ViewToggle view={behavioralViewMode} onChange={setBehavioralViewMode} />
              </div>
              {behavioralViewMode === 'all' ? (
                <div className="ip-questions">
                  {filteredBehavioral.map((q) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      state={behavioralStates[q.id]}
                      onChange={(answer) =>
                        setBehavioralStates((prev) => ({ ...prev, [q.id]: { ...prev[q.id], answer } }))
                      }
                      onToggle={() =>
                        setBehavioralStates((prev) => ({
                          ...prev,
                          [q.id]: { ...prev[q.id], expanded: !prev[q.id].expanded },
                        }))
                      }
                      onFeedback={() => fetchFeedback(q, behavioralStates, setBehavioralStates)}
                    />
                  ))}
                </div>
              ) : (
                <OneByOneCard
                  questions={filteredBehavioral}
                  states={behavioralStates}
                  onChangeAnswer={(id, answer) =>
                    setBehavioralStates((prev) => ({ ...prev, [id]: { ...prev[id], answer } }))
                  }
                  onFeedback={(q) => fetchFeedback(q, behavioralStates, setBehavioralStates)}
                />
              )}
            </>
          )}

          {/* Role-specific sub-tab */}
          {qbTab === 'role-specific' && (
            <>
              {roleQuestions.length === 0 && !generating && (
                <div className="ip-jd-setup">
                  <p className="ip-jd-label">
                    {fileId
                      ? 'Your resume is loaded. Paste the job description to generate tailored questions.'
                      : 'Paste a job description to generate tailored interview questions.'}
                  </p>
                  <textarea
                    className="ip-jd-textarea"
                    placeholder="Paste the full job description here…"
                    rows={6}
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                  />
                  {generateError && (
                    <div className="ip-error">
                      <AlertCircle size={14} />
                      {generateError}
                    </div>
                  )}
                  <button
                    className="ip-generate-btn"
                    disabled={!jd.trim()}
                    onClick={fetchRoleQuestions}
                  >
                    <Sparkles size={15} />
                    Generate Questions
                  </button>
                </div>
              )}

              {generating && (
                <div className="ip-generating">
                  <Loader2 size={28} className="spin ip-generating-icon" />
                  <p>Generating role-specific questions…</p>
                </div>
              )}

              {roleQuestions.length > 0 && (
                <>
                  <div className="ip-role-header">
                    <p className="ip-role-count">{roleQuestions.length} questions generated</p>
                    <div className="ip-role-header-right">
                      <ViewToggle view={roleViewMode} onChange={setRoleViewMode} />
                      <button
                        className="ip-regenerate"
                        onClick={() => { setRoleQuestions([]); setRoleStates({}); setJd('') }}
                      >
                        Change JD
                      </button>
                    </div>
                  </div>
                  {roleViewMode === 'all' ? (
                    <div className="ip-questions">
                      {roleQuestions.map((q) => (
                        <QuestionCard
                          key={q.id}
                          q={q}
                          state={roleStates[q.id]}
                          fileId={fileId}
                          onChange={(answer) =>
                            setRoleStates((prev) => ({ ...prev, [q.id]: { ...prev[q.id], answer } }))
                          }
                          onToggle={() =>
                            setRoleStates((prev) => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], expanded: !prev[q.id].expanded },
                            }))
                          }
                          onFeedback={() => fetchFeedback(q, roleStates, setRoleStates, fileId)}
                        />
                      ))}
                    </div>
                  ) : (
                    <OneByOneCard
                      questions={roleQuestions}
                      states={roleStates}
                      fileId={fileId}
                      onChangeAnswer={(id, answer) =>
                        setRoleStates((prev) => ({ ...prev, [id]: { ...prev[id], answer } }))
                      }
                      onFeedback={(q) => fetchFeedback(q, roleStates, setRoleStates, fileId)}
                    />
                  )}
                </>
              )}
            </>
          )}

        </div>
      )}
    </div>
  )
}
