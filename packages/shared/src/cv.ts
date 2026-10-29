import { z } from 'zod';

export const cvSummarySchema = z.object({ id: z.uuid() }).meta({
  id: 'CvSummary',
});

export const cvListSchema = z
  .object({ items: z.array(cvSummarySchema) })
  .meta({ id: 'CvList' });

export type CvSummary = z.infer<typeof cvSummarySchema>;
export type CvList = z.infer<typeof cvListSchema>;
