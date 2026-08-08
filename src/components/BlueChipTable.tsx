import { stocks } from '../data/market'

export default function BlueChipTable() {
  return (
    <section className="section" id="watchlist">
      <div className="section-heading">
        <div>
          <span className="kicker">⭐ CORE WATCHLIST</span>
          <h2>Top 10 Blue Chip Stocks</h2>
        </div>
        <button className="text-button">View all →</button>
      </div>

      <div className="table-card">
        <div className="stock-table header-row">
          <span>Company</span><span>Price</span><span>Change</span><span>Opportunity</span>
        </div>
        {stocks.map((stock) => (
          <div className="stock-table" key={stock.ticker}>
            <div className="company-cell">
              <div className="mini-avatar">{stock.company[0]}</div>
              <div><strong>{stock.company}</strong><small>{stock.ticker}</small></div>
            </div>
            <strong>${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            <span className={stock.change >= 0 ? 'positive' : 'negative'}>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%</span>
            <span className={`signal-badge ${stock.tone}`}>{stock.signal}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
