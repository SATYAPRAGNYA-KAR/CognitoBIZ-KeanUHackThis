// Auth0 configuration helpers for Next.js frontend
// The actual Auth0 provider is set up in app/layout.tsx using @auth0/nextjs-auth0

export const auth0Config = {
  domain: process.env.AUTH0_ISSUER_BASE_URL?.replace('https://', '') || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  audience: process.env.AUTH0_AUDIENCE || 'https://api.cognitobiz.ai',
  scope: 'openid profile email',
}

// Roles injected via Auth0 Actions into the JWT custom claim
export const ROLES = {
  OWNER: 'owner',
  TEAM_MEMBER: 'team_member',
  VENDOR: 'vendor',
  AUDITOR: 'auditor',
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

// Custom claim namespace (must match Auth0 Action)
export const CLAIM_NAMESPACE = 'https://cognitobiz.ai/'