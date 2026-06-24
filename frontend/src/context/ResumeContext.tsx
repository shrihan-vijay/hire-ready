import { createContext, useContext, useState, ReactNode } from 'react'

export interface ParseResult {
  filename: string
  file_id: string
  word_count: number
  chunk_count: number
  sections: string[]
}

export interface AnalyzeResult {
  score: number
  matched_skills: string[]
  missing_skills: string[]
  summary: string
}

interface ResumeContextType {
  parseResult: ParseResult | null
  setParseResult: (r: ParseResult | null) => void
  analyzeResult: AnalyzeResult | null
  setAnalyzeResult: (r: AnalyzeResult | null) => void
  jd: string
  setJd: (jd: string) => void
  clearAll: () => void
}

const ResumeContext = createContext<ResumeContextType | null>(null)

export function ResumeProvider({ children }: { children: ReactNode }) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [jd, setJd] = useState('')

  function clearAll() {
    setParseResult(null)
    setAnalyzeResult(null)
    setJd('')
  }

  return (
    <ResumeContext.Provider value={{ parseResult, setParseResult, analyzeResult, setAnalyzeResult, jd, setJd, clearAll }}>
      {children}
    </ResumeContext.Provider>
  )
}

export function useResume() {
  const ctx = useContext(ResumeContext)
  if (!ctx) throw new Error('useResume must be used inside ResumeProvider')
  return ctx
}
