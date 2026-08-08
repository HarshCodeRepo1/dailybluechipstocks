import { ArrowUpRight } from 'lucide-react'
import type { Stock } from '../types/market'

export default function OpportunityCard({ stock, rank }: { stock: Stock; rank: number }) {
  return (
    <article className="opportunity-card">
      <div className="opportunity-title">
        <div className="rank">{rank}</div>
        <div>
          <h3>{stock.company}</h3>
          <small>{stock.ticker}</small>
        </div>
        <span className="signal-badge positive">{stock.signal}</span>
      </div>

      <div className="opportunity-meta">
        <div><small>Price</small><strong>${stock.price.toFixed(2)}</strong></div>
        <div><small>Change</small><strong className={stock.change >= 0 ? 'positive' : 'negative'}>{stock.change.toFixed(2)}%</strong></div>
      </div>

      <div className="opportunity-copy">
        <div>
          <small>Why is it down?</small>
          <p>{stock.reason ?? 'Recent market weakness and changing investor expectations.'}</p>
        </div>
        <div className="why-card">
          <div>
            <small>Why it matters</small>
            <p>{stock.whyItMatters ?? 'The long-term business picture remains stronger than the short-term price movement suggests.'}</p>
          </div>
          <div className="round-icon"><ArrowUpRight size={21}/></div>
        </div>
      </div>
    </article>
  )
}
