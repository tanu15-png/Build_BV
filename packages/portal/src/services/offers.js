export const offerStatus = (offer, now = Date.now()) => !offer.active ? 'Paused' : Date.parse(offer.endsAt) <= now ? 'Ended' : Date.parse(offer.startsAt) > now ? 'Scheduled' : 'Active';
export function offerDraft(offer) {
  const local = value => value ? new Date(Date.parse(value) + 330 * 60000).toISOString().slice(0,16) : '';
  return offer ? {...offer, amount:String(offer.value / 100), startsAt:local(offer.startsAt), endsAt:local(offer.endsAt)} : {name:'',menuItemId:'',kind:'PERCENT',amount:'',active:true,startsAt:local(new Date().toISOString()),endsAt:''};
}
export function offerBody(draft) {
  const amount=String(draft.amount).trim();
  if(!/^\d+(\.\d{1,2})?$/.test(amount))throw Error('Enter a value with at most two decimal places.');
  const [whole,fraction='']=amount.split('.'),value=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  const instant=(text,end=false)=>{
    if(!text)throw Error('Choose a start and end date for the offer.');
    // All offers use campus time. A date without a time includes the whole last day.
    const date=new Date(`${text.length===10?text+'T00:00':text}:00+05:30`);
    if(end&&text.length===10)date.setTime(date.getTime()+86400000);
    return date.toISOString();
  };
  if(!draft.name.trim()||!draft.menuItemId)throw Error('Choose an item and enter an offer name.');
  if(draft.kind==='PERCENT'&&(value<1||value>10000))throw Error('Percentage must be greater than 0 and at most 100.');
  if(draft.kind==='AMOUNT'&&value<1)throw Error('Enter a positive discount amount.');
  const startsAt=instant(draft.startsAt),endsAt=instant(draft.endsAt,true);
  if(endsAt<=startsAt)throw Error('The end must follow the start.');
  return { ...(draft.id?{id:draft.id,expectedVersion:draft.version}:{}),name:draft.name.trim(),menuItemId:draft.menuItemId,kind:draft.kind,value,active:draft.active,startsAt,endsAt };
}
