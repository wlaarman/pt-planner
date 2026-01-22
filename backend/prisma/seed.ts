import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create training types
  const trainingTypes = await Promise.all([
    prisma.trainingType.create({
      data: {
        name: '1-op-1 Training',
        description: 'Persoonlijke begeleiding met 1 deelnemer',
        maxParticipants: 1,
        defaultDuration: 60,
        defaultRate: 45,
        icon: 'user',
        color: '#4F46E5',
      },
    }),
    prisma.trainingType.create({
      data: {
        name: '1-op-2 Training',
        description: 'Training met 2 deelnemers tegelijk',
        maxParticipants: 2,
        defaultDuration: 60,
        defaultRate: 35,
        icon: 'user-friends',
        color: '#10B981',
      },
    }),
    prisma.trainingType.create({
      data: {
        name: 'Groepstraining',
        description: 'Training voor groepen van 3 of meer',
        maxParticipants: 12,
        defaultDuration: 90,
        defaultRate: 15,
        icon: 'users',
        color: '#F59E0B',
      },
    }),
  ]);

  console.log('✅ Created training types');

  // Create trainers (users)
  const hashedPassword = await bcrypt.hash('trainer123', 10);

  const trainers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'jan@ptplanner.nl',
        password: hashedPassword,
        name: 'Jan Trainer',
        phone: '06-11111111',
        color: '#4F46E5',
        hourlyRate: 45,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        email: 'marie@ptplanner.nl',
        password: hashedPassword,
        name: 'Marie Sport',
        phone: '06-22222222',
        color: '#10B981',
        hourlyRate: 50,
        role: 'TRAINER',
      },
    }),
    prisma.user.create({
      data: {
        email: 'pieter@ptplanner.nl',
        password: hashedPassword,
        name: 'Pieter Fit',
        phone: '06-33333333',
        color: '#F59E0B',
        hourlyRate: 40,
        role: 'TRAINER',
      },
    }),
  ]);

  console.log('✅ Created trainers');

  // Create participants
  const participants = await Promise.all([
    prisma.participant.create({
      data: {
        name: 'Lisa de Vries',
        email: 'lisa@email.nl',
        phone: '06-12345678',
        preferredType: '1-op-1',
        notes: 'Doel: afvallen, 3x per week',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Mark Hendriks',
        email: 'mark@email.nl',
        phone: '06-23456789',
        preferredType: '1-op-2',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Anna Smit',
        email: 'anna@email.nl',
        phone: '06-34567890',
        preferredType: '1-op-2',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Tom Bakker',
        email: 'tom@email.nl',
        phone: '06-45678901',
        preferredType: '1-op-1',
        notes: 'Revalidatie na knieblessure',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Emma Jansen',
        email: 'emma@email.nl',
        phone: '06-56789012',
        preferredType: 'Groep',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Kees van Dijk',
        email: 'kees@email.nl',
        phone: '06-67890123',
        preferredType: '1-op-1',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Sophie de Groot',
        email: 'sophie@email.nl',
        phone: '06-78901234',
        preferredType: '1-op-2',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Daan Visser',
        email: 'daan@email.nl',
        phone: '06-89012345',
        preferredType: '1-op-2',
      },
    }),
    prisma.participant.create({
      data: {
        name: 'Floor Mulder',
        email: 'floor@email.nl',
        phone: '06-90123456',
        preferredType: '1-op-1',
      },
    }),
  ]);

  console.log('✅ Created participants');

  // Create some appointments for this week
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1); // Get Monday of current week
  monday.setHours(0, 0, 0, 0);

  const appointments = [];

  // Monday appointments
  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(monday.getTime() + 8 * 60 * 60 * 1000), // 08:00
        endTime: new Date(monday.getTime() + 9 * 60 * 60 * 1000), // 09:00
        trainerId: trainers[0].id, // Jan
        trainingTypeId: trainingTypes[0].id, // 1-op-1
        status: 'SCHEDULED',
        participants: {
          create: [{ participantId: participants[0].id }], // Lisa
        },
      },
    })
  );

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(monday.getTime() + 9 * 60 * 60 * 1000), // 09:00
        endTime: new Date(monday.getTime() + 10 * 60 * 60 * 1000), // 10:00
        trainerId: trainers[1].id, // Marie
        trainingTypeId: trainingTypes[1].id, // 1-op-2
        status: 'SCHEDULED',
        participants: {
          create: [
            { participantId: participants[1].id }, // Mark
            { participantId: participants[2].id }, // Anna
          ],
        },
      },
    })
  );

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(monday.getTime() + 12 * 60 * 60 * 1000), // 12:00
        endTime: new Date(monday.getTime() + 13.5 * 60 * 60 * 1000), // 13:30
        trainerId: trainers[0].id, // Jan
        trainingTypeId: trainingTypes[2].id, // Groep
        status: 'SCHEDULED',
        participants: {
          create: [
            { participantId: participants[4].id }, // Emma
            { participantId: participants[5].id }, // Kees
            { participantId: participants[6].id }, // Sophie
          ],
        },
      },
    })
  );

  // Tuesday appointments
  const tuesday = new Date(monday.getTime() + 24 * 60 * 60 * 1000);

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(tuesday.getTime() + 9 * 60 * 60 * 1000), // 09:00
        endTime: new Date(tuesday.getTime() + 10 * 60 * 60 * 1000), // 10:00
        trainerId: trainers[2].id, // Pieter
        trainingTypeId: trainingTypes[0].id, // 1-op-1
        status: 'SCHEDULED',
        participants: {
          create: [{ participantId: participants[3].id }], // Tom
        },
      },
    })
  );

  // Wednesday appointments
  const wednesday = new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000);

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(wednesday.getTime() + 7 * 60 * 60 * 1000), // 07:00
        endTime: new Date(wednesday.getTime() + 8 * 60 * 60 * 1000), // 08:00
        trainerId: trainers[0].id, // Jan
        trainingTypeId: trainingTypes[0].id, // 1-op-1
        status: 'SCHEDULED',
        participants: {
          create: [{ participantId: participants[4].id }], // Emma
        },
      },
    })
  );

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(wednesday.getTime() + 11 * 60 * 60 * 1000), // 11:00
        endTime: new Date(wednesday.getTime() + 11.75 * 60 * 60 * 1000), // 11:45
        trainerId: trainers[1].id, // Marie
        trainingTypeId: trainingTypes[0].id, // 1-op-1
        status: 'SCHEDULED',
        participants: {
          create: [{ participantId: participants[5].id }], // Kees
        },
      },
    })
  );

  // Thursday appointments
  const thursday = new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000);

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(thursday.getTime() + 13 * 60 * 60 * 1000), // 13:00
        endTime: new Date(thursday.getTime() + 14 * 60 * 60 * 1000), // 14:00
        trainerId: trainers[0].id, // Jan
        trainingTypeId: trainingTypes[1].id, // 1-op-2
        status: 'SCHEDULED',
        participants: {
          create: [
            { participantId: participants[6].id }, // Sophie
            { participantId: participants[7].id }, // Daan
          ],
        },
      },
    })
  );

  // Friday appointments
  const friday = new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000);

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(friday.getTime() + 15 * 60 * 60 * 1000), // 15:00
        endTime: new Date(friday.getTime() + 16.5 * 60 * 60 * 1000), // 16:30
        trainerId: trainers[2].id, // Pieter
        trainingTypeId: trainingTypes[2].id, // Groep
        status: 'SCHEDULED',
        participants: {
          create: [
            { participantId: participants[0].id }, // Lisa
            { participantId: participants[1].id }, // Mark
            { participantId: participants[2].id }, // Anna
            { participantId: participants[3].id }, // Tom
          ],
        },
      },
    })
  );

  // Saturday appointments
  const saturday = new Date(monday.getTime() + 5 * 24 * 60 * 60 * 1000);

  appointments.push(
    prisma.appointment.create({
      data: {
        startTime: new Date(saturday.getTime() + 8 * 60 * 60 * 1000), // 08:00
        endTime: new Date(saturday.getTime() + 9 * 60 * 60 * 1000), // 09:00
        trainerId: trainers[1].id, // Marie
        trainingTypeId: trainingTypes[0].id, // 1-op-1
        status: 'SCHEDULED',
        participants: {
          create: [{ participantId: participants[8].id }], // Floor
        },
      },
    })
  );

  await Promise.all(appointments);

  console.log('✅ Created appointments');

  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📧 Login credentials:');
  console.log('   Email: jan@ptplanner.nl');
  console.log('   Password: trainer123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
