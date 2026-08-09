export type SignalTone = 'positive' | 'negative' | 'neutral'

export type Stock = {
  ticker: string
  company: string
  sector?: string

  price: number | null
  marketDate?: string | null
  updatedAt?: string | null
  dataSource?: string | null

  signal: string
  signalSide?: 'LOW' | 'HIGH' | 'NORMAL'
  signalPeriod?: string | null

  rangeLow?: number | null
  rangeHigh?: number | null
  signalThresholdPercent?: number | null
  signalCalculatedAt?: string | null

  score: number
  tone: SignalTone
  change: number | null
}
