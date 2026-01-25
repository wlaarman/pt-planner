import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👥 Updating trainers...');

  // Get all current trainers
  const trainers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${trainers.length} trainers`);

  const hashedPassword = await bcrypt.hash('trainer123', 10);

  if (trainers.length >= 1) {
    // Update first trainer to Jan-Willem
    await prisma.user.update({
      where: { id: trainers[0].id },
      data: {
        name: 'Jan-Willem',
        email: 'janwillem@ptplanner.nl',
        color: '#4F46E5', // Indigo
        role: 'ADMIN',
      }
    });
    console.log('✅ Updated trainer 1 to Jan-Willem');
  }

  if (trainers.length >= 2) {
    // Update second trainer to Hanneke
    await prisma.user.update({
      where: { id: trainers[1].id },
      data: {
        name: 'Hanneke',
        email: 'hanneke@ptplanner.nl',
        color: '#EC4899', // Pink
        role: 'TRAINER',
      }
    });
    console.log('✅ Updated trainer 2 to Hanneke');
  }

  // Deactivate or reassign remaining trainers
  if (trainers.length > 2) {
    for (let i = 2; i < trainers.length; i++) {
      // Reassign their appointments to Jan-Willem
      await prisma.appointment.updateMany({
        where: { trainerId: trainers[i].id },
        data: { trainerId: trainers[0].id }
      });

      // Deactivate the trainer
      await prisma.user.update({
        where: { id: trainers[i].id },
        data: { isActive: false }
      });
      console.log(`✅ Deactivated trainer ${trainers[i].name}, appointments reassigned`);
    }
  }

  console.log('');
  console.log('🎉 Done! Trainers are now:');
  const updatedTrainers = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true, email: true, color: true, role: true }
  });
  updatedTrainers.forEach(t => console.log(`  - ${t.name} (${t.email}) - ${t.role}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
