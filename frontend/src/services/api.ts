import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  User,
} from '../types'
import { normalizeUser } from './normalizers'

interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
}

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const ACCESS_TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.api.interceptors.request.use((config) => {
      const token = this.getStoredToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      return config
    })

    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ message?: string }>) => {
        if (error.response?.status === 401) {
          this.clearAuth()
          window.dispatchEvent(new Event('auth:expired'))

          if (!['/login', '/register'].includes(window.location.pathname)) {
            window.location.href = '/login'
          }
        }

        return Promise.reject(this.toApiError(error))
      },
    )
  }

  private toApiError(error: AxiosError<{ message?: string }>): ApiError {
    const message = error.response?.data?.message || error.message || 'Request failed'
    return new ApiError(message, error.response?.status)
  }

  private async unwrap<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
    const response = await request
    return response.data.data
  }

  private persistTokens(token: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  getStoredToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  }

  getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  }

  clearAuth(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload = await this.unwrap<{
      user: unknown
      token: string
      refreshToken: string
    }>(this.api.post('/auth/login', credentials))

    const authResponse = {
      user: normalizeUser(payload.user),
      token: payload.token,
      refreshToken: payload.refreshToken,
    }

    this.persistTokens(authResponse.token, authResponse.refreshToken)
    return authResponse
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    const payload = await this.unwrap<{
      user: unknown
      token: string
      refreshToken: string
    }>(this.api.post('/auth/register', userData))

    const authResponse = {
      user: normalizeUser(payload.user),
      token: payload.token,
      refreshToken: payload.refreshToken,
    }

    this.persistTokens(authResponse.token, authResponse.refreshToken)
    return authResponse
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout')
    } finally {
      this.clearAuth()
    }
  }

  async getCurrentUser(): Promise<User> {
    const payload = await this.unwrap<{ user: unknown }>(this.api.get('/auth/me'))
    return normalizeUser(payload.user)
  }

  async refreshToken(): Promise<{ token: string; refreshToken: string }> {
    const refreshToken = this.getStoredRefreshToken()
    if (!refreshToken) {
      throw new ApiError('Refresh token is missing.')
    }

    const payload = await this.unwrap<{ token: string; refreshToken: string }>(
      this.api.post('/auth/refresh', { refreshToken }),
    )

    this.persistTokens(payload.token, payload.refreshToken)
    return payload
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.unwrap<T>(this.api.get(url, config))
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.unwrap<T>(this.api.post(url, data))
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.unwrap<T>(this.api.put(url, data))
  }

  async delete<T>(url: string): Promise<T> {
    return this.unwrap<T>(this.api.delete(url))
  }
}

export const apiService = new ApiService()
export default apiService
