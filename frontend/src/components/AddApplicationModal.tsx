import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Loader2, X } from 'lucide-react'
import './AddApplicationModal.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export interface ApplicationPrefill {
  companyName?: string
  jobTitle?: string
  jobUrl?: string
  fileId?: string | null
  score?: number
  jdSnippet?: string
}

interface Props {
  prefill?: ApplicationPrefill
  onClose: () => void
  onCreated: () => void
}

export function AddApplicationModal({ prefill, onClose, onCreated }: Props) {
  const [companyName, setCompanyName] = useState(prefill?.companyName ?? '')
  const [jobTitle, setJobTitle] = useState(prefill?.jobTitle ?? '')
  const [jobUrl, setJobUrl] = useState(prefill?.jobUrl ?? '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function submit() {
    if (!companyName.trim() || !jobTitle.trim()) {
      setError('Company and job title are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await axios.post(`${apiBaseUrl}/api/applications/`, {
        company_name: companyName.trim(),
        job_title: jobTitle.trim(),
        job_url: jobUrl.trim() || null,
        file_id: prefill?.fileId ?? null,
        score: prefill?.score ?? null,
        jd_snippet: prefill?.jdSnippet ?? null,
        notes: notes.trim() || null,
      })
      onCreated()
    } catch {
      setError('Could not save this application. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="aam-overlay" onClick={onClose}>
      <div
        className="aam-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aam-title"
      >
        <div className="aam-header">
          <h3 id="aam-title">Track this application</h3>
          <button className="aam-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="aam-field">
          <label htmlFor="aam-company">Company *</label>
          <input id="aam-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" autoFocus />
        </div>

        <div className="aam-field">
          <label htmlFor="aam-job-title">Job title *</label>
          <input id="aam-job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Software Engineer" />
        </div>

        <div className="aam-field">
          <label htmlFor="aam-job-url">Job URL</label>
          <input id="aam-job-url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://…" />
        </div>

        <div className="aam-field">
          <label htmlFor="aam-notes">Notes</label>
          <textarea id="aam-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
        </div>

        {error && <p className="aam-error" role="alert">{error}</p>}

        <div className="aam-actions">
          <button className="aam-btn aam-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="aam-btn aam-btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
