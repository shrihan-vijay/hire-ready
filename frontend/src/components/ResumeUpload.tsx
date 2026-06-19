import { ChangeEvent, DragEvent, useRef, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import './ResumeUpload.css'

type UploadState = 'idle' | 'dragover' | 'uploading' | 'success' | 'error'

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

export function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadedName, setUploadedName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function pick(f: File) {
    const err = validate(f)
    if (err) {
      setErrorMsg(err)
      setState('error')
      return
    }
    setFile(f)
    setErrorMsg('')
    setState('idle')
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) pick(f)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) pick(f)
    else setState('idle')
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setState('dragover')
  }

  function removeFile(e: React.MouseEvent) {
    e.stopPropagation()
    setFile(null)
    setErrorMsg('')
    setState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function upload() {
    if (!file) return
    setState('uploading')
    setErrorMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post<{ filename: string }>(
        `${apiBaseUrl}/api/resume/upload`,
        form,
      )
      setUploadedName(res.data.filename)
      setState('success')
    } catch (err: unknown) {
      const detail =
        axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      setErrorMsg(detail ?? 'Upload failed. Please try again.')
      setState('error')
    }
  }

  function reset() {
    setFile(null)
    setErrorMsg('')
    setState('idle')
    setUploadedName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  if (state === 'success') {
    return (
      <div className="ru-success">
        <CheckCircle2 className="ru-success-icon" aria-hidden="true" />
        <div className="ru-success-text">
          <p className="ru-success-title">Resume uploaded successfully</p>
          <p className="ru-success-file">{uploadedName}</p>
        </div>
        <button className="ru-again-btn" onClick={reset}>
          Upload another
        </button>
      </div>
    )
  }

  const isDragover = state === 'dragover'

  return (
    <div className="ru-root">
      <div
        className={`ru-zone ${isDragover ? 'ru-zone--dragover' : ''} ${file ? 'ru-zone--has-file' : ''}`}
        onClick={() => !file && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setState(file ? 'idle' : 'idle')}
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
              <span className="ru-file-size">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <button
              className="ru-remove-btn"
              onClick={removeFile}
              aria-label="Remove file"
            >
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
        disabled={!file || state === 'uploading'}
        onClick={upload}
      >
        {state === 'uploading' ? (
          <>
            <Loader2 size={17} className="spin" aria-hidden="true" />
            Uploading…
          </>
        ) : (
          <>
            <UploadCloud size={17} aria-hidden="true" />
            Upload Resume
          </>
        )}
      </button>
    </div>
  )
}
