import { useState } from 'react'
import Header from '../components/Header'
import Hero from '../components/Hero'
import MarketSummary from '../components/MarketSummary'
import BlueChipTable from '../components/BlueChipTable'
import Opportunities from '../components/Opportunities'
import InsightCards from '../components/InsightCards'
import OptionIdea from '../components/OptionIdea'
import NewsletterCTA from '../components/NewsletterCTA'
import Footer from '../components/Footer'
import LoginModal from '../components/LoginModal'
import type { Stock } from '../types/market'

export default function Home({ marketStocks = [] }: { marketStocks?: Stock[] }) {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <>
      <div className="page-shell">
        <Header onLogin={() => setLoginOpen(true)} />
        <main>
          <Hero stocks={marketStocks} />
          <MarketSummary />
          <BlueChipTable stocks={marketStocks} />
          <Opportunities stocks={marketStocks} />
          <InsightCards />
          <OptionIdea />
          <NewsletterCTA />
        </main>
        <Footer />
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  )
}
