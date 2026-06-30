import { z } from 'zod';

export const TextOverlayElementSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  content: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  font: z.string(),
  size: z.number(),
  color: z.string(),
  align: z.enum(['left', 'center', 'right']),
});

export const ImageOverlayElementSchema = z.object({
  id: z.string(),
  type: z.literal('image'),
  value: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const OverlayElementSchema = z.discriminatedUnion('type', [
  TextOverlayElementSchema,
  ImageOverlayElementSchema,
]);

export const BackgroundLayerSchema = z.object({
  type: z.enum(['image', 'color', 'gradient']),
  value: z.string(),
  fit: z.string().optional(),
  blur: z.number().optional().transform((v) => (v !== undefined ? Math.max(0, Math.min(20, v)) : undefined)),
  opacity: z.number().optional().transform((v) => (v !== undefined ? Math.max(0, Math.min(100, v)) : undefined)),
});

export const StyleFieldSchema = z.object({
  fontFamily: z.string().optional(),
  shadowEnabled: z.boolean().optional(),
  shadowColor: z.string().optional(),
  shadowBlur: z.number().optional().transform((v) => (v !== undefined ? Math.max(0, v) : undefined)),
  shadowOpacity: z.number().optional().transform((v) => (v !== undefined ? Math.max(0, Math.min(1, v)) : undefined)),
  highlightEnabled: z.boolean().optional(),
  highlightColor: z.string().optional(),
  highlightOpacity: z.number().optional().transform((v) => (v !== undefined ? Math.max(0, Math.min(1, v)) : undefined)),
});

export const LegacyDesignSchema = z.object({
  schema_version: z.literal('0.1.1'),
  canvas: z.object({
    preset: z.enum(['square', 'portrait', 'story', 'landscape', 'custom']),
    width: z.number(),
    height: z.number(),
  }),
  layers: z.object({
    background: BackgroundLayerSchema,
    overlay: z.array(OverlayElementSchema),
  }),
  meta: z.object({
    source_agent: z.string(),
    tenant: z.string(),
    intent: z.string().optional(),
  }),
});

export const FieldsDesignSchema = z.object({
  schema_version: z.union([z.literal('0.1.2'), z.literal('0.1.3')]),
  canvas: z.object({
    preset: z.enum(['square', 'portrait', 'story', 'landscape', 'custom']),
    width: z.number(),
    height: z.number(),
  }),
  content: z.object({
    flyer_type: z.enum(['event', 'service', 'product', 'sale', 'realEstate', 'hiring']),
    fields: z.record(z.string()),
    style: z.record(StyleFieldSchema).optional(),
  }),
  layers: z.object({
    background: BackgroundLayerSchema,
    overlay: z.array(OverlayElementSchema).optional(),
  }),
  meta: z.object({
    source_agent: z.string(),
    tenant: z.string(),
    intent: z.string().optional(),
  }),
});

export const DesignSchema = z.union([LegacyDesignSchema, FieldsDesignSchema]);

export type Design = z.infer<typeof DesignSchema>;

export const ResultSchema = z.object({
  state: z.enum(['sent_back', 'approved_downloaded']),
  final_design: DesignSchema.optional(),
  export: z.object({
    url: z.string(),
    format: z.string(),
    resolution: z.string(),
  }).optional(),
  human_note: z.string().optional(),
});

export type Result = z.infer<typeof ResultSchema>;
