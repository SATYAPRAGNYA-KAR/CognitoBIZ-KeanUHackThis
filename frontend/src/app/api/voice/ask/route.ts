import { NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:8000'

export async function POST(request: Request) {
  try {
    const body = await request.text()

    const response = await fetch(`${API_BASE_URL}/api/voice/ask`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        data || { detail: 'Failed to process voice question.' },
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
