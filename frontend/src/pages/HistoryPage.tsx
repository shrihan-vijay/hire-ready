import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, FileText } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import './HistoryPage.css'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface HistoryItem {
  id: string
  file_id: string
  filename: string
  score: number | null
  matched_skills: string[]
  missing_skills: string[]
  jd_snippet: string | null
  uploaded_at: string
}

function scoreColor(score: number | null): string {
  if (score === null) return '#9ca3af'
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
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!user) return
    setFetching(true)
    axios.get<HistoryItem[]>(`${API}/api/resume/history`)
      .then(res => setHistory(res.data))
      .catch(() => setHistory([]))
      .finally(() => setFetching(false))
  }, [user])

  if (loading) {
    return (
      <div className="history-page">
        <div className="history-spinner" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="history-page">
        <div className="history-empty-state">
          <FileText size={36} className="history-empty-icon" />
          <p className="history-empty-title">Sign in to see your history</p>
          <p className="history-empty-sub">Your uploaded resumes and scores are saved to your account.</p>
          <button className="history-signin-btn" onClick={() => navigate('/profile')}>
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1 className="history-title">Resume History</h1>
        <p className="history-sub">Your uploaded resumes and ATS scores, newest first.</p>
      </div>

      {fetching && <div className="history-spinner" />}

      {!fetching && history.length === 0 && (
        <div className="history-empty-state">
          <FileText size={36} className="history-empty-icon" />
          <p className="history-empty-title">No resumes yet</p>
          <p className="history-empty-sub">Upload a resume from the Home tab to get started.</p>
          <button className="history-signin-btn" onClick={() => navigate('/home')}>
            Go to Home
          </button>
        </div>
      )}

      <div className="history-list">
        {!fetching && history.map(item => {
          const color = scoreColor(item.score)
          return (
            <div key={item.id} className="history-card">
              <div className="history-card-header">
                <div className="history-filename">{item.filename}</div>
                <div className="history-score-badge" style={{ background: color }}>
                  {item.score !== null ? item.score : '—'}
                </div>
              </div>
              <div className="history-date">{formatDate(item.uploaded_at)}</div>
              {item.jd_snippet && (
                <p className="history-jd-snippet">
                  {item.jd_snippet.length > 160 ? item.jd_snippet.slice(0, 160) + '…' : item.jd_snippet}
                </p>
              )}
              {item.score !== null && (
                <div className="history-skills">
                  {item.matched_skills.slice(0, 4).map(s => (
                    <span key={s} className="history-skill-tag matched">{s}</span>
                  ))}
                  {item.missing_skills.slice(0, 3).map(s => (
                    <span key={s} className="history-skill-tag missing">{s}</span>
                  ))}
                </div>
              )}
              <button
                className="history-prep-btn"
                onClick={() => navigate('/interview', {
                  state: { file_id: item.file_id, job_description: item.jd_snippet ?? '' },
                })}
              >
                <MessageSquare size={14} />
                Prep interview
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
