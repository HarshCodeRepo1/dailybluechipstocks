import { ArrowRight, Sparkles } from 'lucide-react'
import type { Stock } from '../types/market'

function money(price: number | null | undefined) {
  return price == null
    ? '—'
    : `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
}

function signalDescription(stock: Stock) {
  if (stock.signalSide === 'LOW') {
    return `Trading near the low end of its ${stock.signalPeriod ?? 'recent'} range.`
  }

  if (stock.signalSide === 'HIGH') {
    return `Trading near the high end of its ${stock.signalPeriod ?? 'recent'} range.`
  }

  return 'Trading within its recent historical range.'
}

export default function Hero({ stocks = [] }: { stocks?: Stock[] }) {
  const stock = stocks[0]

  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <Sparkles size={16} />
          Your market in under 5 minutes
        </div>

        <h1>
          Great companies.
          <br />
          <span>Interesting prices.</span>
        </h1>

        <p>
          We watch quality stocks for meaningful price opportunities and explain
          what changed in plain English.
        </p>

        <div className="hero-actions">
          <a className="primary-button" href="#opportunities">
            See today's opportunities <ArrowRight size={17} />
          </a>

          <a className="secondary-button" href="#watchlist">
            View blue-chip watchlist
          </a>
        </div>
      </div>

      <div className="hero-card">
        <div className="hero-card-top">
          <span>{stock ? "Top personalized signal" : "Today's signal"}</span>
          <span className="live-dot">
            {stock ? stock.dataSource ?? 'CACHED' : 'SIGN IN'}
          </span>
        </div>

        {stock ? (
          <>
            <div className="hero-stock">
              <div className="stock-avatar">{stock.company[0]}</div>

              <div>
                <strong>{stock.company}</strong>
                <small>{stock.ticker}</small>
              </div>

              <div className="hero-price">
                <strong>{money(stock.price)}</strong>
                <small>{stock.marketDate ?? ''}</small>
              </div>
            </div>

            <div className="signal-card">
              <small>PRICE POSITION</small>
              <strong>{stock.signal}</strong>
              <span className={`signal-badge ${stock.tone}`}>
                {stock.signal}
              </span>
            </div>

            <p className="plain-explainer">
              <strong>{stock.signal}:</strong> {signalDescription(stock)}
            </p>

            {stock.rangeLow != null && stock.rangeHigh != null && (
              <p className="plain-explainer">
                Recent range: <strong>{money(stock.rangeLow)}</strong> –{' '}
                <strong>{money(stock.rangeHigh)}</strong>
              </p>
            )}
          </>
        ) : (
          <p className="plain-explainer">
            <strong>Sign in</strong> to see your personalized stock signals.
          </p>
        )}
      </div>
    </section>
  )
}
