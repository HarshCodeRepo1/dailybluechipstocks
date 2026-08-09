export type SignalTone =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'watch'

export type Stock = {
  ticker: string
  company: string
  sector?: string

  price: number | null
  change: number | null

  signal: string
  score: number
  tone: SignalTone

  marketDate?: string | null
  updatedAt?: string | null
  dataSource?: string | null

  signalSide?: 'LOW' | 'HIGH' | 'NORMAL'
  signalPeriod?: string | null

  rangeLow?: number | null
  rangeHigh?: number | null

  signalThresholdPercent?: number | null
  signalCalculatedAt?: string | null

  // keep old demo/mock data compiling for now
  reason?: string
  whyItMatters?: string
}

export type IndexSnapshot = {
  name: string
  value: string
  change: string
}