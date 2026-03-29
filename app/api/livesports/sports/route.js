import { NextResponse } from 'next/server';

const STREAMED_BASE_URL = 'https://streamed.pk/api';

export async function GET() {
  try {
    const targetUrl = `${STREAMED_BASE_URL}/sports`;

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
          error: 'Sports provider returned an empty response.',
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
          error: 'Invalid response from sports provider.',
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
          error: data?.error || 'Failed to load sports categories.',
          debug: {
            status: response.status,
            contentType: response.headers.get('content-type') || '',
            url: targetUrl,
          },
        },
        { status: response.status }
      );
    }

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];

    return NextResponse.json({
      ok: true,
      data: list,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reach sports provider.',
      },
      { status: 500 }
    );
  }
}