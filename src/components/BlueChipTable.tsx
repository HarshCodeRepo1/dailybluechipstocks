import type { Stock } from '../types/market'

function money(price: number | null | undefined) {
  return price == null
    ? '—'
    : `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
}

export default function BlueChipTable({
  stocks = [],
}: {
  stocks?: Stock[]
}) {
  return (
    <section className="section" id="watchlist">
      <div className="section-heading">
        <div>
          <span className="kicker">⭐ YOUR WATCHLIST</span>
          <h2>
            {stocks.length
              ? 'Your personalized blue-chip signals'
              : 'Top Blue Chip Stocks'}
          </h2>
        </div>
      </div>

      <div className="table-card">
        <div className="stock-table header-row">
          <span>Company</span>
          <span>Price</span>
          <span>Updated</span>
          <span>Signal</span>
        </div>

        {stocks.length === 0 ? (
          <div style={{ padding: 24 }}>
            Sign in and choose stocks or sectors to load your personalized
            signals.
          </div>
        ) : (
          stocks.map((stock) => (
            <div className="stock-table" key={stock.ticker}>
              <div className="company-cell">
                <div className="mini-avatar">{stock.company[0]}</div>

                <div>
                  <strong>{stock.company}</strong>
                  <small>{stock.ticker}</small>
                </div>
              </div>

              <strong>{money(stock.price)}</strong>

              <span>{stock.marketDate ?? '—'}</span>

              <span className={`signal-badge ${stock.tone}`}>
                {stock.signal}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
