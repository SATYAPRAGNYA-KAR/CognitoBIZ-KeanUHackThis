import { NextResponse } from 'next/server'
import { getAuthLoginUrl, getAuthLogoutUrl } from '@/lib/auth'

type RouteContext = {
  params: {
    auth0: string
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const action = params.auth0

  if (action === 'login') {
    return NextResponse.redirect(getAuthLoginUrl())
  }

  if (action === 'logout') {
    return NextResponse.redirect(getAuthLogoutUrl())
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
