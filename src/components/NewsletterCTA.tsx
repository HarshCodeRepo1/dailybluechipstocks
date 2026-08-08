import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'

export default function NewsletterCTA() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  return (
    <section className="section newsletter-cta">
      <div>
        <span className="kicker">📬 MORNING + MARKET CLOSE</span>
        <h2>Get the market without living in a stock app.</h2>
        <p>Two short, jargon-free emails on US trading days.</p>
      </div>
      <form onSubmit={submit} className="signup-form">
        <Mail size={18}/>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
        <button type="submit">{submitted ? "You're on the list ✓" : "Join free"}</button>
      </form>
    </section>
  )
}
