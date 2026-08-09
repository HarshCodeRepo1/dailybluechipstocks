import type { NewsletterSelection } from '../api'

function money(value: number | null | undefined) {
  return value == null
    ? '—'
    : `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
}

export default function NewsletterPreview({
  newsletter,
}: {
  newsletter: NewsletterSelection
}) {
  return (
    <section className="section" id="newsletter-preview">
      <div className="section-heading">
        <div>
          <span className="kicker">✉️ YOUR NEWSLETTER PREVIEW</span>
          <h2>Your personalized market brief</h2>
          <p>
            This is the same ranked stock selection the email newsletter will
            use. It is capped at {newsletter.maxStocks} stocks.
          </p>
        </div>
      </div>

      <div className="table-card">
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e7ece9' }}>
          <strong>{newsletter.stockCount} stocks</strong>
          <span style={{ marginLeft: 16 }}>
            {newsletter.lowCount} low · {newsletter.normalCount} normal ·{' '}
            {newsletter.highCount} high
          </span>
        </div>

        <div className="stock-table header-row">
          <span>Company</span>
          <span>Price</span>
          <span>Signal</span>
          <span>Range</span>
        </div>

        {newsletter.stocks.map((stock) => (
          <div className="stock-table" key={stock.ticker}>
            <div className="company-cell">
              <div className="mini-avatar">{stock.company[0]}</div>

              <div>
                <strong>{stock.company}</strong>
                <small>{stock.ticker}</small>
              </div>
            </div>

            <strong>{money(stock.price)}</strong>

            <span className={`signal-badge ${stock.tone}`}>
              {stock.signal}
            </span>

            <span>
              {stock.rangeLow != null && stock.rangeHigh != null
                ? `${money(stock.rangeLow)} – ${money(stock.rangeHigh)}`
                : '—'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
