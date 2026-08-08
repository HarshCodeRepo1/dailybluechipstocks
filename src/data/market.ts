import type { IndexSnapshot, Stock } from '../types/market'

export const indices: IndexSnapshot[] = [
  { name: 'S&P 500', value: '5,426.91', change: '+0.78%' },
  { name: 'NASDAQ', value: '17,189.82', change: '+0.91%' },
  { name: 'DOW JONES', value: '39,765.64', change: '+0.23%' },
]

export const stocks: Stock[] = [
  { ticker: 'AAPL', company: 'Apple', price: 181.26, change: -1.32, signal: 'Lowest in 4M', score: 80, tone: 'positive', reason: 'Slower iPhone sales in China worried investors.', whyItMatters: 'Apple still has strong cash flow, services revenue and share buybacks.' },
  { ticker: 'MSFT', company: 'Microsoft', price: 499.18, change: -0.48, signal: 'Near 3M Low', score: 68, tone: 'watch', reason: 'Investors are watching cloud growth and AI spending.', whyItMatters: 'The core business remains diversified and highly profitable.' },
  { ticker: 'GOOGL', company: 'Google', price: 192.78, change: 0.28, signal: 'Normal Range', score: 45, tone: 'neutral' },
  { ticker: 'AMZN', company: 'Amazon', price: 224.11, change: 0.62, signal: 'Normal Range', score: 42, tone: 'neutral' },
  { ticker: 'NVDA', company: 'Nvidia', price: 171.32, change: -0.76, signal: 'Near 1Y High', score: 25, tone: 'negative' },
  { ticker: 'META', company: 'Meta', price: 824.65, change: -0.31, signal: 'Normal Range', score: 40, tone: 'neutral' },
  { ticker: 'V', company: 'Visa', price: 360.94, change: -1.02, signal: 'Lowest in 5M', score: 78, tone: 'positive', reason: 'Weaker consumer spending data raised concerns.', whyItMatters: 'Visa earns a small fee on massive transaction volume across its network.' },
  { ticker: 'COST', company: 'Costco', price: 1072.88, change: 0.09, signal: 'Normal Range', score: 39, tone: 'neutral' },
  { ticker: 'JPM', company: 'JPMorgan', price: 314.98, change: -0.95, signal: 'Lowest in 2M', score: 58, tone: 'positive' },
  { ticker: 'BRK.B', company: 'Berkshire', price: 506.45, change: 0.06, signal: 'Normal Range', score: 44, tone: 'neutral' },
]
