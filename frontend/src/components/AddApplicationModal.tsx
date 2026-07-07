import { useState } from 'react'
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
      <div className="aam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aam-header">
          <h3>Track this application</h3>
          <button className="aam-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="aam-field">
          <label>Company *</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" autoFocus />
        </div>

        <div className="aam-field">
          <label>Job title *</label>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Software Engineer" />
        </div>

        <div className="aam-field">
          <label>Job URL</label>
          <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://…" />
        </div>

        <div className="aam-field">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
        </div>

        {error && <p className="aam-error">{error}</p>}

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
