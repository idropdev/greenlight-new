import type { FlyerType } from './flyerStore';

export interface FieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  multiline: boolean;
  inputType?: 'text' | 'textarea' | 'date' | 'time';
}

export const fieldConfig: Record<FlyerType, FieldDefinition[]> = {
  event: [
    { key: 'title', label: 'Event Title', placeholder: 'e.g. Summer Music Festival', multiline: false },
    { key: 'date', label: 'Date', placeholder: 'e.g. Saturday, October 14', multiline: false, inputType: 'date' },
    { key: 'startTime', label: 'Start Time', placeholder: 'e.g. 6:00 PM', multiline: false, inputType: 'time' },
    { key: 'endTime', label: 'End Time', placeholder: 'e.g. 10:00 PM', multiline: false, inputType: 'time' },
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
  sale: [
    { key: 'headline', label: 'Sale Headline', placeholder: 'e.g. Summer Clearance Sale', multiline: false },
    { key: 'discount', label: 'Discount / Offer', placeholder: 'e.g. Up to 40% off', multiline: false },
    { key: 'promoCode', label: 'Promo Code', placeholder: 'e.g. Use code SUMMER40', multiline: false },
    { key: 'validUntil', label: 'Valid Until', placeholder: 'e.g. Ends July 31', multiline: false },
    { key: 'description', label: 'Description', placeholder: 'Describe what is on sale and why shoppers should act now...', multiline: true },
  ],
  realEstate: [
    { key: 'propertyTitle', label: 'Property Title', placeholder: 'e.g. Modern Downtown Loft', multiline: false },
    { key: 'price', label: 'Price', placeholder: 'e.g. $625,000', multiline: false },
    { key: 'address', label: 'Address', placeholder: 'e.g. 123 Main Street, Denver, CO', multiline: false },
    { key: 'features', label: 'Features', placeholder: 'e.g. 3 bed / 2 bath, mountain views, two-car garage', multiline: true },
    { key: 'contact', label: 'Contact Info', placeholder: 'e.g. Call Alex at (555) 0142', multiline: false },
  ],
  hiring: [
    { key: 'jobTitle', label: 'Job Title', placeholder: 'e.g. Senior Graphic Designer', multiline: false },
    { key: 'company', label: 'Company', placeholder: 'e.g. Greenlight Studio', multiline: false },
    { key: 'location', label: 'Location', placeholder: 'e.g. Remote or Denver, CO', multiline: false },
    { key: 'payRange', label: 'Pay Range', placeholder: 'e.g. $75k - $95k', multiline: false },
    { key: 'howToApply', label: 'How to Apply', placeholder: 'e.g. Apply at greenlight.com/careers', multiline: false },
  ],
};
