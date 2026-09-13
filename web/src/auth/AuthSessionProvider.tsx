import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LoginRequiredError, type User } from '@workos-inc/authkit-js'
import { getAuthClient, getAuthInitError, startWorkosSignIn, switchWorkosAccount, type AuthClient } from './client'

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  initError: Error | null
  signIn: (opts?: { state?: { returnTo?: string } }) => Promise<void>
  switchAccount: (opts?: { state?: { returnTo?: string } }) => Promise<void>
  signOut: AuthClient['signOut']
  getAccessToken: AuthClient['getAccessToken']
  getSignInUrl: AuthClient['getSignInUrl']
}

const AuthContext = createContext<AuthContextValue | null>(null)

const notReady = () => Promise.reject(new LoginRequiredError())

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<AuthClient | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [initError, setInitError] = useState<Error | null>(null)

  useEffect(() => {
    void getAuthClient()
      .then((client) => {
        clientRef.current = client
        setUser(client.getUser())
        setInitError(getAuthInitError())
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err : getAuthInitError())
        setIsLoading(false)
      })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      initError,
      signIn: (opts) => startWorkosSignIn(opts?.state),
      switchAccount: (opts) => switchWorkosAccount(opts?.state),
      signOut: (opts) => clientRef.current?.signOut(opts) ?? Promise.resolve(),
      getAccessToken: (opts) => clientRef.current?.getAccessToken(opts) ?? notReady(),
      getSignInUrl: (opts) => clientRef.current?.getSignInUrl(opts) ?? Promise.resolve(''),
    }),
    [user, isLoading, initError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthSessionProvider')
  return ctx
}
