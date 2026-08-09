export type SignalTone = 'positive' | 'watch' | 'negative' | 'neutral'

export type Stock = {
  ticker: string
  company: string
  price: number | null
  change: number | null
  signal: string
  score: number
  tone: SignalTone
  sector?: string
  marketDate?: string | null
  updatedAt?: string | null
  dataSource?: string
  reason?: string
  whyItMatters?: string
}

export type IndexSnapshot = {
  name: string
  value: string
  change: string
}
