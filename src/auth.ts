import type { AuthProviderProps } from 'react-oidc-context'

export const cognitoAuthConfig: AuthProviderProps = {
  authority: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_gfVsnIELk',
  client_id: '71osdnkvspv2fgoeirmm6fmee6',
  redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid email',
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}
