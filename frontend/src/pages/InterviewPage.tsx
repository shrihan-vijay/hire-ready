import { Mic, Sparkles } from 'lucide-react'
import './PlaceholderPage.css'

export function InterviewPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon-wrap">
        <Mic size={40} />
      </div>
      <h1 className="placeholder-title">Interview Prep</h1>
      <p className="placeholder-desc">
        Upload your resume and a job description, and get AI-generated interview questions tailored to the role — with suggested answers grounded in your actual experience.
      </p>
      <div className="placeholder-badge">
        <Sparkles size={13} />
        Coming soon
      </div>
    </div>
  )
}
