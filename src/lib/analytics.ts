import posthog from 'posthog-js';
import type { FlyerType, SizeKey } from '../features/flyer/flyerStore';

export type AnalyticsEvent =
  | { name: 'flyer_created'; properties: { flyerType: FlyerType; size: SizeKey } }
  | { name: 'flyer_exported'; properties: { format: 'png' | 'jpeg' | 'svg'; width: number; height: number } }
  | { name: 'image_uploaded'; properties: { source: 'unsplash' | 'upload' } }
  | { name: 'campaign_type_selected'; properties: { flyerType: FlyerType } }
  | { name: 'size_changed'; properties: { size: SizeKey } }
  | { name: 'review_opened'; properties: { state: string; preset?: string } };

/**
 * Initializes PostHog analytics if running in production.
 */
export function initAnalytics(): void {
  const token = import.meta.env.VITE_POSTHOG_KEY;
  const api_host = import.meta.env.VITE_POSTHOG_HOST;

  if (import.meta.env.PROD) {
    if (token) {
      posthog.init(token, {
        api_host: api_host || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
      });
    } else {
      console.warn('[Analytics] PostHog key is missing in production environment.');
    }
  }
}

/**
 * Tracks a custom event using PostHog when in production, or logs it in development.
 */
export function trackEvent<N extends AnalyticsEvent['name']>(
  name: N,
  properties: Extract<AnalyticsEvent, { name: N }>['properties']
): void {
  if (import.meta.env.PROD) {
    posthog.capture(name, properties);
  } else {
    console.log(`[Analytics] Tracked: ${name}`, properties);
  }
}
