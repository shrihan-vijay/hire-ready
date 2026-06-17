import { useEffect, useState } from 'react'
import axios from 'axios'
import { CheckCircle2, LoaderCircle, ServerCrash } from 'lucide-react'
import './App.css'

type HealthResponse = {
  status: string
  message: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await axios.get<HealthResponse>(
          `${apiBaseUrl}/api/health`,
        )
        setHealth(response.data)
      } catch {
        setError('Could not connect to the FastAPI backend.')
      } finally {
        setLoading(false)
      }
    }

    checkBackend()
  }, [])

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="page-title">
        <div className="eyebrow">AI Resume & Interview Copilot</div>
        <h1 id="page-title">HireReady</h1>
        <p className="intro">
          A full-stack project for tailoring resumes to job descriptions and
          preparing smarter interview answers.
        </p>

        <div className="status-panel">
          {loading && (
            <div className="status-row">
              <LoaderCircle className="spin" aria-hidden="true" />
              <span>Checking backend connection...</span>
            </div>
          )}

          {!loading && health && (
            <div className="status-row success">
              <CheckCircle2 aria-hidden="true" />
              <span>Backend status: {health.message}</span>
            </div>
          )}

          {!loading && error && (
            <div className="status-row error">
              <ServerCrash aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
