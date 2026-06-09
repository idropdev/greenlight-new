import type { FlyerType } from './flyerStore';

export interface FieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  multiline: boolean;
}

export const fieldConfig: Record<FlyerType, FieldDefinition[]> = {
  event: [
    { key: 'title', label: 'Event Title', placeholder: 'e.g. Summer Music Festival', multiline: false },
    { key: 'date', label: 'Date', placeholder: 'e.g. Saturday, October 14', multiline: false },
    { key: 'time', label: 'Time', placeholder: 'e.g. 6:00 PM - 10:00 PM', multiline: false },
    { key: 'location', label: 'Location', placeholder: 'e.g. Central Park Amphitheater', multiline: false },
    { key: 'description', label: 'Description', placeholder: 'Describe the event, line-up, special guests...', multiline: true },
  ],
  service: [
    { key: 'businessName', label: 'Business Name', placeholder: 'e.g. Apex Consulting', multiline: false },
    { key: 'serviceOffered', label: 'Services Offered', placeholder: 'e.g. Business strategy, financial planning, & tax preparation', multiline: true },
    { key: 'tagline', label: 'Tagline / Catchphrase', placeholder: 'e.g. Empowering your financial future', multiline: false },
    { key: 'contact', label: 'Contact Info', placeholder: 'e.g. Call (555) 0199 or email info@apex.com', multiline: false },
    { key: 'description', label: 'Description', placeholder: 'Tell potential clients why they should choose your services...', multiline: true },
  ],
  product: [
    { key: 'productName', label: 'Product Name', placeholder: 'e.g. UltraFit Wireless Earbuds', multiline: false },
    { key: 'price', label: 'Price / Offer', placeholder: 'e.g. $49.99 (Save 20% today)', multiline: false },
    { key: 'tagline', label: 'Product Tagline', placeholder: 'e.g. Sound that moves with you', multiline: false },
    { key: 'callToAction', label: 'Call to Action', placeholder: 'e.g. Order now at ultrafit.com', multiline: false },
    { key: 'description', label: 'Description', placeholder: 'Highlight key features, technical specifications, and benefits...', multiline: true },
  ],
};
