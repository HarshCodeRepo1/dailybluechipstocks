import { X } from 'lucide-react'
import { useAuth } from 'react-oidc-context'

export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth()
  if (!open) return null

  const signIn = async () => {
    onClose()
    await auth.signinRedirect()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="login-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={20}/></button>
        <h2>Welcome</h2>
        <p>Sign in or create an account to manage newsletter preferences and your watchlist.</p>
        <button className="primary-button full" onClick={signIn} disabled={auth.isLoading}>
          <span>{auth.isLoading ? 'Loading…' : 'Continue to secure sign in'}</span>
        </button>
        <small>Secure authentication is provided by Amazon Cognito.</small>
      </div>
    </div>
  )
}
