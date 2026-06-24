import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Mic,
  Sparkles,
  MessageSquare,
  List,
} from 'lucide-react'
import './InterviewPage.css'

type Mode = 'behavioral' | 'role-specific'
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

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`ip-badge ip-badge--${category}`}>
      {category === 'behavioral' ? 'Behavioral' : 'Technical'}
    </span>
  )
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

  const [mode, setMode] = useState<Mode>(incoming?.job_description ? 'role-specific' : 'behavioral')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
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

  // Auto-generate if we arrived from the analyze flow
  useEffect(() => {
    if (incoming?.job_description && mode === 'role-specific') {
      void fetchRoleQuestions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchRoleQuestions() {
    if (!jd.trim()) return
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
    } catch {
      setGenerateError('Failed to generate questions. Please try again.')
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

      {/* Mode switcher */}
      <div className="ip-mode-switcher">
        <button
          className={`ip-mode-btn ${mode === 'behavioral' ? 'ip-mode-btn--active' : ''}`}
          onClick={() => setMode('behavioral')}
        >
          Behavioral Practice
        </button>
        <button
          className={`ip-mode-btn ${mode === 'role-specific' ? 'ip-mode-btn--active' : ''}`}
          onClick={() => setMode('role-specific')}
        >
          <Sparkles size={14} />
          Role-Specific
        </button>
      </div>

      {/* ── Behavioral mode ── */}
      {mode === 'behavioral' && (
        <div className="ip-content">
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
            <ViewToggle view={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === 'all' ? (
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
        </div>
      )}

      {/* ── Role-specific mode ── */}
      {mode === 'role-specific' && (
        <div className="ip-content">
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
                rows={8}
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
              <p>Generating questions tailored to this role…</p>
            </div>
          )}

          {roleQuestions.length > 0 && (
            <>
              <div className="ip-role-header">
                <p className="ip-role-count">{roleQuestions.length} questions generated</p>
                <div className="ip-role-header-right">
                  <ViewToggle view={viewMode} onChange={setViewMode} />
                  <button className="ip-regenerate" onClick={() => { setRoleQuestions([]); setRoleStates({}) }}>
                    Change JD
                  </button>
                </div>
              </div>

              {viewMode === 'all' ? (
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
        </div>
      )}
    </div>
  )
}
