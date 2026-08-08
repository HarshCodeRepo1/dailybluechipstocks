import { Bell, LogOut, Menu, UserRound } from 'lucide-react'
import { useAuth } from 'react-oidc-context'

type Props = {
  onLogin: () => void
}

export default function Header({ onLogin }: Props) {
  const auth = useAuth()
  const email = auth.user?.profile.email
  const displayName = auth.user?.profile.name || email

  const signOut = async () => {
    await auth.removeUser()
    window.location.href = '/'
  }

  return (
    <header className="site-header">
      <div className="brand">
        <div className="brand-mark">↗</div>
        <div>
          <div className="brand-name">DailyBlueChipStocks</div>
          <div className="brand-tag">Simple. Clear. Better investing.</div>
        </div>
      </div>

      <nav className="desktop-nav">
        <a href="#market">Today</a>
        <a href="#watchlist">Blue Chips</a>
        <a href="#opportunities">Opportunities</a>
        <a href="#sectors">Sectors</a>
      </nav>

      <div className="header-actions">
        <button className="icon-button" aria-label="Notifications"><Bell size={18} /></button>
        {auth.isAuthenticated ? (
          <>
            <span className="signed-in-user"><UserRound size={17} /> {displayName}</span>
            <button className="login-button" onClick={signOut}><LogOut size={17} /> Sign out</button>
          </>
        ) : (
          <button className="login-button" onClick={onLogin}><UserRound size={17} /> Sign in</button>
        )}
        <button className="mobile-menu" aria-label="Menu"><Menu size={20} /></button>
      </div>
    </header>
  )
}
