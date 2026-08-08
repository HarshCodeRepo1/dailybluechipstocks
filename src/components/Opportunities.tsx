import { stocks } from '../data/market'
import OpportunityCard from './OpportunityCard'

export default function Opportunities() {
  const top = [...stocks].sort((a, b) => b.score - a.score).slice(0, 2)
  return (
    <section className="section" id="opportunities">
      <div className="section-heading">
        <div><span className="kicker">🚀 TODAY'S BEST</span><h2>Opportunities worth your attention</h2></div>
        <button className="text-button">View all opportunities →</button>
      </div>
      <div className="opportunity-grid">
        {top.map((stock, index) => <OpportunityCard key={stock.ticker} stock={stock} rank={index + 1} />)}
      </div>
    </section>
  )
}
