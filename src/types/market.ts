export type SignalTone = 'positive' | 'watch' | 'negative' | 'neutral'

export type Stock = {
  ticker: string
  company: string
  price: number
  change: number
  signal: string
  score: number
  tone: SignalTone
  reason?: string
  whyItMatters?: string
}

export type IndexSnapshot = {
  name: string
  value: string
  change: string
}
