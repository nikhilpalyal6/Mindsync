import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

const fetchCurrentUser = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Unable to fetch user')
  }
  const data = await response.json()
  return data.data
}

const refreshAccessToken = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Unable to refresh token')
  }
  const data = await response.json()
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
    } catch {
      // Don't set user to null - keep existing session if fetch fails
      // This prevents logging out the user during verification
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
