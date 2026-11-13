import { createPrisma } from '../lib/prisma.js';
import { loadConfig } from '../config/env.js';

const themes=[
  {theme:'exam-season',title:'Exam Season',description:'Study-break favourites, ready for your next break.',patterns:[/cold coffee/i,/masala sandwich/i,/plain maggi/i,/veg cheese.*sandwich/i,/tea/i,/banana shake/i]},
  {theme:'sunday-funday',title:'Sunday Funday',description:'Weekend favourites for a relaxed catch-up with friends.',patterns:[/margherita pizza/i,/mix sauce pasta/i,/veggie burger/i,/piri piri fries/i,/cold coffee/i,/mango shake/i]},
  {theme:'birthday',title:'Birthday',description:'A celebration menu of pizzas, snacks and shakes to share.',patterns:[/cheese burst pizza/i,/plain french fries/i,/strawberry shake/i,/choco shake/i,/butterscotch/i,/paneer burger/i]},
];
async function main(){
  const db=createPrisma({...loadConfig(),DB_TIMEOUT_MS:10000});
  try{
  const canteen=await db.canteen.findUniqueOrThrow({where:{slug:'canteen'}});
  const menu=await db.menuItem.findMany({where:{canteenId:canteen.id,archived:false,category:{archived:false}},orderBy:{name:'asc'}});
  for(const [index,theme]of themes.entries()) {
    const existing=await db.banner.findUnique({where:{canteenId_theme:{canteenId:canteen.id,theme:theme.theme}}});
    if(existing){console.log(`${theme.title}: existing banner preserved`);continue;}
    const ids=new Set<string>();
    for(const pattern of theme.patterns){const item=menu.find(food=>pattern.test(food.name)&&!ids.has(food.id));if(item)ids.add(item.id);}
    if(!ids.size&&menu.length)ids.add(menu[0]!.id);
    await db.$transaction(async tx=>{
      const banner=await tx.banner.create({data:{canteenId:canteen.id,theme:theme.theme,title:theme.title,description:theme.description,imageRef:`/banners/${theme.theme}-v1.png`,active:ids.size>0,targetType:'theme',publishedAt:new Date(Date.now()-index*1000)}});
      if(ids.size)await tx.bannerItem.createMany({data:[...ids].map(menuItemId=>({bannerId:banner.id,canteenId:canteen.id,menuItemId}))});
    },{maxWait:10000,timeout:30000});
    console.log(`${theme.title}: ${ids.size} existing menu items linked`);
  }
  }catch(error){
    const issue=error as {name?:string;code?:string;meta?:unknown;message?:string};
    console.error(JSON.stringify({name:issue.name,code:issue.code,meta:issue.meta}));
    process.exitCode=1;
  }finally{await db.$disconnect();}
}
void main();
