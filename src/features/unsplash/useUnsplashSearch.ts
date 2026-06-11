import { useState, useCallback } from 'react';
import { buildUnsplashAutoQuery, searchPhotos } from './unsplashClient';
import type { UnsplashPhoto } from './unsplashClient';
import { useFlyerStore } from '../flyer/flyerStore';
import type { FlyerType } from '../flyer/flyerStore';

/**
 * Custom React hook for searching Unsplash images.
 * Manages loading state, errors, and an array of images.
 * Exposes a search method and a shuffle method to cycle the background image.
 */
export function useUnsplashSearch() {
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const setBgImageUrl = useFlyerStore((state) => state.setBgImageUrl);

  const search = useCallback(async (query: string, fallbackQuery = 'flyer') => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchPhotos(query, fallbackQuery);
      setPhotos(results);
      setHasSearched(true);
      if (results.length > 0) {
        setCurrentIndex(0);
        setBgImageUrl(results[0].url);
      } else {
        setCurrentIndex(-1);
        setBgImageUrl(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'An error occurred while fetching background images.');
      setPhotos([]);
      setHasSearched(true);
      setCurrentIndex(-1);
      setBgImageUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [setBgImageUrl]);

  const autoSearch = useCallback(async (type: FlyerType | null, fields: Record<string, string>) => {
    const query = buildUnsplashAutoQuery(type, fields);
    await search(query, type || query);
  }, [search]);

  const shuffle = useCallback(() => {
    if (photos.length <= 1) return;
    const nextIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(nextIndex);
    setBgImageUrl(photos[nextIndex].url);
  }, [photos, currentIndex, setBgImageUrl]);

  return {
    photos,
    currentIndex,
    isLoading,
    error,
    search,
    autoSearch,
    shuffle,
    hasPhotos: photos.length > 0,
    hasSearched,
    noResults: hasSearched && photos.length === 0 && !isLoading && !error,
  };
}
