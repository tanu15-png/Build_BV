import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createSessionReader } from '../services/session.js';
import { AppError } from '../middleware/errorHandler.js';
import { offerInput, saveOffer } from '../services/offers.js';
import { createCatalogEvents } from '../services/catalogEvents.js';
import { createReadCache } from '../services/readCache.js';

export function createOffersRouter(config:Config,db:PrismaClient,events=createCatalogEvents(),reads=createReadCache()) {
  const router=Router(),current=createSessionReader(config,db);
  async function staff(req:Parameters<typeof current>[0]) {
    const {actor}=await current(req);
    if(actor.role!=='CANTEEN'||!actor.canteenId)throw new AppError(403,'CANTEEN_REQUIRED','Only the canteen can manage offers.');
    return actor;
  }
  router.get('/offers/manage',async(req,res)=>{
    const actor=await staff(req);
    res.json({items:await db.offer.findMany({where:{canteenId:actor.canteenId!},orderBy:[{startsAt:'desc'},{id:'asc'}]})});
  });
  for(const method of ['post','patch','delete'] as const)router[method](method==='post'?'/offers':'/offers/:id',async(req,res)=>{
    const actor=await staff(req);
    const rawId=(req.params as Record<string,string>).id;
    if(method!=='post'&&!z.uuid().safeParse(rawId).success)throw new AppError(422,'OFFER_INVALID','Choose a valid offer.');
    const id=method==='post'?undefined:rawId;
    const input=method==='delete'?z.object({expectedVersion:z.number().int().positive()}).safeParse(req.body):offerInput.safeParse({...req.body,...(id?{id}:{})});
    if(!input.success)throw new AppError(422,'OFFER_INVALID',input.error.issues[0]?.message||'Check the offer fields.');
    const parsed=input.data;
    const result=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM canteens WHERE id=${actor.canteenId}::uuid FOR UPDATE`;
      await createSessionReader(config,tx)(req);
      if(method!=='delete')return saveOffer(tx,actor.canteenId!,parsed as z.infer<typeof offerInput>);
      const existing=await tx.offer.findFirst({where:{id,canteenId:actor.canteenId!}});
      if(!existing)throw new AppError(404,'OFFER_NOT_FOUND','Offer not found.');
      if(existing.version!==parsed.expectedVersion)throw new AppError(409,'VERSION_CONFLICT','This offer changed. Reload it before deleting.');
      await tx.offer.delete({where:{id:existing.id}});return {ok:true};
    },{maxWait:config.DB_TIMEOUT_MS,timeout:15000});
    reads.clear();events.publish(actor.canteenId!);res.status(method==='post'?201:200).json(result);
  });
  return router;
}
