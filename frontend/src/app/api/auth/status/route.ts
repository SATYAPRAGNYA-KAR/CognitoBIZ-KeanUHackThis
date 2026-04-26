import { NextResponse } from 'next/server'
import { getMissingAuth0EnvVars, isAuth0Configured } from '@/lib/auth0-config'

export async function GET() {
  return NextResponse.json({
    configured: isAuth0Configured(),
    missing: getMissingAuth0EnvVars(),
  })
}
