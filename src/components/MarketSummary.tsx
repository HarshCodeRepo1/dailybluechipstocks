import { TrendingUp } from 'lucide-react'
import { indices } from '../data/market'

export default function MarketSummary() {
  return (
    <section className="section" id="market">
      <div className="market-summary">
        <div className="market-copy">
          <div className="section-kicker"><TrendingUp size={17}/> MARKET IN 60 SECONDS</div>
          <h2>Markets are cautiously positive</h2>
          <p>Tech is leading while energy is mixed. Inflation data remains the biggest item investors are watching today.</p>
          <div className="trend-pill">Overall trend: <strong>Slightly Positive</strong></div>
        </div>

        <div className="index-grid">
          {indices.map((index) => (
            <article className="index-card" key={index.name}>
              <span>{index.name}</span>
              <strong>{index.value}</strong>
              <small>{index.change}</small>
              <div className="mini-chart">╱╲╱╲╱╲╱╲╱</div>
            </article>
          ))}
        </div>
      </div>

      <div className="watch-strip">
        <strong>Today to watch</strong>
        <span>8:30 AM ET · CPI Inflation Data</span>
        <span>Earnings · Walmart, Cisco</span>
        <span>10:30 AM ET · Oil Inventories</span>
      </div>
    </section>
  )
}
