import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

interface User {
  id: number
  email: string
  full_name: string
  role: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Use full backend URL instead of proxy
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)

  const fetchMe = async (t: string) => {
    const { data } = await axios.get<User>(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
    setUser(data)
  }

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
      fetchMe(token).catch(() => setUser(null))
    } else {
      localStorage.removeItem('token')
      setUser(null)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams()
    form.set('username', email)
    form.set('password', password)
    const { data } = await axios.post<{ access_token: string }>(`${API_BASE}/auth/login`, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const t = data.access_token
    setToken(t) // do not await fetchMe here to avoid UI hang if /me is slow
  }

  const logout = () => setToken(null)

  const value = useMemo(() => ({ user, token, login, logout }), [user, token])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
