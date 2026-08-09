import type { Stock } from '../types/market'
import OpportunityCard from './OpportunityCard'

export default function Opportunities({
  stocks = [],
}: {
  stocks?: Stock[]
}) {
  const opportunities = stocks
    .filter((stock) => stock.signalSide === 'LOW')
    .slice(0, 3)

  return (
    <section className="section" id="opportunities">
      <div className="section-heading">
        <div>
          <span className="kicker">🚀 YOUR OPPORTUNITIES</span>
          <h2>
            {opportunities.length
              ? 'Stocks trading near historical lows'
              : 'No low-range opportunities right now'}
          </h2>
        </div>
      </div>

      {opportunities.length ? (
        <div className="opportunity-grid">
          {opportunities.map((stock, index) => (
            <OpportunityCard
              key={stock.ticker}
              stock={stock}
              rank={index + 1}
            />
          ))}
        </div>
      ) : (
        <div className="table-card" style={{ padding: 24 }}>
          Your selected stocks are currently either NORMAL or trading near
          recent highs.
        </div>
      )}
    </section>
  )
}
