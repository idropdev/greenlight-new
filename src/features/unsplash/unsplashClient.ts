const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export interface UnsplashPhoto {
  id: string;
  url: string;
}

/**
 * Searches photos on Unsplash matching the given query string.
 * Returns up to 10 photos containing their id and 'regular' size URL.
 * Falls back to returning an empty array on failures.
 */
export async function searchPhotos(query: string): Promise<UnsplashPhoto[]> {
  if (!ACCESS_KEY) {
    console.warn('Unsplash access key (VITE_UNSPLASH_ACCESS_KEY) is not set in your environment variables / .env file.');
    return [];
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${ACCESS_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.results)) {
      return data.results.map((item: any) => ({
        id: item.id,
        url: item.urls?.regular || item.urls?.full || '',
      })).filter((item: UnsplashPhoto) => item.url !== '');
    }

    return [];
  } catch (error) {
    console.error('Error fetching photos from Unsplash client:', error);
    throw error;
  }
}
