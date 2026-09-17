import { Request } from 'express';
import mongoose from 'mongoose';
import { createId } from '../utils/ids';
import { cleanDoc } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';

export const EVENTS_MANAGE_PERMISSION = 'EVENTS_MANAGE' as const;

export type EventInput = {
	title?: unknown;
	description?: unknown;
	category?: unknown;
	type?: unknown;
	date?: unknown;
	location?: unknown;
	capacity?: unknown;
	imageUrl?: unknown;
	reminderConfig?: unknown;
	status?: unknown;
	host?: unknown;
	organizerId?: unknown;
};

export class EventInputError extends Error {
	statusCode = 400;
}

export class EventConflictError extends Error {
	statusCode = 409;
}

export class EventNotFoundError extends Error {
	statusCode = 404;
}

function requiredText(value: unknown, field: string): string {
	const text = String(value ?? '').trim();
	if (!text) throw new EventInputError(`${field} is required.`);
	return text;
}

function eventDate(value: unknown): Date {
	const date = new Date(String(value ?? ''));
	if (!value || Number.isNaN(date.getTime())) throw new EventInputError('date must be a valid date.');
	return date;
}

function capacity(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) throw new EventInputError('capacity must be a positive integer.');
	return parsed;
}

function reminderConfig(value: unknown): LooseDocument {
	if (value == null) return { enabled: false, sendBeforeHours: 24 };
	if (typeof value !== 'object' || Array.isArray(value)) throw new EventInputError('reminderConfig must be an object.');
	const config = value as Record<string, unknown>;
	const enabled = config.enabled === true;
	const sendBeforeHours = config.sendBeforeHours == null ? 24 : Number(config.sendBeforeHours);
	if (!Number.isFinite(sendBeforeHours) || sendBeforeHours <= 0) {
		throw new EventInputError('reminderConfig.sendBeforeHours must be greater than 0.');
	}
	return { enabled, sendBeforeHours };
}

export function validateCreateEvent(input: EventInput): LooseDocument {
	return {
		title: requiredText(input.title, 'title'),
		description: input.description == null ? null : String(input.description).trim() || null,
		category: requiredText(input.category, 'category'),
		type: requiredText(input.type, 'type'),
		date: eventDate(input.date),
		location: input.location == null ? null : String(input.location).trim() || null,
		capacity: capacity(input.capacity),
		imageUrl: input.imageUrl == null ? null : String(input.imageUrl).trim() || null,
		reminderConfig: reminderConfig(input.reminderConfig),
		status: input.status == null ? 'upcoming' : String(input.status).trim() || 'upcoming',
		attendees: 0,
		checkedInCount: 0,
		host: input.host == null ? null : String(input.host).trim() || null,
		organizerId: input.organizerId == null ? null : String(input.organizerId).trim() || null,
	};
}

export function validateEventUpdates(input: EventInput): LooseDocument {
	const updates: LooseDocument = {};
	if (input.title !== undefined) updates.title = requiredText(input.title, 'title');
	if (input.description !== undefined) updates.description = input.description == null ? null : String(input.description).trim() || null;
	if (input.category !== undefined) updates.category = requiredText(input.category, 'category');
	if (input.type !== undefined) updates.type = requiredText(input.type, 'type');
	if (input.date !== undefined) updates.date = eventDate(input.date);
	if (input.location !== undefined) updates.location = input.location == null ? null : String(input.location).trim() || null;
	if (input.capacity !== undefined) updates.capacity = capacity(input.capacity);
	if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl == null ? null : String(input.imageUrl).trim() || null;
	if (input.reminderConfig !== undefined) updates.reminderConfig = reminderConfig(input.reminderConfig);
	if (input.status !== undefined) updates.status = requiredText(input.status, 'status');
	if (input.host !== undefined) updates.host = input.host == null ? null : String(input.host).trim() || null;
	if (input.organizerId !== undefined) updates.organizerId = input.organizerId == null ? null : String(input.organizerId).trim() || null;
	if (Object.keys(updates).length === 0) throw new EventInputError('At least one event field is required.');
	return updates;
}

export async function writeEventAudit(
	models: ModelRegistry,
	req: Request,
	action: string,
	eventId: string,
	description: string,
): Promise<LooseDocument> {
	try {
		const result = await models.auditLogs.create({
			id: createId('audit'),
			adminId: typeof req.currentAdmin?.id === 'string' ? req.currentAdmin.id : 'unknown',
			adminName: typeof req.currentAdmin?.name === 'string' ? req.currentAdmin.name : 'Unknown Admin',
			action,
			target: eventId,
			description,
			createdAt: new Date(),
			targetType: 'event',
			targetId: eventId,
			reason: null,
		});
		return cleanDoc(result);
	} catch (e) {
		throw e;
	}
}

function registrationText(value: unknown, field: string): string | null {
	if (value == null) return null;
	const text = String(value).trim();
	return text || null;
}

export async function registerForEvent(
	models: ModelRegistry,
	eventId: string,
	input: LooseDocument,
): Promise<LooseDocument> {
	const userId = registrationText(input.userId, 'userId');
	if (!userId) throw new EventInputError('userId is required.');

	const session = await mongoose.startSession();
	let registration: LooseDocument | null = null;
	try {
		await session.withTransaction(async () => {
			const event = await models.events.findOne({ id: eventId }).session(session).lean<LooseDocument | null>();
			if (!event) throw new EventNotFoundError('events not found');
			if (event.status === 'archived') throw new EventConflictError('Archived events cannot accept registrations.');

			const user = await models.users.findOne({ id: userId }).session(session).lean<LooseDocument | null>();
			if (!user) throw new EventNotFoundError('User not found.');

			const duplicate = await models.eventRegistrations.findOne({
				eventId,
				userId,
				status: { $ne: 'cancelled' },
			}).session(session).lean<LooseDocument | null>();
			if (duplicate) throw new EventConflictError('User is already registered for this event.');

			const reserved = await models.events.findOneAndUpdate(
				{
					id: eventId,
					status: { $ne: 'archived' },
					$expr: { $lt: [{ $ifNull: ['$registeredCount', 0] }, '$capacity'] },
				},
				{ $inc: { registeredCount: 1 } },
				{ new: true, session, lean: true },
			).lean<LooseDocument | null>();
			if (!reserved) throw new EventConflictError('Event capacity has been reached.');

			const documents = await models.eventRegistrations.create([{
				id: createId('eventRegistration'),
				userId,
				eventId,
				status: 'registered',
				registrationDate: new Date(),
				checkInDate: null,
				ticketType: registrationText(input.ticketType, 'ticketType'),
				price: input.price == null ? null : Number(input.price),
				ticketCode: registrationText(input.ticketCode, 'ticketCode'),
				createdAt: new Date(),
				updatedAt: new Date(),
			}], { session });
			registration = cleanDoc(documents[0]);
		});
		if (!registration) throw new Error('Registration was not created.');
		return registration;
	} finally {
		await session.endSession();
	}
}

export async function cancelEventRegistration(
	models: ModelRegistry,
	eventId: string,
	registrationId: string,
): Promise<LooseDocument> {
	const session = await mongoose.startSession();
	let registration: LooseDocument | null = null;
	try {
		await session.withTransaction(async () => {
			const existing = await models.eventRegistrations.findOne({ id: registrationId, eventId }).session(session).lean<LooseDocument | null>();
			if (!existing) throw new EventNotFoundError('event registration not found');
			if (existing.status === 'cancelled') throw new EventConflictError('Registration is already cancelled.');

			const updated = await models.eventRegistrations.findOneAndUpdate(
				{ id: registrationId, eventId, status: { $ne: 'cancelled' } },
				{ $set: { status: 'cancelled', updatedAt: new Date() } },
				{ new: true, session, lean: true },
			).lean<LooseDocument | null>();
			if (!updated) throw new EventConflictError('Registration is already cancelled.');

			const event = await models.events.findOneAndUpdate(
				{ id: eventId, registeredCount: { $gt: 0 } },
				{ $inc: { registeredCount: -1 } },
				{ new: true, session, lean: true },
			).lean<LooseDocument | null>();
			if (!event) throw new EventConflictError('Event registration count is inconsistent.');
			registration = cleanDoc(updated);
		});
		if (!registration) throw new Error('Registration was not cancelled.');
		return registration;
	} finally {
		await session.endSession();
	}
}

export async function checkInEventRegistration(
	models: ModelRegistry,
	eventId: string,
	identifier: string,
): Promise<LooseDocument> {
	if (!identifier.trim()) throw new EventInputError('registrationId or ticketCode is required.');

	const session = await mongoose.startSession();
	let registration: LooseDocument | null = null;
	try {
		await session.withTransaction(async () => {
			const event = await models.events.findOne({ id: eventId }).session(session).lean<LooseDocument | null>();
			if (!event) throw new EventNotFoundError('events not found');

			const existing = await models.eventRegistrations.findOne({
				eventId,
				$or: [{ id: identifier }, { ticketCode: identifier }],
			}).session(session).lean<LooseDocument | null>();
			if (!existing) throw new EventNotFoundError('event registration not found');
			if (existing.status === 'attended') throw new EventConflictError('Already checked in');
			if (existing.status !== 'registered') throw new EventConflictError('Only registered attendees can be checked in.');

			const checkedInAt = new Date();
			const updated = await models.eventRegistrations.findOneAndUpdate(
				{ id: String(existing.id), eventId, status: 'registered' },
				{ $set: { status: 'attended', checkInDate: checkedInAt, updatedAt: checkedInAt } },
				{ new: true, session, lean: true },
			).lean<LooseDocument | null>();
			if (!updated) throw new EventConflictError('Already checked in');

			const eventUpdate = await models.events.findOneAndUpdate(
				{ id: eventId, checkedInCount: { $lt: Number(event.capacity) } },
				{ $inc: { checkedInCount: 1 } },
				{ new: true, session, lean: true },
			).lean<LooseDocument | null>();
			if (!eventUpdate) throw new EventConflictError('Checked-in count cannot exceed event capacity.');
			registration = cleanDoc(updated);
		});
		if (!registration) throw new Error('Registration was not checked in.');
		return registration;
	} finally {
		await session.endSession();
	}
}

export const EVENT_ANALYTICS_DEFINITIONS = {
	activeRegistrations: 'Registrations whose status is not cancelled.',
	attendanceRate: 'Attended registrations divided by active registrations; zero when there are no active registrations.',
	cancellationRate: 'Cancelled registrations divided by all registrations.',
	noShowRate: 'For past events, active registrations not marked attended divided by active registrations.',
	revenue: 'Completed payments with paymentType event, matched by eventId or an event registrationId.',
};

export async function getEventAnalytics(models: ModelRegistry, eventId: string): Promise<LooseDocument> {
	const event = await models.events.findOne({ id: eventId }).lean<LooseDocument | null>();
	if (!event) throw new EventNotFoundError('events not found');

	const [registrationResult, revenueResult, trend] = await Promise.all([
		models.eventRegistrations.aggregate([
			{ $match: { eventId } },
			{
				$facet: {
					totals: [{ $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } }, attended: { $sum: { $cond: [{ $eq: ['$status', 'attended'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }],
					noShows: [{ $match: { status: { $ne: 'cancelled' } } }, { $count: 'count' }],
				},
			},
		]).exec(),
		models.payments.aggregate([
			{ $match: { paymentType: 'event', status: 'completed' } },
			{
				$lookup: {
					from: 'eventRegistrations',
					localField: 'registrationId',
					foreignField: 'id',
					as: 'registration',
				},
			},
			{
				$match: {
					$or: [{ eventId }, { 'registration.eventId': eventId }],
				},
			},
			{ $group: { _id: null, revenue: { $sum: { $ifNull: ['$amount', 0] } } } },
		]).exec(),
		models.eventRegistrations.aggregate([
			{ $match: { eventId } },
			{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$registrationDate' } }, registrations: { $sum: 1 } } },
			{ $sort: { _id: 1 } },
		]).exec(),
	]);

	const totals = registrationResult[0]?.totals?.[0] || { total: 0, active: 0, attended: 0, cancelled: 0 };
	const active = Number(totals.active || 0);
	const attended = Number(totals.attended || 0);
	const cancelled = Number(totals.cancelled || 0);
	const total = Number(totals.total || 0);
	const pastEvent = event.date instanceof Date ? event.date.getTime() < Date.now() : new Date(String(event.date)).getTime() < Date.now();
	const noShows = pastEvent ? Math.max(active - attended, 0) : 0;
	const capacityValue = Number(event.capacity);

	return {
		event: cleanDoc(event),
		registered: active,
		capacity: Number.isFinite(capacityValue) && capacityValue > 0 ? capacityValue : 0,
		utilization: Number.isFinite(capacityValue) && capacityValue > 0 ? active / capacityValue : 0,
		attended,
		attendanceRate: active > 0 ? attended / active : 0,
		cancelled,
		cancellationRate: total > 0 ? cancelled / total : 0,
		noShows,
		noShowRate: pastEvent && active > 0 ? noShows / active : 0,
		revenue: Number(revenueResult[0]?.revenue || 0),
		registrationTrend: trend.map((point) => ({ date: point._id, registrations: point.registrations })),
		definitions: EVENT_ANALYTICS_DEFINITIONS,
	};
}

export async function getEventAnalyticsSummary(models: ModelRegistry): Promise<LooseDocument> {
	const [events, registrations, payments] = await Promise.all([
		models.events.aggregate([{ $group: { _id: null, total: { $sum: 1 }, capacity: { $sum: { $cond: [{ $gt: ['$capacity', 0] }, '$capacity', 0] } } } }]).exec(),
		models.eventRegistrations.aggregate([
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					registered: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
					attended: { $sum: { $cond: [{ $eq: ['$status', 'attended'] }, 1, 0] } },
					cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
				},
			},
		]).exec(),
		models.payments.aggregate([{ $match: { paymentType: 'event', status: 'completed' } }, { $group: { _id: null, revenue: { $sum: { $ifNull: ['$amount', 0] } } } }]).exec(),
	]);
	const registration = registrations[0] || { total: 0, registered: 0, attended: 0, cancelled: 0 };
	const capacityValue = Number(events[0]?.capacity || 0);
	return {
		events: Number(events[0]?.total || 0),
		registered: Number(registration.registered || 0),
		capacity: capacityValue,
		utilization: capacityValue > 0 ? Number(registration.registered || 0) / capacityValue : 0,
		attended: Number(registration.attended || 0),
		cancelled: Number(registration.cancelled || 0),
		revenue: Number(payments[0]?.revenue || 0),
	};
}
