import { NextResponse } from 'next/server';

const STREAMED_API_BASE = 'https://streamed.pk/api';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const endpoint = searchParams.get('endpoint') || 'matches/live';
  const popular = searchParams.get('popular') === 'true';

  const normalizedEndpoint = endpoint.replace(/^\/+/, '');
  const finalUrl = `${STREAMED_API_BASE}/${normalizedEndpoint}${popular ? '/popular' : ''}`;

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
          error: `Upstream request failed with status ${res.status}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      endpoint: normalizedEndpoint,
      popular,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch live sports data.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}