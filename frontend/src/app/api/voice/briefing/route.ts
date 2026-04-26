import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Forward language_code query param if provided
    const languageCode = request.nextUrl.searchParams.get('language_code') || 'en'
    const backendUrl = `${API_BASE_URL}/api/voice/briefing?language_code=${encodeURIComponent(languageCode)}`

    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        data || { detail: 'Failed to fetch morning briefing.' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Backend voice service is unavailable right now.' },
      { status: 503 }
    )
  }
}
