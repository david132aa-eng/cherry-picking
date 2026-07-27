import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, signInWithGoogle, signOut } from './firebase'
import { loadRoutedPackages } from './services/sheetsService'
import Login from './components/Login'
import Scanner from './components/Scanner'

export default function App() {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [routedPackages, setRoutedPackages] = useState(new Set())
  const [authLoading, setAuthLoading] = useState(true)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routesError, setRoutesError] = useState(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [loginError, setLoginError] = useState(null)

  const fetchRoutes = async (token) => {
    setLoadingRoutes(true)
    setRoutesError(null)
    try {
      const ids = await loadRoutedPackages(token)
      setRoutedPackages(new Set(ids))
    } catch (err) {
      if (err.status === 401) {
        setNeedsReauth(true)
        sessionStorage.removeItem('cp_gtoken')
      } else {
        setRoutesError(err.message)
      }
    } finally {
      setLoadingRoutes(false)
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const stored = sessionStorage.getItem('cp_gtoken')
        if (stored) {
          setAccessToken(stored)
          fetchRoutes(stored)
        } else {
          setNeedsReauth(true)
        }
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const handleSignIn = async () => {
    setLoginError(null)
    try {
      const { user: u, accessToken: token } = await signInWithGoogle()
      sessionStorage.setItem('cp_gtoken', token)
      setUser(u)
      setAccessToken(token)
      setNeedsReauth(false)
      await fetchRoutes(token)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setLoginError('Error al iniciar sesión: ' + err.message)
      }
    }
  }

  const handleSignOut = async () => {
    await signOut()
    sessionStorage.removeItem('cp_gtoken')
    setUser(null)
    setAccessToken(null)
    setRoutedPackages(new Set())
    setNeedsReauth(false)
  }

  if (authLoading) {
    return (
      <div className="loading-screen" role="status">
        <div className="loading-spinner" aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  if (!user || needsReauth) {
    return (
      <Login
        onSignIn={handleSignIn}
        error={loginError}
        needsReauth={needsReauth}
      />
    )
  }

  return (
    <Scanner
      user={user}
      accessToken={accessToken}
      routedPackages={routedPackages}
      loadingRoutes={loadingRoutes}
      routesError={routesError}
      onSignOut={handleSignOut}
      onRefreshRoutes={() => fetchRoutes(accessToken)}
    />
  )
}
