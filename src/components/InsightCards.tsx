import { Brain, Gauge, Lightbulb } from 'lucide-react'

export default function InsightCards() {
  return (
    <section className="section insight-grid" id="sectors">
      <article className="insight-card">
        <div className="card-icon purple"><Brain size={19}/></div>
        <h3>Sector Spotlight</h3>
        <p className="subheading">AI & Tech</p>
        <ul className="compact-list">
          <li><span>Nvidia</span><strong className="negative">Expensive</strong></li>
          <li><span>AMD</span><strong>Neutral</strong></li>
          <li><span>Microsoft</span><strong className="positive">Attractive</strong></li>
          <li><span>TSMC</span><strong className="positive">Attractive</strong></li>
        </ul>
        <button className="text-button left">View sector breakdown →</button>
      </article>

      <article className="insight-card">
        <div className="card-icon green"><Gauge size={19}/></div>
        <h3>Market Mood</h3>
        <div className="mood">CAUTIOUSLY POSITIVE</div>
        <div className="gauge"><div className="needle"/></div>
        <p>Investors remain hopeful, but are waiting for more clarity on inflation and economic growth.</p>
      </article>

      <article className="insight-card">
        <div className="card-icon yellow"><Lightbulb size={19}/></div>
        <h3>Today's Lesson</h3>
        <h4>A stock falling isn't automatically bad.</h4>
        <p>Sometimes the business gets weaker. Sometimes the price falls because investors get nervous. Great investing is learning the difference.</p>
        <button className="text-button left">Read more →</button>
      </article>
    </section>
  )
}
