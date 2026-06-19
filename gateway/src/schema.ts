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
});

export const DesignSchema = z.object({
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
