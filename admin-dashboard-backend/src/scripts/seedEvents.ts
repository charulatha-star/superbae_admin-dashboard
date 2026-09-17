import 'dotenv/config';

import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { LooseDocument } from '../models/registry';

/**
 * Seed script for EVENTS tab data
 * Creates placeholder/test data for events and eventRegistrations
 * for the 5 real users: Alice, Yogesh, Divya, Jane, Ram
 * 
 * Usage: Run manually via `npx ts-node src/scripts/seedEvents.ts`
 * DO NOT import or run automatically
 */

const REAL_USER_IDS = {
  alice: 'usr_001',
  yogesh: 'user_919500011980_1788166013011',
  divya: 'user_919790440088_1788166013252',
  jane: 'user_918667556475_1788166013366',
  ram: 'user_919514515152_1788174900911',
};

const REAL_USER_NAMES: Record<string, string> = {
  [REAL_USER_IDS.alice]: 'Alice Valid',
  [REAL_USER_IDS.yogesh]: 'Yogesh',
  [REAL_USER_IDS.divya]: 'Divya Ashokkumar',
  [REAL_USER_IDS.jane]: 'Jane Doe',
  [REAL_USER_IDS.ram]: 'Ram',
};

// Helper to generate ID
const generateId = (prefix: string, index: number): string => {
  return `${prefix}_${String(index).padStart(3, '0')}`;
};

// Generate a date
const makeDate = (daysFromNow: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  return d;
};

// Past dates
const pastDate = (daysAgo: number): Date => makeDate(-daysAgo);
// Future dates
const futureDate = (daysFromNow: number): Date => makeDate(daysFromNow);

async function seedEvents(): Promise<void> {
  await connectDB();

  console.log('Seeding EVENTS tab data...\n');

  // Step 1: Check existing events and clear registrations/payments for events
  const existingEvents = await models.events.find({}).lean();
  console.log(`Found ${existingEvents.length} existing events.`);

  if (existingEvents.length === 0) {
    // Create 2-3 events
    console.log('Creating 3 placeholder events...');
    const events: LooseDocument[] = [
      {
        id: 'evt_001',
        title: 'Morning Meditation Session',
        type: 'online',
        date: futureDate(7), // In 7 days
        status: 'upcoming',
        attendees: 0,
        capacity: 100,
        registeredCount: 0,
        checkedInCount: 0,
        host: 'Alice Valid',
        category: 'Wellness',
        organizerId: REAL_USER_IDS.alice,
      },
      {
        id: 'evt_002',
        title: 'Weekend Yoga Retreat',
        type: 'in-person',
        date: futureDate(14), // In 14 days
        status: 'upcoming',
        attendees: 0,
        capacity: 100,
        registeredCount: 0,
        checkedInCount: 0,
        host: 'Grace Hall',
        category: 'Wellness',
        organizerId: REAL_USER_IDS.divya,
      },
      {
        id: 'evt_003',
        title: 'Mindfulness Workshop',
        type: 'online',
        date: pastDate(5), // 5 days ago
        status: 'completed',
        attendees: 0,
        capacity: 100,
        registeredCount: 0,
        checkedInCount: 0,
        host: 'Alice Valid',
        category: 'Wellness',
        organizerId: REAL_USER_IDS.alice,
      },
    ];

    await models.events.insertMany(events);
    console.log('  Created 3 events.\n');
  } else {
    console.log('  Using existing events.\n');
  }

  // Clear existing eventRegistrations and event-type payments
  console.log('Clearing existing eventRegistrations and event payments...');
  await Promise.all([
    models.eventRegistrations.deleteMany({}),
    models.payments.deleteMany({ paymentType: 'event' }),
  ]);
  console.log('  Done.\n');

  // Get current events from DB (in case they were already there)
  const currentEvents = await models.events.find({}).lean();
  const eventIds = currentEvents.map((e: any) => e.id);
  console.log(`Available events: ${eventIds.join(', ')}\n`);

  // Seed data for each real user
  const allUserIds = Object.values(REAL_USER_IDS);

  for (const userId of allUserIds) {
    const userName = REAL_USER_NAMES[userId] || 'Unknown';
    console.log(`Seeding data for ${userName} (${userId})...`);

    // Create 3-5 event registrations per user
    const regCount = 3 + (Math.floor(Math.random() * 3)); // 3-5 registrations

    for (let i = 0; i < regCount; i++) {
      // Select a random event
      const event = currentEvents[Math.floor(Math.random() * currentEvents.length)];
      const eventId = event.id;

      // Determine status based on event date
      const rawDate = event.date as string | Date;
      const eventDate = typeof rawDate === 'string' ? new Date(rawDate) : rawDate;
      const now = new Date();
      const isPastEvent = eventDate <= now;

      // Randomly choose status
      const statusOptions = ['registered', 'attended', 'cancelled'];
      let status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

      // If event is in the past, can't be 'registered' (should be attended or cancelled)
      if (isPastEvent && status === 'registered') {
        status = Math.random() > 0.5 ? 'attended' : 'cancelled';
      }

      // If event is in the future, can't be 'attended'
      if (!isPastEvent && status === 'attended') {
        status = Math.random() > 0.5 ? 'registered' : 'cancelled';
      }

      // Generate checkInDate if attended
      const checkInDate = status === 'attended' ? eventDate : null;

      // Generate ticket info
      const ticketTypes = ['free', 'standard', 'vip'];
      const ticketType = ticketTypes[Math.floor(Math.random() * ticketTypes.length)];
      const price = ticketType === 'free' ? 0 : (ticketType === 'standard' ? 25 : 50);

      const registration: LooseDocument = {
        id: generateId('evtreg', i + 1),
        userId,
        eventId,
        status,
        registrationDate: pastDate(10 - i),
        checkInDate,
        ticketType,
        price,
        ticketCode: `TKT-${userId.substring(0, 4).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        createdAt: pastDate(10 - i),
        updatedAt: pastDate(10 - i),
      };

      await models.eventRegistrations.create(registration);

      // Create a payment record for non-free, non-cancelled registrations
      if (price > 0 && status !== 'cancelled') {
        const payment: LooseDocument = {
          id: generateId('evtpay', i + 1),
          userId,
          amount: price,
          currency: 'USD',
          status: 'completed',
          paymentMethod: 'Credit Card',
          paymentType: 'event',
          eventId,
          registrationId: registration.id,
          createdAt: pastDate(10 - i),
        };
        await models.payments.create(payment);
      }

      console.log(`  Registration ${i + 1}: ${registration.id} -> ${event.title} (${status})`);
    }

    console.log('');
  }

  // Verify counts
  console.log('=== VERIFICATION ===');
  const [
    totalEvents,
    totalRegistrations,
    totalEventPayments
  ] = await Promise.all([
    models.events.countDocuments(),
    models.eventRegistrations.countDocuments(),
    models.payments.countDocuments({ paymentType: 'event' }),
  ]);

  console.log(`Total events: ${totalEvents}`);
  console.log(`Total event registrations: ${totalRegistrations}`);
  console.log(`Total event payments: ${totalEventPayments}`);

  // Show breakdown by status
  const statusBreakdown = await models.eventRegistrations.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).exec();
  console.log('\nRegistrations by status:');
  statusBreakdown.forEach((s: any) => {
    console.log(`  ${s._id}: ${s.count}`);
  });

  // Show events by date
  const now = new Date();
  const upcomingEvents = await models.events.countDocuments({
    date: { $gt: now }
  });
  const pastEvents = await models.events.countDocuments({
    date: { $lte: now }
  });
  console.log(`\nEvents: ${upcomingEvents} upcoming, ${pastEvents} past`);

  console.log('\n=== SEED COMPLETE ===');
  console.log('All placeholder/test data has been seeded.');
  console.log('This is TEST DATA for the EVENTS tab demonstration only.');

  process.exit(0);
}

seedEvents().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
