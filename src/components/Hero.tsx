import { ArrowRight, Sparkles } from 'lucide-react'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={16}/> Your market in under 5 minutes</div>
        <h1>Great companies.<br/><span>Interesting prices.</span></h1>
        <p>We watch quality stocks for meaningful price opportunities and explain what changed in plain English.</p>
        <div className="hero-actions">
          <a className="primary-button" href="#opportunities">See today's opportunities <ArrowRight size={17}/></a>
          <a className="secondary-button" href="#watchlist">View blue-chip watchlist</a>
        </div>
      </div>
      <div className="hero-card">
        <div className="hero-card-top">
          <span>Today's signal</span><span className="live-dot">LIVE</span>
        </div>
        <div className="hero-stock">
          <div className="stock-avatar">A</div>
          <div><strong>Apple</strong><small>AAPL</small></div>
          <div className="hero-price"><strong>$181.26</strong><small className="negative">-1.32%</small></div>
        </div>
        <div className="signal-card">
          <small>PRICE SIGNAL</small>
          <strong>Lowest in 4 months</strong>
          <span className="score-pill">80/100</span>
        </div>
        <p className="plain-explainer"><strong>In plain English:</strong> Apple has recently become cheaper without a clear collapse in its core business.</p>
      </div>
    </section>
  )
}
