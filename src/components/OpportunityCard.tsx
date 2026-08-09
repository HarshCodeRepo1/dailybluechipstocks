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
        <span className={`signal-badge ${stock.tone}`}>{stock.signal}</span>
      </div>

      <div className="opportunity-meta">
        <div><small>Price</small><strong>{stock.price == null ? '—' : `$${stock.price.toFixed(2)}`}</strong></div>
        <div><small>Market date</small><strong>{stock.marketDate ?? '—'}</strong></div>
      </div>

      <div className="opportunity-copy">
        <div>
          <small>Data status</small>
          <p>This price came from our AWS cache, populated by the scheduled Marketstack ingestion job.</p>
        </div>
        <div className="why-card">
          <div>
            <small>Next calculation step</small>
            <p>After the historical backfill, this card will show the real 1M–1Y low signal and opportunity score.</p>
          </div>
          <div className="round-icon"><ArrowUpRight size={21}/></div>
        </div>
      </div>
    </article>
  )
}
