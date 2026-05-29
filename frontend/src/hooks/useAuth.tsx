import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import apiService, { ApiError } from '../services/api'
import { LoginCredentials, RegisterData, User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const token = apiService.getStoredToken()

      if (!token) {
        setLoading(false)
        return
      }

      try {
        const currentUser = await apiService.getCurrentUser()
        setUser(currentUser)
      } catch {
        apiService.clearAuth()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    const handleExpiredSession = () => {
      setUser(null)
      setLoading(false)
    }

    restoreSession()
    window.addEventListener('auth:expired', handleExpiredSession)

    return () => {
      window.removeEventListener('auth:expired', handleExpiredSession)
    }
  }, [])

  const login = async (credentials: LoginCredentials) => {
    try {
      const authResponse = await apiService.login(credentials)
      setUser(authResponse.user)
      return { success: true }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed'
      return { success: false, error: message }
    }
  }

  const register = async (userData: RegisterData) => {
    try {
      const authResponse = await apiService.register(userData)
      setUser(authResponse.user)
      return { success: true }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Registration failed'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    await apiService.logout()
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
