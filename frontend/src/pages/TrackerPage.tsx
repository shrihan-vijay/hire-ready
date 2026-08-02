import { useEffect, useState } from 'react'
import axios from 'axios'
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { AddApplicationModal } from '../components/AddApplicationModal'
import './TrackerPage.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type Status = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected'

interface JobApplication {
  id: string
  company_name: string
  job_title: string
  job_url: string | null
  status: Status
  score: number | null
  notes: string | null
  updated_at: string
}

const COLUMNS: { key: Status; label: string }[] = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
]

export default function TrackerPage() {
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await axios.get<JobApplication[]>(`${apiBaseUrl}/api/applications/`)
      setApplications(res.data)
    } catch {
      // leave list empty on failure
    } finally {
      setLoading(false)
    }
  }

  async function moveStatus(id: string, status: Status) {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    try {
      await axios.patch(`${apiBaseUrl}/api/applications/${id}`, { status })
    } catch {
      void load()
    }
  }

  async function remove(id: string) {
    setApplications((prev) => prev.filter((a) => a.id !== id))
    setConfirmDelete(null)
    try {
      await axios.delete(`${apiBaseUrl}/api/applications/${id}`)
    } catch {
      void load()
    }
  }

  return (
    <div className="tr-page">
      <div className="tr-header">
        <div>
          <h1 className="tr-title">Application Tracker</h1>
          <p className="tr-subtitle">Drag a card, or use its status menu, to update its status.</p>
        </div>
        <button className="tr-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add application
        </button>
      </div>

      {loading ? (
        <div className="tr-loading">
          <Loader2 size={20} className="spin" />
        </div>
      ) : (
        <div className="tr-board">
          {COLUMNS.map((col) => {
            const cards = applications.filter((a) => a.status === col.key)
            return (
              <div
                key={col.key}
                className={`tr-column ${dragOverCol === col.key ? 'tr-column--over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverCol(col.key)
                }}
                onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverCol(null)
                  const id = e.dataTransfer.getData('text/plain')
                  if (id) void moveStatus(id, col.key)
                }}
                role="region"
                aria-label={`${col.label} column, ${cards.length} application${cards.length === 1 ? '' : 's'}`}
              >
                <div className="tr-column-header">
                  <span>{col.label}</span>
                  <span className="tr-column-count">{cards.length}</span>
                </div>

                <div className="tr-column-cards" role="list">
                  {cards.map((app) => (
                    <div
                      key={app.id}
                      className="tr-card"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', app.id)}
                      role="listitem"
                      aria-label={`${app.company_name}, ${app.job_title}`}
                    >
                      <div className="tr-card-top">
                        <p className="tr-card-company">{app.company_name}</p>
                        {app.score !== null && (
                          <span className="tr-card-score">{app.score}</span>
                        )}
                      </div>
                      <p className="tr-card-title">{app.job_title}</p>
                      {app.notes && <p className="tr-card-notes">{app.notes}</p>}
                      <div className="tr-card-actions">
                        <label className="tr-card-move">
                          <span className="sr-only">Move {app.company_name} to a different status</span>
                          <select
                            value={app.status}
                            onChange={(e) => void moveStatus(app.id, e.target.value as Status)}
                          >
                            {COLUMNS.map((c) => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </select>
                        </label>
                        {app.job_url && (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noreferrer"
                            className="tr-card-link"
                            aria-label={`Open job listing for ${app.job_title} at ${app.company_name}`}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {confirmDelete === app.id ? (
                          <div className="tr-confirm">
                            <span>Delete?</span>
                            <button onClick={() => void remove(app.id)}>Yes</button>
                            <button onClick={() => setConfirmDelete(null)}>No</button>
                          </div>
                        ) : (
                          <button
                            className="tr-card-delete"
                            onClick={() => setConfirmDelete(app.id)}
                            aria-label={`Delete application for ${app.job_title} at ${app.company_name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddApplicationModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            void load()
          }}
        />
      )}
    </div>
  )
}
