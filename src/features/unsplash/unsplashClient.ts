import type { FlyerType } from '../flyer/flyerStore';

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export interface UnsplashPhoto {
  id: string;
  url: string;
}

interface UnsplashApiPhoto {
  id: string;
  urls?: {
    regular?: string;
    full?: string;
  };
}

interface UnsplashSearchResponse {
  results?: UnsplashApiPhoto[];
}

const LEGAL_SUFFIX_PATTERN = /(?:[\s,.-]+(?:llc|inc|co|ltd|corp)\.?\s*)+$/i;
const LEGAL_SUFFIX_WORD_PATTERN = /\b(?:llc|inc|co|ltd|corp)\b\.?/gi;
const PUNCTUATION_PATTERN = /[^\w\s]/g;
const NUMERIC_TOKEN_PATTERN = /\d/;
const STOPWORDS = new Set(['the', 'and', 'a', 'for', 'of', 'with', 'your', 'our', 'to', 'in', 'on']);
const MAX_AUTO_QUERY_WORDS = 5;

const AUTO_QUERY_FIELD_ORDER: Record<FlyerType, string[]> = {
  event: ['title', 'description'],
  service: ['serviceOffered', 'tagline', 'description'],
  product: ['tagline', 'description', 'productName'],
  sale: ['headline', 'description'],
  realEstate: ['propertyTitle', 'features', 'address'],
  hiring: ['jobTitle', 'company', 'location'],
};

export function normalizeUnsplashQuery(query: string, fallbackQuery: string): string {
  const cleaned = query.trim().replace(LEGAL_SUFFIX_PATTERN, '').trim();
  const fallback = fallbackQuery.trim();

  if (cleaned.length < 3) {
    return fallback.length >= 3 ? fallback : 'flyer';
  }

  return cleaned;
}

function cleanAutoQuery(query: string, fallbackQuery: FlyerType): string {
  const keywords = query
    .replace(LEGAL_SUFFIX_WORD_PATTERN, ' ')
    .replace(PUNCTUATION_PATTERN, ' ')
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0 && !STOPWORDS.has(word) && !NUMERIC_TOKEN_PATTERN.test(word))
    .slice(0, MAX_AUTO_QUERY_WORDS);

  const cleaned = keywords.join(' ');
  return cleaned.length >= 3 ? cleaned : fallbackQuery;
}

export function buildUnsplashAutoQuery(type: FlyerType | null, fields: Record<string, string>): string {
  if (!type) {
    return 'event';
  }

  const fieldOrder = AUTO_QUERY_FIELD_ORDER[type];
  const assembled = fieldOrder.map((fieldKey) => fields[fieldKey] || '').join(' ');

  return cleanAutoQuery(assembled, type);
}

/**
 * Searches photos on Unsplash matching the given query string.
 * Returns up to 10 photos containing their id and 'regular' size URL.
 * Falls back to returning an empty array on failures.
 */
export async function searchPhotos(query: string, fallbackQuery = 'flyer'): Promise<UnsplashPhoto[]> {
  if (!ACCESS_KEY) {
    console.warn('Unsplash access key (VITE_UNSPLASH_ACCESS_KEY) is not set in your environment variables / .env file.');
    return [];
  }

  try {
    const searchQuery = normalizeUnsplashQuery(query, fallbackQuery);
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=10`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${ACCESS_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as UnsplashSearchResponse;
    if (data && Array.isArray(data.results)) {
      return data.results.map((item) => ({
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
