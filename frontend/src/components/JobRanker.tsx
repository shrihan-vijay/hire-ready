import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Loader2, Mic, Network, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AddApplicationModal } from './AddApplicationModal'
import './JobRanker.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface JobResult {
  url: string
  title: string
  ok: boolean
  score?: number
  matched_skills?: string[]
  missing_skills?: string[]
  summary?: string
  jd_snippet?: string
  error?: string
}

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const fill = circ - (score / 100) * circ
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="jr-ring">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="800" fill={color}>{score}</text>
    </svg>
  )
}

export function JobRanker({ fileId }: { fileId: string | null }) {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [urls, setUrls] = useState(['', '', ''])
  const [results, setResults] = useState<JobResult[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [scored, setScored] = useState(0)
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set())
  const [trackTarget, setTrackTarget] = useState<JobResult | null>(null)
  const [tracked, setTracked] = useState<Set<string>>(new Set())

  const validUrls = urls.filter((u) => u.trim().startsWith('http'))

  function setUrl(i: number, val: string) {
    setUrls((prev) => prev.map((u, j) => (j === i ? val : u)))
  }

  function removeUrl(i: number) {
    setUrls((prev) => prev.filter((_, j) => j !== i))
  }

  async function run() {
    const toScore = urls.filter((u) => u.trim().startsWith('http'))
    if (toScore.length < 2) return

    setStatus('running')
    setResults([])
    setScored(0)

    try {
      const resp = await fetch(`${apiBaseUrl}/api/resume/rank-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ file_id: fileId, urls: toScore }),
      })

      if (!resp.ok || !resp.body) throw new Error('Ranking failed')

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { setStatus('done'); return }
          try {
            const result = JSON.parse(raw) as JobResult
            setResults((prev) =>
              [...prev, result].sort((a, b) => {
                if (a.ok && b.ok) return (b.score ?? 0) - (a.score ?? 0)
                return a.ok ? -1 : 1
              })
            )
            setScored((n) => n + 1)
          } catch {}
        }
      }
    } catch {
      setStatus('done')
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    if (a.ok && b.ok) return (b.score ?? 0) - (a.score ?? 0)
    return a.ok ? -1 : 1
  })

  return (
    <div className="jr-root">
      {/* URL inputs */}
      <div className="jr-inputs">
        <p className="jr-inputs-label">Paste job listing URLs (2 to 5)</p>
        {urls.map((u, i) => (
          <div key={i} className="jr-url-row">
            <input
              className="jr-url-input"
              type="url"
              placeholder={`https://jobs.company.com/role-${i + 1}`}
              value={u}
              onChange={(e) => setUrl(i, e.target.value)}
              disabled={status === 'running'}
            />
            {urls.length > 2 && (
              <button className="jr-url-remove" onClick={() => removeUrl(i)} disabled={status === 'running'}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {urls.length < 5 && (
          <button className="jr-add-btn" onClick={() => setUrls((p) => [...p, ''])} disabled={status === 'running'}>
            <Plus size={13} /> Add another job
          </button>
        )}
      </div>

      <button
        className="jr-run-btn"
        onClick={run}
        disabled={validUrls.length < 2 || status === 'running'}
      >
        {status === 'running' ? (
          <><Loader2 size={14} className="spin" /> Scoring {scored} / {validUrls.length} jobs…</>
        ) : (
          'Rank These Jobs'
        )}
      </button>

      {/* Results */}
      {sortedResults.length > 0 && (
        <div className="jr-results">
          {sortedResults.map((r, i) => (
            <div key={r.url} className={`jr-card ${!r.ok ? 'jr-card--error' : ''}`}>
              {r.ok ? (
                <>
                  <div className="jr-card-left">
                    <span className="jr-rank">#{i + 1}</span>
                    <ScoreRing score={r.score!} />
                  </div>
                  <div className="jr-card-body">
                    <p className="jr-job-title">{r.title}</p>
                    <a className="jr-job-url" href={r.url} target="_blank" rel="noreferrer">
                      {r.url.replace(/^https?:\/\//, '').slice(0, 60)}{r.url.length > 63 ? '…' : ''}
                    </a>
                    {r.summary && (() => {
                      const expanded = expandedSummaries.has(r.url)
                      const long = r.summary.length > 140
                      return (
                        <div>
                          <p className={`jr-summary ${!expanded && long ? 'jr-summary--clamped' : ''}`}>
                            {r.summary}
                          </p>
                          {long && (
                            <button className="jr-read-more" onClick={() =>
                              setExpandedSummaries((prev) => {
                                const next = new Set(prev)
                                expanded ? next.delete(r.url) : next.add(r.url)
                                return next
                              })
                            }>
                              {expanded ? 'Read less' : 'Read more'}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                    <div className="jr-skills">
                      {r.matched_skills?.slice(0, 5).map((s) => (
                        <span key={s} className="jr-skill jr-skill--matched">{s}</span>
                      ))}
                      {r.missing_skills?.slice(0, 3).map((s) => (
                        <span key={s} className="jr-skill jr-skill--missing">{s}</span>
                      ))}
                    </div>
                    <div className="jr-card-actions">
                      <button
                        className="jr-action-btn jr-action-btn--ghost"
                        onClick={() => navigate('/apply', { state: { file_id: fileId, job_description: r.jd_snippet } })}
                      >
                        <Network size={12} /> Job Recon
                      </button>
                      <button
                        className="jr-action-btn jr-action-btn--primary"
                        onClick={() => navigate('/interview', { state: { file_id: fileId, job_description: r.jd_snippet } })}
                      >
                        <Mic size={12} /> Prep Interview
                      </button>
                      <button
                        className="jr-action-btn jr-action-btn--ghost"
                        disabled={tracked.has(r.url)}
                        onClick={() => setTrackTarget(r)}
                      >
                        <Bookmark size={12} /> {tracked.has(r.url) ? 'Tracked' : 'Track'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="jr-card-error">
                  <Trash2 size={14} />
                  <div>
                    <p className="jr-error-url">{r.url.slice(0, 60)}</p>
                    <p className="jr-error-msg">{r.error}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {trackTarget && (
        <AddApplicationModal
          prefill={{
            jobTitle: trackTarget.title,
            jobUrl: trackTarget.url,
            fileId,
            score: trackTarget.score,
            jdSnippet: trackTarget.jd_snippet,
          }}
          onClose={() => setTrackTarget(null)}
          onCreated={() => {
            setTracked((prev) => new Set(prev).add(trackTarget.url))
            setTrackTarget(null)
          }}
        />
      )}
    </div>
  )
}
