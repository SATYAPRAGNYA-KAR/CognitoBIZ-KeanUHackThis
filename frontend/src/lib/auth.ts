const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8000'

export function getAuthLoginUrl(): string {
  return `${AUTH_URL}/login`
}

export function getAuthLogoutUrl(): string {
  return `${AUTH_URL}/logout`
}
