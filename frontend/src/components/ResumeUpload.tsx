import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  GitBranch,
  HelpCircle,
  Link2,
  Loader2,
  Mic,
  UploadCloud,
  X,
  Sparkles,
  History,
} from 'lucide-react'
import { useResume } from '../context/ResumeContext'
import type { ParseResult, AnalyzeResult } from '../context/ResumeContext'
import { useAuth } from '../context/AuthContext'
import './ResumeUpload.css'

type UploadState = 'idle' | 'dragover' | 'uploading' | 'error'
type AnalyzeState = 'idle' | 'analyzing' | 'done' | 'error'
type JdMode = 'text' | 'url'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 5 * 1024 * 1024

function validate(f: File): string {
  if (!ALLOWED.has(f.type)) return 'Only PDF and DOCX files are accepted.'
  if (f.size > MAX_BYTES) return 'File must be under 5 MB.'
  return ''
}

function ScoreRing({ score }: { score: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const fill = circ - (score / 100) * circ
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  )
}

interface PrevResume {
  file_id: string
  filename: string
  score: number | null
}

interface ResumeFile {
  file_id: string
  filename: string
  uploaded_at: string
  analyses: { score: number }[]
}

export function ResumeUpload() {
  const navigate = useNavigate()
  const { parseResult, setParseResult, analyzeResult, setAnalyzeResult, jd, setJd, githubUsername, setGithubUsername, clearAll } = useResume()
  const { user } = useAuth()

  // Ephemeral state — does not need to survive navigation
  const [file, setFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>(analyzeResult ? 'done' : 'idle')
  const [analyzeError, setAnalyzeError] = useState('')
  const [jdMode, setJdMode] = useState<JdMode>('text')
  const [jdUrl, setJdUrl] = useState('')
  const [fetchingJd, setFetchingJd] = useState(false)
  const [jdFetchError, setJdFetchError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [prevResume, setPrevResume] = useState<PrevResume | null>(null)
  const [showGithubInfo, setShowGithubInfo] = useState(false)
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; username: string | null } | null>(null)
  const [githubSuccessMsg, setGithubSuccessMsg] = useState('')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!user || parseResult) return
    axios.get<ResumeFile[]>(`${apiBaseUrl}/api/resume/history`)
      .then(res => {
        if (res.data.length > 0) {
          const latest = res.data[0]
          setPrevResume({
            file_id: latest.file_id,
            filename: latest.filename,
            score: latest.analyses[0]?.score ?? null,
          })
        }
      })
      .catch(() => {})
  }, [user, parseResult])

  useEffect(() => {
    if (!user) { setGithubStatus(null); return }
    axios.get<{ connected: boolean; username: string | null }>(`${apiBaseUrl}/api/auth/github/status`)
      .then(res => setGithubStatus(res.data))
      .catch(() => setGithubStatus({ connected: false, username: null }))
  }, [user])

  useEffect(() => {
    const param = searchParams.get('github')
    if (param === 'connected') {
      setGithubSuccessMsg('GitHub connected successfully!')
      navigate('/home', { replace: true })
    } else if (param === 'error') {
      setGithubSuccessMsg('Could not connect GitHub. Please try again.')
      navigate('/home', { replace: true })
    }
  }, [])

  function pick(f: File) {
    const err = validate(f)
    if (err) { setErrorMsg(err); setUploadState('error'); return }
    setFile(f)
    setErrorMsg('')
    setUploadState('idle')
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) pick(f)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) pick(f)
    else setUploadState('idle')
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setUploadState('dragover')
  }

  function removeFile(e: React.MouseEvent) {
    e.stopPropagation()
    setFile(null)
    setErrorMsg('')
    setUploadState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function upload() {
    if (!file) return
    setUploadState('uploading')
    setErrorMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post<ParseResult>(`${apiBaseUrl}/api/resume/upload`, form)
      setParseResult(res.data)
      setAnalyzeState('idle')
      setAnalyzeResult(null)
      setJd('')
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      setErrorMsg(detail ?? 'Upload failed. Please try again.')
      setUploadState('error')
    } finally {
      setUploadState('idle')
    }
  }

  async function analyze() {
    if (!parseResult || !jd.trim()) return
    setAnalyzeState('analyzing')
    setAnalyzeError('')
    try {
      const res = await axios.post<AnalyzeResult>(`${apiBaseUrl}/api/resume/analyze`, {
        file_id: parseResult.file_id,
        job_description: jd,
        github_username: githubUsername.trim() || null,
      })
      setAnalyzeResult(res.data)
      setAnalyzeState('done')
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      setAnalyzeError(detail ?? 'Analysis failed. Please try again.')
      setAnalyzeState('error')
    }
  }

  async function fetchAndAnalyze() {
    if (!parseResult || !jdUrl.trim()) return
    const url = jdUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setJdFetchError('Please enter a valid URL starting with http:// or https://')
      return
    }
    setFetchingJd(true)
    setJdFetchError('')
    try {
      const fetchRes = await axios.post<{ text: string }>(`${apiBaseUrl}/api/resume/fetch-jd`, { url })
      const text = fetchRes.data.text
      setJd(text)
      setAnalyzeState('analyzing')
      const analyzeRes = await axios.post<AnalyzeResult>(`${apiBaseUrl}/api/resume/analyze`, {
        file_id: parseResult.file_id,
        job_description: text,
        github_username: githubUsername.trim() || null,
      })
      setAnalyzeResult(analyzeRes.data)
      setAnalyzeState('done')
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      setJdFetchError(detail ?? 'Could not fetch the job description. Try pasting it directly.')
      setAnalyzeState('idle')
    } finally {
      setFetchingJd(false)
    }
  }

  async function handleGithubConnect() {
    try {
      const res = await axios.get<{ url: string }>(`${apiBaseUrl}/api/auth/github/connect`)
      window.location.href = res.data.url
    } catch {
      setGithubSuccessMsg('Could not start GitHub connection. Try again.')
    }
  }

  function resetJdMode() {
    setAnalyzeState('idle')
    setAnalyzeResult(null)
    setJd('')
    setJdMode('text')
    setJdUrl('')
    setJdFetchError('')
    setAnalyzeError('')
  }

  function reset() {
    setFile(null)
    setErrorMsg('')
    setUploadState('idle')
    setAnalyzeState('idle')
    setAnalyzeError('')
    setJdMode('text')
    setJdUrl('')
    setJdFetchError('')
    clearAll()
    if (inputRef.current) inputRef.current.value = ''
  }

  // Show success card if we have a parse result (persists across navigation)
  if (parseResult) {
    return (
      <div className="ru-success-card">
        <div className="ru-success-header">
          <CheckCircle2 size={20} className="ru-success-icon" aria-hidden="true" />
          <div className="ru-success-text">
            <p className="ru-success-title">Parsed successfully</p>
            <p className="ru-success-file">{parseResult.filename}</p>
          </div>
          {parseResult.word_count > 0 && (
            <span className="ru-word-count">{parseResult.word_count.toLocaleString()} words</span>
          )}
        </div>

        {parseResult.sections.length > 0 && (
          <div className="ru-sections">
            <p className="ru-sections-label">Sections detected</p>
            <div className="ru-sections-grid">
              {parseResult.sections.map((s) => (
                <span key={s} className="ru-section-badge">
                  <CheckCircle2 size={11} aria-hidden="true" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* GitHub status strip — only shown when connected */}
        {user && githubStatus?.connected && (
          <div className="ru-github-strip">
            <span className="ru-github-strip--on">
              <GitBranch size={12} aria-hidden="true" />
              GitHub: <strong>@{githubStatus.username}</strong> — repos included
            </span>
          </div>
        )}

        {/* JD input — hide when results are showing */}
        {analyzeState !== 'done' && !analyzeResult && (
          <div className="ru-jd-section">
            <div className="ru-jd-header">
              <p className="ru-jd-label">Add a job description to get your ATS score</p>
              <div className="ru-jd-mode-switch">
                <button
                  className={`ru-jd-mode-btn ${jdMode === 'text' ? 'ru-jd-mode-btn--active' : ''}`}
                  onClick={() => { setJdMode('text'); setJdFetchError('') }}
                >
                  Paste text
                </button>
                <button
                  className={`ru-jd-mode-btn ${jdMode === 'url' ? 'ru-jd-mode-btn--active' : ''}`}
                  onClick={() => { setJdMode('url'); setAnalyzeError('') }}
                >
                  <Link2 size={11} aria-hidden="true" />
                  From URL
                </button>
              </div>
            </div>

            {jdMode === 'text' ? (
              <>
                <textarea
                  className="ru-jd-textarea"
                  placeholder="Paste the full job description here…"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  rows={6}
                />
                {analyzeError && (
                  <div className="ru-error" role="alert">
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>{analyzeError}</span>
                  </div>
                )}
                <button
                  className="ru-analyze-btn"
                  disabled={!jd.trim() || analyzeState === 'analyzing'}
                  onClick={analyze}
                >
                  {analyzeState === 'analyzing' ? (
                    <><Loader2 size={17} className="spin" aria-hidden="true" /> Analyzing…</>
                  ) : (
                    <><Sparkles size={17} aria-hidden="true" /> Analyze Match</>
                  )}
                </button>
              </>
            ) : (
              <>
                <input
                  className="ru-url-input"
                  type="url"
                  placeholder="https://jobs.company.com/posting/..."
                  value={jdUrl}
                  onChange={(e) => { setJdUrl(e.target.value); setJdFetchError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAndAnalyze()}
                  disabled={fetchingJd}
                />
                {jdFetchError && (
                  <div className="ru-error" role="alert">
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>{jdFetchError}</span>
                  </div>
                )}
                <button
                  className="ru-analyze-btn"
                  disabled={!jdUrl.trim() || fetchingJd}
                  onClick={fetchAndAnalyze}
                >
                  {fetchingJd ? (
                    <><Loader2 size={17} className="spin" aria-hidden="true" /> {analyzeState === 'analyzing' ? 'Analyzing…' : 'Fetching…'}</>
                  ) : (
                    <><Sparkles size={17} aria-hidden="true" /> Fetch &amp; Score</>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* ATS results */}
        {analyzeResult && (
          <div className="ru-results">
            <div className="ru-results-top">
              <div className="ru-score-wrap">
                <ScoreRing score={analyzeResult.score} />
                <p className="ru-score-label">ATS Score</p>
                {analyzeResult.github_enriched && (
                  <span className="ru-github-badge">
                    <GitBranch size={10} aria-hidden="true" /> GitHub
                  </span>
                )}
                <a
                  className="ru-score-guide-link"
                  href="#score-guide"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('score-guide')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  What does this mean?
                </a>
              </div>
              <p className="ru-summary">{analyzeResult.summary}</p>
            </div>

            <div className="ru-skills-grid">
              {analyzeResult.matched_skills.length > 0 && (
                <div className="ru-skills-col">
                  <p className="ru-skills-heading ru-skills-heading--match">Matched</p>
                  <div className="ru-skills-list">
                    {analyzeResult.matched_skills.map((s) => (
                      <span key={s} className="ru-skill-badge ru-skill-badge--match">
                        <CheckCircle2 size={11} aria-hidden="true" /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {analyzeResult.missing_skills.length > 0 && (
                <div className="ru-skills-col">
                  <p className="ru-skills-heading ru-skills-heading--miss">Missing</p>
                  <div className="ru-skills-list">
                    {analyzeResult.missing_skills.map((s) => (
                      <span key={s} className="ru-skill-badge ru-skill-badge--miss">
                        <X size={11} aria-hidden="true" /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ru-results-actions">
              <button className="ru-again-btn" onClick={resetJdMode}>
                Try another JD
              </button>
              <button
                className="ru-prep-btn"
                onClick={() => navigate('/interview', { state: { file_id: parseResult.file_id, job_description: jd } })}
              >
                <Mic size={15} aria-hidden="true" />
                Prep for this interview
              </button>
            </div>
          </div>
        )}

        <button className="ru-reset-link" onClick={reset}>
          Upload a different resume
        </button>
      </div>
    )
  }

  const isDragover = uploadState === 'dragover'

  return (
    <div className="ru-root">
      <div
        className={`ru-zone ${isDragover ? 'ru-zone--dragover' : ''} ${file ? 'ru-zone--has-file' : ''}`}
        onClick={() => !file && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setUploadState('idle')}
        role={file ? undefined : 'button'}
        tabIndex={file ? undefined : 0}
        onKeyDown={(e) => e.key === 'Enter' && !file && inputRef.current?.click()}
        aria-label={file ? undefined : 'Upload resume'}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="ru-input"
          onChange={onInputChange}
        />

        {!file ? (
          <div className="ru-empty">
            <UploadCloud
              className={`ru-cloud-icon ${isDragover ? 'ru-cloud-icon--active' : ''}`}
              aria-hidden="true"
            />
            <p className="ru-drop-title">
              {isDragover ? 'Drop it here' : 'Drag & drop your resume here'}
            </p>
            <p className="ru-drop-sub">
              or <span className="ru-browse">browse files</span>
            </p>
            <p className="ru-formats">PDF or DOCX · max 5 MB</p>
          </div>
        ) : (
          <div className="ru-file-row">
            <FileText className="ru-file-icon" aria-hidden="true" />
            <div className="ru-file-meta">
              <span className="ru-file-name">{file.name}</span>
              <span className="ru-file-size">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
            <button className="ru-remove-btn" onClick={removeFile} aria-label="Remove file">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="ru-error" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        className="ru-upload-btn"
        disabled={!file || uploadState === 'uploading'}
        onClick={upload}
      >
        {uploadState === 'uploading' ? (
          <><Loader2 size={17} className="spin" aria-hidden="true" /> Uploading…</>
        ) : (
          <><UploadCloud size={17} aria-hidden="true" /> Upload &amp; Analyze</>
        )}
      </button>

      {prevResume && (
        <div className="ru-prev-resume">
          <span className="ru-prev-divider">or</span>
          <button
            className="ru-prev-btn"
            onClick={() => setParseResult({
              file_id: prevResume.file_id,
              filename: prevResume.filename,
              word_count: 0,
              chunk_count: 0,
              sections: [],
            })}
          >
            <History size={15} aria-hidden="true" />
            Use previous resume
            <span className="ru-prev-filename">{prevResume.filename}</span>
            {prevResume.score !== null && (
              <span
                className="ru-prev-score"
                style={{ background: prevResume.score >= 70 ? '#22c55e' : prevResume.score >= 45 ? '#f59e0b' : '#ef4444' }}
              >
                {prevResume.score}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="ru-github-section">
        <div className="ru-github-optional-label">
          <span>Enhance your score</span>
          <span className="ru-github-optional-tag">optional</span>
        </div>
        {githubSuccessMsg && (
          <p className={`ru-github-msg ${githubSuccessMsg.startsWith('Could') ? 'ru-github-msg--error' : 'ru-github-msg--success'}`}>
            {githubSuccessMsg}
          </p>
        )}
        {user ? (
          githubStatus?.connected ? (
            <div className="ru-github-connected-badge">
              <GitBranch size={13} aria-hidden="true" />
              <span>GitHub connected as <strong>@{githubStatus.username}</strong> — repos included in analysis.</span>
            </div>
          ) : (
            <button className="ru-github-connect-btn" onClick={handleGithubConnect}>
              <GitBranch size={14} aria-hidden="true" />
              Connect GitHub
            </button>
          )
        ) : (
          <div className="ru-github-row">
            <GitBranch size={14} className="ru-github-icon" aria-hidden="true" />
            <input
              className="ru-github-input"
              type="text"
              placeholder="GitHub username (optional)"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
            />
          </div>
        )}
        <button
          className="ru-github-info-toggle"
          onClick={() => setShowGithubInfo(v => !v)}
        >
          <HelpCircle size={12} aria-hidden="true" />
          What does this do?
        </button>
        {showGithubInfo && (
          <div className="ru-github-info">
            HireReady connects to GitHub via <strong>MCP (Model Context Protocol)</strong> — an open standard that lets AI call external tools. We spin up a GitHub MCP server and use its tools to fetch your top public repos and README content. That real project evidence gets injected into the ATS analysis — skills you've shipped in code count toward your score, even if they're not written on your resume.
          </div>
        )}
      </div>
    </div>
  )
}
