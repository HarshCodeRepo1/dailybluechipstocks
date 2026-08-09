import type { Stock } from '../types/market'
import OpportunityCard from './OpportunityCard'

export default function Opportunities({ stocks = [] }: { stocks?: Stock[] }) {
  const top = stocks.slice(0, 2)

  return (
    <section className="section" id="opportunities">
      <div className="section-heading">
        <div>
          <span className="kicker">🚀 YOUR MARKET DATA</span>
          <h2>{top.length ? 'Stocks you asked us to watch' : 'Opportunities worth your attention'}</h2>
        </div>
      </div>

      {top.length ? (
        <div className="opportunity-grid">
          {top.map((stock, index) => (
            <OpportunityCard key={stock.ticker} stock={stock} rank={index + 1} />
          ))}
        </div>
      ) : (
        <div className="table-card" style={{ padding: 24 }}>
          Sign in and save preferences to personalize this section.
        </div>
      )}
    </section>
  )
}
