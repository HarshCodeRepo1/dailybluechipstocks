import { ArrowUpRight } from 'lucide-react'
import type { Stock } from '../types/market'

function money(price: number | null | undefined) {
  return price == null ? '—' : `$${price.toFixed(2)}`
}

export default function OpportunityCard({
  stock,
  rank,
}: {
  stock: Stock
  rank: number
}) {
  return (
    <article className="opportunity-card">
      <div className="opportunity-title">
        <div className="rank">{rank}</div>

        <div>
          <h3>{stock.company}</h3>
          <small>{stock.ticker}</small>
        </div>

        <span className={`signal-badge ${stock.tone}`}>
          {stock.signal}
        </span>
      </div>

      <div className="opportunity-meta">
        <div>
          <small>Price</small>
          <strong>{money(stock.price)}</strong>
        </div>

        <div>
          <small>Market date</small>
          <strong>{stock.marketDate ?? '—'}</strong>
        </div>
      </div>

      <div className="opportunity-copy">
        <div>
          <small>Price position</small>
          <p>
            {stock.signalSide === 'LOW'
              ? `This stock is trading within ${stock.signalThresholdPercent ?? 1}% of its ${stock.signalPeriod ?? 'recent'} low.`
              : stock.signalSide === 'HIGH'
              ? `This stock is trading near its ${stock.signalPeriod ?? 'recent'} high.`
              : 'This stock is trading within its recent historical range.'}
          </p>
        </div>

        <div className="why-card">
          <div>
            <small>Observed range</small>
            <p>
              {stock.rangeLow != null && stock.rangeHigh != null
                ? `${money(stock.rangeLow)} – ${money(stock.rangeHigh)}`
                : 'Range data unavailable'}
            </p>
          </div>

          <div className="round-icon">
            <ArrowUpRight size={21} />
          </div>
        </div>
      </div>
    </article>
  )
}
