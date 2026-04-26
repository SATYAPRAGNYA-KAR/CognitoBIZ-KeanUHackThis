import { NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'

export async function POST(request: Request) {
  try {
    // Forward the raw multipart/form-data body as-is so the backend
    // receives the file with the correct Content-Type boundary intact.
    const contentType = request.headers.get('content-type') || ''
    const body = await request.arrayBuffer()

    const response = await fetch(`${API_BASE_URL}/api/intelligence/analyze-document`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        data || { detail: 'Document analysis failed.' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { detail: 'Backend document analysis service is unavailable right now.' },
      { status: 503 }
    )
  }
}