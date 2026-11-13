import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { hashSecret } from '../../src/services/hash.js';

// Historical/foreign records must remain inaccessible in the single-canteen app.
export async function foreignCanteen(db:PrismaClient){
  const canteen=await db.canteen.create({data:{slug:`foreign-${randomUUID()}`,name:'Historical test fixture'}});
  await db.canteenAccessCode.create({data:{canteenId:canteen.id,version:1,codeHash:await hashSecret('foreign-test-code')}});
  const category=await db.menuCategory.create({data:{canteenId:canteen.id,name:'Historical fixture'}});
  await db.menuItem.create({data:{canteenId:canteen.id,categoryId:category.id,name:'Historical item',pricePaise:1000}});
  return canteen;
}
