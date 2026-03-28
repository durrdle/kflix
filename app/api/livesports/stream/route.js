import { NextResponse } from 'next/server';

const STREAMED_API_BASE = 'https://streamed.pk/api';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const source = (searchParams.get('source') || '').trim().toLowerCase();
  const id = (searchParams.get('id') || '').trim();

  if (!source || !id) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing source or id.',
      },
      { status: 400 }
    );
  }

  const finalUrl = `${STREAMED_API_BASE}/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(finalUrl, {
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
          error: `Upstream stream request failed with status ${res.status}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      source,
      id,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch stream data.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}