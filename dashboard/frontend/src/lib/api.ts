import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      if (!url.includes('/auth/me') && !url.includes('/auth/logout')) {
        onUnauthorized?.()
      }
    }
    return Promise.reject(error)
  },
)