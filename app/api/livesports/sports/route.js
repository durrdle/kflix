import { NextResponse } from 'next/server';

const STREAMED_API_BASE = 'https://streamed.pk/api';

export async function GET() {
  try {
    const res = await fetch(`${STREAMED_API_BASE}/sports`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Upstream request failed with status ${res.status}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch sports categories.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}