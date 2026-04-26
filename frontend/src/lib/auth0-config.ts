const REQUIRED_AUTH0_ENV_VARS = [
  'AUTH0_SECRET',
  'AUTH0_BASE_URL',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
] as const

const PLACEHOLDER_PATTERNS = [
  'your-',
  'replace-with',
  'your_',
]

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) return false

  const normalized = value.trim().toLowerCase()
  if (!normalized) return false

  return !PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern))
}

export function getMissingAuth0EnvVars(): string[] {
  return REQUIRED_AUTH0_ENV_VARS.filter((key) => !isConfiguredValue(process.env[key]))
}

export function isAuth0Configured(): boolean {
  return getMissingAuth0EnvVars().length === 0
}
