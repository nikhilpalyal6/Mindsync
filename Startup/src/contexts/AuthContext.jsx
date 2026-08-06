import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

const fetchCurrentUser = async () => {
  console.log('[AUTH CONTEXT] fetchCurrentUser triggered...');
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  })
  console.log('[AUTH CONTEXT] fetchCurrentUser status:', response.status);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.warn('[AUTH CONTEXT] fetchCurrentUser failed:', errorData.message);
    throw new Error(errorData.message || 'Unable to fetch user')
  }
  const data = await response.json()
  console.log('[AUTH CONTEXT] fetchCurrentUser succeeded for user:', data?.data?.email);
  return data.data
}

const refreshAccessToken = async () => {
  console.log('[AUTH CONTEXT] refreshAccessToken triggered...');
  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    credentials: 'include',
  })
  console.log('[AUTH CONTEXT] refreshAccessToken status:', response.status);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.warn('[AUTH CONTEXT] refreshAccessToken failed:', errorData.message);
    throw new Error(errorData.message || 'Unable to refresh token')
  }
  const data = await response.json()
  console.log('[AUTH CONTEXT] refreshAccessToken succeeded.');
  return data.data.accessToken
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const initialize = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        setUser(currentUser)
      } catch (err) {
        try {
          await refreshAccessToken()
          const currentUser = await fetchCurrentUser()
          setUser(currentUser)
        } catch {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  const signOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
    }
  }

  const loginComplete = async () => {
    try {
      const currentUser = await fetchCurrentUser()
      setUser(currentUser)
      return currentUser
    } catch {
      // Don't set user to null - keep existing session if fetch fails
      // This prevents logging out the user during verification
      return null
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, error, setError, signOut, loginComplete, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
