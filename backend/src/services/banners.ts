import { z } from 'zod';
import { offerInput } from './offers.js';

export const bannerInput = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().max(500).default(''),
  imageRef: z.string().regex(/^\/(?:banners\/(?:exam-season|sunday-funday|birthday)-v1\.png|banners\/images\/[a-f0-9-]{36})$/),
  active: z.boolean(), targetType: z.enum(['theme','menu','item','category']), targetId: z.uuid().nullable().default(null),
  offerIds: z.array(z.uuid()).max(60).default([]), offers: z.array(offerInput).max(60).default([]),
  itemIds: z.array(z.uuid()).max(60).default([]),
  startsAt: z.iso.datetime().nullable().default(null), endsAt: z.iso.datetime().nullable().default(null),
  expectedVersion: z.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (['item','category'].includes(value.targetType) && !value.targetId) ctx.addIssue({ code:'custom', message:'Choose a destination.' });
  if (value.active && value.targetType === 'theme' && !value.itemIds.length) ctx.addIssue({code:'custom',message:'Choose at least one menu item.'});
  if (value.startsAt && value.endsAt && Date.parse(value.startsAt) >= Date.parse(value.endsAt)) ctx.addIssue({code:'custom',message:'End date must follow start date.'});
});

export function bannerImageType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  return null;
}

// Cache definitions, but evaluate scheduling at the time of each response.
export function bannerSchedule<T extends {startsAt:Date|null;endsAt:Date|null}>(banners:T[],now=Date.now()) {
  const future=banners.flatMap(b=>[b.startsAt?.getTime(),b.endsAt?.getTime()]).filter((value):value is number=>value!==undefined&&value>now);
  return {items:banners.filter(b=>(!b.startsAt||b.startsAt.getTime()<=now)&&(!b.endsAt||b.endsAt.getTime()>now)),cacheUntil:future.length?new Date(Math.min(...future)).toISOString():null};
}
