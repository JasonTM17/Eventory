import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  EventStatus,
  OrganizationMemberRole,
  PrismaClient,
  SeatAllocationStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://eventory:eventory@localhost:5432/eventory?schema=public';
const seedPassword = process.env.EVENTORY_SEED_PASSWORD ?? 'Eventory-Demo-2026!';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The local demo seed must not run in production');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(seedPassword, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const [admin, organizer, attendee] = await Promise.all([
    upsertUser('admin@eventory.local', 'Eventory Admin', UserRole.ADMIN, passwordHash),
    upsertUser('organizer@eventory.local', 'Eventory Organizer', UserRole.ORGANIZER, passwordHash),
    upsertUser('attendee@eventory.local', 'Eventory Attendee', UserRole.ATTENDEE, passwordHash),
  ]);

  const organization = await prisma.organization.upsert({
    where: { slug: 'eventory-demo' },
    update: { name: 'Eventory Demo', ownerId: organizer.id },
    create: { name: 'Eventory Demo', slug: 'eventory-demo', ownerId: organizer.id },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: organizer.id } },
    update: { role: OrganizationMemberRole.OWNER },
    create: {
      organizationId: organization.id,
      userId: organizer.id,
      role: OrganizationMemberRole.OWNER,
    },
  });

  const venue = await prisma.venue.findFirst({
    where: { organizationId: organization.id, name: 'Eventory Hall' },
  });
  const eventVenue =
    venue ??
    (await prisma.venue.create({
      data: {
        organizationId: organization.id,
        name: 'Eventory Hall',
        address: '1 Demo Street, Ho Chi Minh City',
      },
    }));

  const section = await prisma.venueSection.upsert({
    where: { venueId_name: { venueId: eventVenue.id, name: 'Main Floor' } },
    update: { sortOrder: 0 },
    create: { venueId: eventVenue.id, name: 'Main Floor', sortOrder: 0 },
  });

  const seats = [];
  for (let number = 1; number <= 12; number += 1) {
    const seat = await prisma.seat.upsert({
      where: {
        sectionId_rowLabel_seatNumber: { sectionId: section.id, rowLabel: 'A', seatNumber: number },
      },
      update: { venueId: eventVenue.id, code: `A-${number}` },
      create: {
        venueId: eventVenue.id,
        sectionId: section.id,
        rowLabel: 'A',
        seatNumber: number,
        code: `A-${number}`,
      },
    });
    seats.push(seat);
  }

  const startAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000);
  const endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1_000);
  const salesStartAt = new Date(Date.now() - 60 * 60 * 1_000);
  const salesEndAt = new Date(startAt.getTime() - 60 * 60 * 1_000);
  const event = await prisma.event.upsert({
    where: { slug: 'eventory-demo-launch' },
    update: {
      organizationId: organization.id,
      venueId: eventVenue.id,
      name: 'Eventory Demo Launch',
      description: 'A seeded event for walking through discovery and booking.',
      timezone: 'Asia/Ho_Chi_Minh',
      startAt,
      endAt,
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    create: {
      organizationId: organization.id,
      venueId: eventVenue.id,
      name: 'Eventory Demo Launch',
      slug: 'eventory-demo-launch',
      description: 'A seeded event for walking through discovery and booking.',
      timezone: 'Asia/Ho_Chi_Minh',
      startAt,
      endAt,
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  const session = await prisma.eventSession.upsert({
    where: { id: `${event.id}` },
    update: { name: 'Main session', startAt, endAt, salesStartAt, salesEndAt },
    create: { eventId: event.id, name: 'Main session', startAt, endAt, salesStartAt, salesEndAt },
  });
  const ticketType = await prisma.ticketType.upsert({
    where: { eventId_name: { eventId: event.id, name: 'General Admission' } },
    update: {
      description: 'Standard demo ticket',
      priceMinor: 250_000,
      currency: 'VND',
      capacity: seats.length,
    },
    create: {
      eventId: event.id,
      name: 'General Admission',
      description: 'Standard demo ticket',
      priceMinor: 250_000,
      currency: 'VND',
      capacity: seats.length,
    },
  });

  await Promise.all(
    seats.map((seat) =>
      prisma.seatAllocation.upsert({
        where: { eventSessionId_seatId: { eventSessionId: session.id, seatId: seat.id } },
        update: { ticketTypeId: ticketType.id, status: SeatAllocationStatus.AVAILABLE },
        create: {
          eventSessionId: session.id,
          seatId: seat.id,
          ticketTypeId: ticketType.id,
          status: SeatAllocationStatus.AVAILABLE,
        },
      }),
    ),
  );

  console.log(
    JSON.stringify(
      {
        users: [admin.email, organizer.email, attendee.email],
        organization: organization.slug,
        event: event.slug,
        seats: seats.length,
        seedPassword: 'set via EVENTORY_SEED_PASSWORD or the documented local default',
      },
      null,
      2,
    ),
  );
}

async function upsertUser(
  email: string,
  displayName: string,
  role: UserRole,
  passwordHash: string,
): Promise<{ id: string; email: string }> {
  return prisma.user.upsert({
    where: { email },
    update: { displayName, role, status: UserStatus.ACTIVE, passwordHash },
    create: { email, displayName, role, status: UserStatus.ACTIVE, passwordHash },
    select: { id: true, email: true },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
