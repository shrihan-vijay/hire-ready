import { UserCircle2, Lock } from 'lucide-react'
import './PlaceholderPage.css'

export function ProfilePage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon-wrap">
        <UserCircle2 size={40} />
      </div>
      <h1 className="placeholder-title">Profile</h1>
      <p className="placeholder-desc">
        Sign in to save your resumes, track your ATS scores over time, and access your analysis history from any device.
      </p>
      <div className="placeholder-badge">
        <Lock size={13} />
        Coming with authentication
      </div>
    </div>
  )
}
