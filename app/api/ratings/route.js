import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json(
        { error: 'Missing id or type' },
        { status: 400 }
      );
    }

    const tmdbType = type === 'tv' ? 'tv' : 'movie';

    const externalIds = await fetchJson(
      `https://api.themoviedb.org/3/${tmdbType}/${id}/external_ids?api_key=${TMDB_API_KEY}`
    );

    const imdbId = externalIds?.imdb_id;

    if (!imdbId) {
      return NextResponse.json({
        imdbRating: null,
        rtRating: null,
      });
    }

    const omdb = await fetchJson(
      `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`
    );

    const imdbRating =
      omdb?.imdbRating && omdb.imdbRating !== 'N/A' ? omdb.imdbRating : null;

    const rtEntry = Array.isArray(omdb?.Ratings)
  ? omdb.Ratings.find((entry) =>
      String(entry?.Source || '').toLowerCase().includes('rotten')
    )
  : null;

    const rtRating =
      rtEntry?.Value && rtEntry.Value !== 'N/A' ? rtEntry.Value : null;

    return NextResponse.json({
  imdbRating,
  rtRating,
  imdbId,
  omdbRatings: omdb?.Ratings || [],
  omdbResponse: omdb,
});
  } catch (error) {
    console.error('Ratings API failed:', error);

    return NextResponse.json({
      imdbRating: null,
      rtRating: null,
    });
  }
}