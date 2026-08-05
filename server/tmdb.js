const TMDB_API_URL = 'https://api.themoviedb.org/3';

function tmdbHeaders() {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    throw new Error('TMDB_READ_TOKEN is missing. Add it to .env.');
  }
  return {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  };
}

async function tmdbFetch(path, query = {}) {
  const url = new URL(`${TMDB_API_URL}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, { headers: tmdbHeaders() });
  const body = await response.text();
  let data = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = { raw: body };
  }

  if (!response.ok) {
    const message = data?.status_message || data?.message || `TMDB request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

module.exports = { tmdbFetch };
