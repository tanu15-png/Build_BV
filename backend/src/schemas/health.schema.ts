import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  status: z.string(),
});