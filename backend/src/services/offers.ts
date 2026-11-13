import { z } from 'zod';
import type { Prisma, Offer } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';

export const offerInput=z.object({
  id:z.uuid().optional(),menuItemId:z.uuid(),name:z.string().trim().min(1).max(120),kind:z.enum(['PERCENT','AMOUNT','FIXED']),
  value:z.number().int().min(0).max(10000000),active:z.boolean(),startsAt:z.iso.datetime(),endsAt:z.iso.datetime(),expectedVersion:z.number().int().positive().optional(),
}).superRefine((o,ctx)=>{
  if(Date.parse(o.endsAt)<=Date.parse(o.startsAt))ctx.addIssue({code:'custom',message:'End date must follow start date.'});
  if(o.kind==='PERCENT'&&(o.value<1||o.value>10000))ctx.addIssue({code:'custom',message:'Percentage must be greater than 0 and at most 100.'});
  if(o.kind==='AMOUNT'&&o.value<1)ctx.addIssue({code:'custom',message:'Enter a positive discount amount.'});
});
export type OfferInput=z.infer<typeof offerInput>;
type PriceOffer=Pick<Offer,'id'|'name'|'kind'|'value'|'active'|'startsAt'|'endsAt'|'version'>;
export function offerPrice(base:number,offer:Pick<PriceOffer,'kind'|'value'>) {
  if(offer.kind==='PERCENT')return Math.max(0,base-Math.floor(base*offer.value/10000));
  if(offer.kind==='AMOUNT')return Math.max(0,base-offer.value);
  return Math.min(base,Math.max(0,offer.value));
}
export function priceFor(item:{pricePaise:number;offers?:PriceOffer[]},now=Date.now()) {
  const offer=item.offers?.find(o=>o.active&&o.startsAt.getTime()<=now&&o.endsAt.getTime()>now&&offerPrice(item.pricePaise,o)<item.pricePaise);
  const effectivePricePaise=offer?offerPrice(item.pricePaise,offer):item.pricePaise;
  return {effectivePricePaise,offer:offer?{id:offer.id,name:offer.name,kind:offer.kind,value:offer.value,version:offer.version,startsAt:offer.startsAt.toISOString(),endsAt:offer.endsAt.toISOString(),discountPaise:item.pricePaise-effectivePricePaise}:null};
}
export function nextOfferBoundary(items:Array<{offers?:PriceOffer[]}>,now=Date.now()) {
  const times=items.flatMap(item=>(item.offers||[]).filter(o=>o.active).flatMap(o=>[o.startsAt.getTime(),o.endsAt.getTime()])).filter(time=>time>now);
  return times.length?new Date(Math.min(...times)).toISOString():null;
}
// Callers hold the canteen lock, also used by checkout and every menu/offer write.
export async function saveOffer(tx:Prisma.TransactionClient,canteenId:string,input:OfferInput) {
  const {id,expectedVersion,...values}=input;
  const item=await tx.menuItem.findFirst({where:{id:input.menuItemId,canteenId},include:{category:true}});
  if(!item)throw new AppError(422,'ITEM_INVALID','Choose an item or combo from your own menu.');
  if(input.active&&(item.archived||item.category.archived))throw new AppError(422,'ITEM_INVALID','Choose an active menu item.');
  const existing=id?await tx.offer.findFirst({where:{id,canteenId}}):null;
  if(id&&!existing)throw new AppError(404,'OFFER_NOT_FOUND','Offer not found.');
  if(existing&&(existing.version!==expectedVersion||existing.menuItemId!==input.menuItemId))throw new AppError(409,'VERSION_CONFLICT','This offer changed. Reload it before saving.');
  if(input.active&&input.kind==='AMOUNT'&&input.value>item.pricePaise)throw new AppError(422,'OFFER_PRICE_INVALID','The discount cannot exceed the item price.');
  if(input.active&&input.kind==='FIXED'&&input.value>=item.pricePaise)throw new AppError(422,'OFFER_PRICE_INVALID','The offer price must be lower than the normal price.');
  const startsAt=new Date(input.startsAt),endsAt=new Date(input.endsAt);
  if(input.active&&await tx.offer.findFirst({where:{canteenId,menuItemId:item.id,active:true,...(id?{id:{not:id}}:{}),startsAt:{lt:endsAt},endsAt:{gt:startsAt}}}))throw new AppError(409,'OFFER_OVERLAP',`An enabled offer already covers these dates for ${item.name}.`);
  const data={...values,canteenId,startsAt,endsAt};
  return existing?tx.offer.update({where:{id:existing.id},data:{...data,version:{increment:1}}}):tx.offer.create({data});
}
