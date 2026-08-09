import { ArrowRight, Sparkles } from 'lucide-react'
import type { Stock } from '../types/market'

function money(price: number | null) {
  return price == null ? '—' : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Hero({ stocks = [] }: { stocks?: Stock[] }) {
  const stock = stocks[0]

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
          <span>{stock ? 'Your cached market data' : "Today's signal"}</span>
          <span className="live-dot">{stock ? 'CACHED' : 'SIGN IN'}</span>
        </div>

        {stock ? (
          <>
            <div className="hero-stock">
              <div className="stock-avatar">{stock.company[0]}</div>
              <div><strong>{stock.company}</strong><small>{stock.ticker}</small></div>
              <div className="hero-price"><strong>{money(stock.price)}</strong><small>{stock.marketDate ?? ''}</small></div>
            </div>
            <div className="signal-card">
              <small>MARKET DATA</small>
              <strong>{stock.signal}</strong>
              <span className="score-pill">{stock.dataSource ?? 'AWS'}</span>
            </div>
            <p className="plain-explainer"><strong>Source:</strong> Marketstack data cached in AWS. Website refreshes do not call the market-data provider.</p>
          </>
        ) : (
          <p className="plain-explainer"><strong>Sign in</strong> to see your selected stocks using the latest cached market data.</p>
        )}
      </div>
    </section>
  )
}
