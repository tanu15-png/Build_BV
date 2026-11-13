import { saveOffer } from '../services/offers.js';
import { Router, raw, type Request } from 'express';
import { z } from 'zod';
import type { Config } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createSessionReader } from '../services/session.js';
import { AppError } from '../middleware/errorHandler.js';
import { bannerInput, bannerImageType, bannerSchedule } from '../services/banners.js';
import { createReadCache } from '../services/readCache.js';
import { createCatalogEvents } from '../services/catalogEvents.js';

export function createBannersRouter(config:Config, db:PrismaClient, events=createCatalogEvents(), reads=createReadCache()) {
  const router=Router(), current=createSessionReader(config,db);
  const include={items:{include:{menuItem:true}},offers:{include:{offer:true}}} as const;
  async function staff(req:Request) {
    const {actor}=await current(req);
    if (actor.role !== 'CANTEEN' || !actor.canteenId) throw new AppError(403,'CANTEEN_REQUIRED','Only the canteen can manage banners.');
    return actor;
  }
  router.get('/banners', async(req,res)=>{
    const rows=await reads.get('banners',()=>db.banner.findMany({where:{canteen:{slug:'canteen',operational:true},active:true},include:{items:{include:{menuItem:true}}},orderBy:[{publishedAt:'desc'},{id:'desc'}]}),5000,req.get('Cache-Control')==='no-cache');
    res.json(bannerSchedule(rows));
  });
  router.get('/banners/manage',async(req,res)=>{
    const actor=await staff(req);
    res.json({items:await db.banner.findMany({where:{canteenId:actor.canteenId!},include,orderBy:[{publishedAt:'desc'},{id:'desc'}]})});
  });
  router.get('/banners/images/:id',async(req,res)=>{
    const id=z.uuid().safeParse(req.params.id);
    if(!id.success) throw new AppError(404,'IMAGE_NOT_FOUND','Image not found.');
    const image=await db.bannerImage.findUnique({where:{id:id.data}});
    if(!image) throw new AppError(404,'IMAGE_NOT_FOUND','Image not found.');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('X-Content-Type-Options','nosniff');
    res.type(image.mime).send(Buffer.from(image.data));
  });
  router.post('/banners/images',async(req,_res,next)=>{await staff(req);next();},raw({type:['image/png','image/jpeg','image/webp'],limit:'4mb'}),async(req,res)=>{
    const bytes=req.body;
    if(!Buffer.isBuffer(bytes) || !bytes.length) throw new AppError(422,'IMAGE_INVALID','Upload a PNG, JPEG or WebP image.');
    const mime=bannerImageType(bytes);
    if(!mime) throw new AppError(422,'IMAGE_INVALID','Upload a valid PNG, JPEG or WebP image.');
    const image=await db.bannerImage.create({data:{mime,data:new Uint8Array(bytes)}});
    res.status(201).json({imageRef:`/banners/images/${image.id}`});
  });
  async function save(req:Request,id?:string) {
    const actor=await staff(req), parsed=bannerInput.safeParse(req.body);
    if(!parsed.success) throw new AppError(422,'BANNER_INVALID',parsed.error.issues[0]?.message || 'Check the banner fields.');
    const {itemIds,offerIds,offers,expectedVersion,startsAt,endsAt,...fields}=parsed.data;
    const items=[...new Set(itemIds)];
    const result=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM canteens WHERE id=${actor.canteenId}::uuid FOR UPDATE`;
      await createSessionReader(config,tx)(req);
      const existing=id?await tx.banner.findFirst({where:{id,canteenId:actor.canteenId!}}):null;
      if(id&&!existing) throw new AppError(404,'BANNER_NOT_FOUND','Banner not found.');
      if(existing&&existing.version!==expectedVersion) throw new AppError(409,'VERSION_CONFLICT','This banner changed. Reload it before saving.');
      if(await tx.menuItem.count({where:{id:{in:items},canteenId:actor.canteenId!}})!==items.length) throw new AppError(422,'ITEM_INVALID','Select items from your own menu.');
      if(fields.active&&fields.targetType==='theme'&&!await tx.menuItem.count({where:{id:{in:items},canteenId:actor.canteenId!,archived:false,category:{archived:false}}})) throw new AppError(422,'ITEM_INVALID','Select at least one active menu item before publishing.');
      if(fields.active&&fields.targetType==='item'&&!await tx.menuItem.findFirst({where:{id:fields.targetId!,canteenId:actor.canteenId!,archived:false}})) throw new AppError(422,'TARGET_INVALID','Choose an item from your menu.');
      if(fields.active&&fields.targetType==='category'&&!await tx.menuCategory.findFirst({where:{id:fields.targetId!,canteenId:actor.canteenId!,archived:false}})) throw new AppError(422,'TARGET_INVALID','Choose a category from your menu.');
      const upload=fields.imageRef.match(/^\/banners\/images\/([^/]+)$/)?.[1];
      if(upload&&!await tx.bannerImage.findUnique({where:{id:upload},select:{id:true}})) throw new AppError(422,'IMAGE_INVALID','Upload the poster again.');
      const dateStart=startsAt?new Date(startsAt):null,dateEnd=endsAt?new Date(endsAt):null;
      const publication=fields.active&&(!existing||!existing.active)?new Date(Math.max(Date.now(),dateStart?.getTime()||0)):existing?.publishedAt;
      const data={...fields,targetId:['item','category'].includes(fields.targetType)?fields.targetId:null,startsAt:dateStart,endsAt:dateEnd,...(publication?{publishedAt:publication}:{})};
      const banner=existing?await tx.banner.update({where:{id:existing.id},data:{...data,version:{increment:1}}}):await tx.banner.create({data:{...data,canteenId:actor.canteenId!}});
      await tx.bannerItem.deleteMany({where:{bannerId:banner.id}});
      if(items.length) await tx.bannerItem.createMany({data:items.map(menuItemId=>({bannerId:banner.id,canteenId:actor.canteenId!,menuItemId}))});
      const linked = new Set(offerIds);
      for (const input of offers) linked.add((await saveOffer(tx,actor.canteenId!,input)).id);
      if(await tx.offer.count({where:{id:{in:[...linked]},canteenId:actor.canteenId!}})!==linked.size) throw new AppError(422,'OFFER_INVALID','Choose offers from your own menu.');
      await tx.bannerOffer.deleteMany({where:{bannerId:banner.id}});
      if(linked.size) await tx.bannerOffer.createMany({data:[...linked].map(offerId=>({bannerId:banner.id,offerId,canteenId:actor.canteenId!}))});
      return tx.banner.findUniqueOrThrow({where:{id:banner.id},include});
    },{maxWait:config.DB_TIMEOUT_MS,timeout:15000});
    reads.clear();events.publish(actor.canteenId!);return result;
  }
  router.post('/banners',async(req,res)=>{res.status(201).json(await save(req));});
  router.patch('/banners/:id',async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success) throw new AppError(422,'BANNER_INVALID','Choose a valid banner.');
    res.json(await save(req,String(req.params.id)));
  });
  router.delete('/banners/:id',async(req,res)=>{
    const actor=await staff(req);const id=z.uuid().safeParse(req.params.id);
    if(!id.success) throw new AppError(422,'BANNER_INVALID','Choose a valid banner.');
    await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM canteens WHERE id=${actor.canteenId}::uuid FOR UPDATE`;await createSessionReader(config,tx)(req);await tx.banner.deleteMany({where:{id:id.data,canteenId:actor.canteenId!}});});
    reads.clear();events.publish(actor.canteenId!);res.json({ok:true});
  });
  return router;
}
