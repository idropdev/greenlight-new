import { Design } from './schema';

/**
 * Placeholder telemetry module.
 * We can implement PostHog here later without changing the rest of the codebase.
 */
export const Telemetry = {
  logFeatureGap(design: Design, session_id: string) {
    // Look for features in the design that might not be supported by Green Light yet
    const hasUnsupportedFonts = design.layers.overlay.some(el => 
      el.type === 'text' && !['Inter', 'Roboto', 'System'].includes(el.font)
    );

    if (hasUnsupportedFonts) {
      console.log(`[Telemetry] Feature Gap Logged: Unsupported fonts detected in session ${session_id}`);
      // TODO: posthog.capture('agent_feature_gap', { ... })
    }
    
    // Check if background type is supported
    if (design.layers.background.type === 'gradient') {
      console.log(`[Telemetry] Feature Gap Logged: Gradient background used in session ${session_id}`);
    }
  }
};
