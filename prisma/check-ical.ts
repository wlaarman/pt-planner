import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, icalUrl: true, showIcalEvents: true }
  });
  console.log('iCal settings per user:');
  users.forEach(u => {
    console.log(`- ${u.email}: ${u.icalUrl || '(geen)'} | show: ${u.showIcalEvents}`);
  });
}

main()
  .finally(() => prisma.$disconnect());
