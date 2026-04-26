import { NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:5000'

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/voice/briefing`, {
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
