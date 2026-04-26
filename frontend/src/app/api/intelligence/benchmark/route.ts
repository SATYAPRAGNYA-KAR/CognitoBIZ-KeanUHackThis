import { NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/benchmark`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        data || { detail: 'Failed to fetch benchmark data.' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Backend intelligence service is unavailable right now.' },
      { status: 503 }
    )
  }
}