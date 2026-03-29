import { NextResponse } from 'next/server';

const STREAMED_BASE_URL = 'https://streamed.pk/api';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'matches/live';

    const cleanedEndpoint = String(endpoint)
      .replace(/^\/+/, '')
      .replace(/\.\./g, '');

    const targetUrl = `${STREAMED_BASE_URL}/${cleanedEndpoint}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: 'https://streamed.pk/',
        Origin: 'https://streamed.pk',
      },
    });

    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!trimmed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Live sports provider returned an empty response.',
        },
        { status: 502 }
      );
    }

    let data = null;

    try {
      data = JSON.parse(trimmed);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid response from live sports provider.',
          debug: {
            status: response.status,
            contentType: response.headers.get('content-type') || '',
            preview: trimmed.slice(0, 300),
            url: targetUrl,
          },
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error || 'Failed to load live sports data.',
          debug: {
            status: response.status,
            contentType: response.headers.get('content-type') || '',
            url: targetUrl,
          },
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reach live sports provider.',
      },
      { status: 500 }
    );
  }
}