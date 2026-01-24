import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📅 Adding appointments for the coming week...');

  // Get existing trainers and participants
  const trainers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'TRAINER'] } } });
  const participants = await prisma.participant.findMany({ where: { isActive: true } });
  const trainingTypes = await prisma.trainingType.findMany();

  if (trainers.length === 0 || participants.length === 0 || trainingTypes.length === 0) {
    console.log('❌ No trainers, participants, or training types found. Run seed first.');
    return;
  }

  console.log(`Found ${trainers.length} trainers, ${participants.length} participants, ${trainingTypes.length} training types`);

  // Get today and next 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointments = [];

  // Generate appointments for the next 7 days
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const day = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = day.getDay();

    // Skip Sunday (0)
    if (dayOfWeek === 0) continue;

    // Random number of appointments per day (2-5)
    const numAppointments = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < numAppointments; i++) {
      // Random trainer
      const trainer = trainers[Math.floor(Math.random() * trainers.length)];

      // Random training type
      const trainingType = trainingTypes[Math.floor(Math.random() * trainingTypes.length)];

      // Random start hour (7:00 - 18:00)
      const startHour = Math.floor(Math.random() * 11) + 7;
      const startMinute = Math.random() > 0.5 ? 0 : 30;

      // Duration based on training type (45-90 minutes)
      const durationMinutes = trainingType.maxParticipants === 1 ? 60 :
                              trainingType.maxParticipants === 2 ? 60 : 90;

      const startTime = new Date(day);
      startTime.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // Random participants (up to maxParticipants)
      const numParticipants = Math.min(
        Math.floor(Math.random() * trainingType.maxParticipants) + 1,
        trainingType.maxParticipants
      );
      const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
      const selectedParticipants = shuffledParticipants.slice(0, numParticipants);

      // Check for overlap with existing appointments
      const existingOverlap = await prisma.appointment.findFirst({
        where: {
          trainerId: trainer.id,
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
      });

      if (existingOverlap) {
        continue; // Skip if overlap
      }

      appointments.push({
        startTime,
        endTime,
        trainerId: trainer.id,
        trainingTypeId: trainingType.id,
        status: 'SCHEDULED' as const,
        participantIds: selectedParticipants.map(p => p.id),
      });
    }
  }

  // Create appointments
  for (const apt of appointments) {
    try {
      await prisma.appointment.create({
        data: {
          startTime: apt.startTime,
          endTime: apt.endTime,
          trainerId: apt.trainerId,
          trainingTypeId: apt.trainingTypeId,
          status: apt.status,
          participants: {
            create: apt.participantIds.map(id => ({ participantId: id })),
          },
        },
      });
    } catch (error) {
      // Skip duplicates or other errors
      console.log('Skipped appointment due to conflict');
    }
  }

  console.log(`✅ Created ${appointments.length} new appointments`);
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
