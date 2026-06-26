import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, FileText, MessageSquare, Trash2 } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import './HistoryPage.css'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface AnalysisEntry {
  score: number
  matched_skills: string[]
  missing_skills: string[]
  jd_snippet: string | null
  summary: string
  analyzed_at: string
}

interface ResumeFile {
  file_id: string
  filename: string
  uploaded_at: string
  analyses: AnalysisEntry[]
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 45) return '#f59e0b'
  return '#ef4444'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function HistoryPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState<ResumeFile[]>([])
  const [fetching, setFetching] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null)
  const [confirmDeleteScore, setConfirmDeleteScore] = useState<string | null>(null) // analyzed_at
  const [deletingScore, setDeletingScore] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setFetching(true)
    axios.get<ResumeFile[]>(`${API}/api/resume/history`)
      .then(res => {
        setHistory(res.data)
        if (res.data.length > 0) setExpanded(res.data[0].file_id)
      })
      .catch(() => setHistory([]))
      .finally(() => setFetching(false))
  }, [user])

  async function handleDelete(file_id: string) {
    setDeleting(file_id)
    try {
      await axios.delete(`${API}/api/resume/history/${file_id}`)
      setHistory(h => h.filter(r => r.file_id !== file_id))
      if (expanded === file_id) setExpanded(null)
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  async function handleDeleteScore(file_id: string, analyzed_at: string) {
    setDeletingScore(analyzed_at)
    try {
      await axios.delete(`${API}/api/resume/history/${file_id}/score`, {
        params: { at: analyzed_at },
      })
      setHistory(h => h.map(r =>
        r.file_id === file_id
          ? { ...r, analyses: r.analyses.filter(a => a.analyzed_at !== analyzed_at) }
          : r
      ))
    } finally {
      setDeletingScore(null)
      setConfirmDeleteScore(null)
    }
  }

  if (loading) {
    return <div className="history-page"><div className="history-spinner" /></div>
  }

  if (!user) {
    return (
      <div className="history-page">
        <div className="history-empty-state">
          <FileText size={36} className="history-empty-icon" />
          <p className="history-empty-title">Sign in to see your history</p>
          <p className="history-empty-sub">Your uploaded resumes and scores are saved to your account.</p>
          <button className="history-action-btn" onClick={() => navigate('/profile')}>Go to sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1 className="history-title">Resume History</h1>
        <p className="history-sub">Your uploads, newest first. Click a resume to see its scores.</p>
      </div>

      {fetching && <div className="history-spinner" />}

      {!fetching && history.length === 0 && (
        <div className="history-empty-state">
          <FileText size={36} className="history-empty-icon" />
          <p className="history-empty-title">No resumes yet</p>
          <p className="history-empty-sub">Upload a resume from the Home tab to get started.</p>
          <button className="history-action-btn" onClick={() => navigate('/home')}>Go to Home</button>
        </div>
      )}

      <div className="history-list">
        {!fetching && history.map(item => {
          const isOpen = expanded === item.file_id

          return (
            <div key={item.file_id} className={`history-card ${isOpen ? 'history-card--open' : ''}`}>
              {confirmDelete === item.file_id ? (
                <div className="history-confirm-row">
                  <span className="history-confirm-msg">Delete this resume and all its scores?</span>
                  <button
                    className="history-confirm-btn history-confirm-btn--cancel"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="history-confirm-btn history-confirm-btn--delete"
                    disabled={deleting === item.file_id}
                    onClick={() => handleDelete(item.file_id)}
                  >
                    {deleting === item.file_id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : (
                <button
                  className="history-card-header"
                  onClick={() => setExpanded(isOpen ? null : item.file_id)}
                >
                  <div className="history-card-left">
                    <FileText size={15} className="history-file-icon" />
                    <div>
                      <p className="history-filename">{item.filename}</p>
                      <p className="history-date">Uploaded {formatDate(item.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="history-card-right">
                    {item.analyses.length > 1 && (
                      <span className="history-count">{item.analyses.length} scores</span>
                    )}
                    <button
                      className="history-delete-btn"
                      onClick={e => { e.stopPropagation(); setConfirmDelete(item.file_id) }}
                      aria-label="Delete resume"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown
                      size={16}
                      className={`history-chevron ${isOpen ? 'history-chevron--open' : ''}`}
                    />
                  </div>
                </button>
              )}

              {isOpen && (
                <div className="history-analyses">
                  {item.analyses.length === 0 ? (
                    <p className="history-no-analyses">No ATS scores yet — analyze against a job description from the Home tab.</p>
                  ) : (
                    item.analyses.map((a, i) => {
                      const summaryKey = `${item.file_id}-${i}`
                      const summaryOpen = expandedSummary === summaryKey
                      const isConfirmingScore = confirmDeleteScore === a.analyzed_at
                      const isDeletingScore = deletingScore === a.analyzed_at

                      return (
                        <div key={a.analyzed_at} className="history-analysis-row">
                          {isConfirmingScore ? (
                            <div className="history-score-confirm-row">
                              <span className="history-confirm-msg">Delete this score?</span>
                              <button
                                className="history-confirm-btn history-confirm-btn--cancel"
                                onClick={() => setConfirmDeleteScore(null)}
                              >
                                Cancel
                              </button>
                              <button
                                className="history-confirm-btn history-confirm-btn--delete"
                                disabled={isDeletingScore}
                                onClick={() => handleDeleteScore(item.file_id, a.analyzed_at)}
                              >
                                {isDeletingScore ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="history-analysis-header">
                                <span className="history-score-badge" style={{ background: scoreColor(a.score) }}>
                                  {a.score}
                                </span>
                                <span className="history-analysis-date">{formatDate(a.analyzed_at)}</span>
                                {a.summary && (
                                  <button
                                    className="history-summary-toggle"
                                    onClick={() => setExpandedSummary(summaryOpen ? null : summaryKey)}
                                  >
                                    {summaryOpen ? 'Hide summary' : 'View summary'}
                                  </button>
                                )}
                                <button
                                  className="history-score-delete-btn"
                                  onClick={() => setConfirmDeleteScore(a.analyzed_at)}
                                  aria-label="Delete this score"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              {summaryOpen && a.summary && (
                                <p className="history-summary">{a.summary}</p>
                              )}
                              <div className="history-skills">
                                {a.matched_skills.slice(0, 4).map(s => (
                                  <span key={s} className="history-skill-tag matched">{s}</span>
                                ))}
                                {a.missing_skills.slice(0, 3).map(s => (
                                  <span key={s} className="history-skill-tag missing">{s}</span>
                                ))}
                              </div>
                              <button
                                className="history-prep-btn"
                                onClick={() => navigate('/interview', {
                                  state: { file_id: item.file_id, job_description: a.jd_snippet ?? '' },
                                })}
                              >
                                <MessageSquare size={13} />
                                Prep interview
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
