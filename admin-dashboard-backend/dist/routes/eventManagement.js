"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventCrudRouter = createEventCrudRouter;
exports.createEventRegistrationRouter = createEventRegistrationRouter;
exports.createEventAnalyticsRouter = createEventAnalyticsRouter;
exports.createEventManagementRouter = createEventManagementRouter;
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const clean_1 = require("../utils/clean");
const ids_1 = require("../utils/ids");
const auth_1 = require("../middleware/auth");
const eventImageStorage_1 = require("../services/eventImageStorage");
const eventManagement_1 = require("../services/eventManagement");
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Unexpected error';
}
function statusCode(error) {
    return error instanceof eventManagement_1.EventInputError || error instanceof eventManagement_1.EventConflictError || error instanceof eventManagement_1.EventNotFoundError
        ? error.statusCode
        : 500;
}
function createEventCrudRouter(models) {
    const router = express_1.default.Router();
    const permission = [auth_1.requireAuth, (0, auth_1.requirePermission)(eventManagement_1.EVENTS_MANAGE_PERMISSION)];
    router.post('/upload-image', ...permission, eventImageStorage_1.eventImageUpload.single('file'), (req, res) => {
        if (!req.file)
            return res.status(400).json({ message: 'An image file is required.' });
        res.status(201).json({ imageUrl: (0, eventImageStorage_1.eventImageUrl)(req, req.file.filename) });
    });
    router.post('/', ...permission, async (req, res) => {
        try {
            const payload = (0, eventManagement_1.validateCreateEvent)(req.body);
            payload.id = (0, ids_1.createId)('event');
            const event = await models.events.create(payload);
            const cleaned = (0, clean_1.cleanDoc)(event);
            await (0, eventManagement_1.writeEventAudit)(models, req, 'event.created', String(payload.id), `Created event ${payload.id}.`);
            res.status(201).json(cleaned);
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.get('/:id', ...permission, async (req, res) => {
        try {
            const eventId = String(req.params.id);
            const event = await models.events.findOne({ id: eventId }).lean();
            if (!event)
                return res.status(404).json({ message: 'events not found' });
            res.json((0, clean_1.cleanDoc)(event));
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.patch('/:id', ...permission, async (req, res) => {
        try {
            const eventId = String(req.params.id);
            const existing = await models.events.findOne({ id: eventId }).lean();
            if (!existing)
                return res.status(404).json({ message: 'events not found' });
            const updates = (0, eventManagement_1.validateEventUpdates)(req.body);
            if (updates.capacity !== undefined) {
                const activeRegistrations = await models.eventRegistrations.countDocuments({ eventId, status: { $ne: 'cancelled' } });
                if (Number(updates.capacity) < activeRegistrations) {
                    throw new eventManagement_1.EventConflictError(`capacity cannot be lower than ${activeRegistrations} active registrations.`);
                }
            }
            updates.updatedAt = new Date();
            const updated = await models.events.findOneAndUpdate({ id: eventId }, { $set: updates }, { new: true, runValidators: true, lean: true }).lean();
            if (!updated)
                return res.status(404).json({ message: 'events not found' });
            await (0, eventManagement_1.writeEventAudit)(models, req, 'event.updated', eventId, `Updated event ${eventId}: ${Object.keys(updates).join(', ')}.`);
            res.json((0, clean_1.cleanDoc)(updated));
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.delete('/:id', ...permission, async (req, res) => {
        try {
            const eventId = String(req.params.id);
            const existing = await models.events.findOne({ id: eventId }).lean();
            if (!existing)
                return res.status(404).json({ message: 'events not found' });
            // Write audit log BEFORE deletion - capture enough detail since event will be gone
            const eventTitle = String(existing.title || 'Unknown Event');
            await (0, eventManagement_1.writeEventAudit)(models, req, 'event.deleted', eventId, `Deleted event ${eventId} (${eventTitle}). All registrations cascade deleted. Image file removed if existed. Payments preserved.`);
            // Cascade delete all eventRegistrations tied to this eventId
            await models.eventRegistrations.deleteMany({ eventId });
            // Delete the event's uploaded image file from disk if one exists
            const imageUrl = String(existing.imageUrl || '');
            if (imageUrl) {
                // Extract filename from URL like /uploads/events/<filename>
                const match = imageUrl.match(/\/uploads\/events\/([^/?#]+)/);
                if (match) {
                    const filename = match[1];
                    const filePath = path_1.default.resolve(process.cwd(), 'uploads', 'events', filename);
                    if (fs_1.default.existsSync(filePath)) {
                        fs_1.default.unlinkSync(filePath);
                    }
                }
            }
            // Delete the event itself
            await models.events.deleteOne({ id: eventId });
            // NOTE: We do NOT delete records from the payments collection.
            // Payment/revenue history must survive event deletion for financial audit trail.
            // This is intentional - payments are linked by eventId/registrationId but represent
            // completed financial transactions that should not be erased.
            res.status(204).send();
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    return router;
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function createEventRegistrationRouter(models) {
    const router = express_1.default.Router();
    const permission = [auth_1.requireAuth, (0, auth_1.requirePermission)(eventManagement_1.EVENTS_MANAGE_PERMISSION)];
    router.post('/:id/registrations', auth_1.requireAuth, async (req, res) => {
        try {
            const registration = await (0, eventManagement_1.registerForEvent)(models, String(req.params.id), req.body);
            res.status(201).json(registration);
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.patch('/:eventId/registrations/:registrationId', auth_1.requireAuth, async (req, res) => {
        try {
            if (String(req.body?.status || '') !== 'cancelled') {
                throw new eventManagement_1.EventInputError('Only cancellation is supported by this endpoint.');
            }
            const registration = await (0, eventManagement_1.cancelEventRegistration)(models, String(req.params.eventId), String(req.params.registrationId));
            res.json(registration);
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.get('/:id/registrations', ...permission, async (req, res) => {
        try {
            const eventId = String(req.params.id);
            const event = await models.events.findOne({ id: eventId }).lean();
            if (!event)
                return res.status(404).json({ message: 'events not found' });
            const search = String(req.query.search || '').trim();
            const registrationQuery = { eventId };
            if (search) {
                const escaped = escapeRegExp(search);
                const matchingUsers = await models.users.find({ name: { $regex: escaped, $options: 'i' } }).lean();
                const matchingUserIds = matchingUsers.map((user) => String(user.id)).filter(Boolean);
                registrationQuery.$or = [
                    { id: { $regex: escaped, $options: 'i' } },
                    { ticketCode: { $regex: escaped, $options: 'i' } },
                    { userId: { $in: matchingUserIds } },
                ];
            }
            const registrations = await models.eventRegistrations.find(registrationQuery).sort({ registrationDate: -1 }).lean();
            const userIds = registrations.map((registration) => String(registration.userId || '')).filter(Boolean);
            const users = await models.users.find({ id: { $in: userIds } }).lean();
            const userMap = new Map(users.map((user) => [String(user.id), user]));
            const data = registrations.map((registration) => {
                const user = userMap.get(String(registration.userId));
                const cleanedRegistration = (0, clean_1.cleanDoc)(registration);
                return {
                    ...cleanedRegistration,
                    user: user ? { id: user.id, name: user.name } : null,
                };
            });
            res.json({ event: (0, clean_1.cleanDoc)(event), data, total: data.length });
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.post('/:id/checkin', ...permission, async (req, res) => {
        try {
            const identifier = String(req.body?.registrationId || req.body?.ticketCode || '');
            const registration = await (0, eventManagement_1.checkInEventRegistration)(models, String(req.params.id), identifier);
            const audit = await (0, eventManagement_1.writeEventAudit)(models, req, 'event.checkin', String(req.params.id), `Checked in registration ${registration.id} for event ${req.params.id}.`);
            res.json({ registration, audit });
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    return router;
}
function createEventAnalyticsRouter(models) {
    const router = express_1.default.Router();
    const permission = [auth_1.requireAuth, (0, auth_1.requirePermission)(eventManagement_1.EVENTS_MANAGE_PERMISSION)];
    router.get('/analytics/summary', ...permission, async (_req, res) => {
        try {
            res.json(await (0, eventManagement_1.getEventAnalyticsSummary)(models));
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    router.get('/:id/analytics', ...permission, async (req, res) => {
        try {
            res.json(await (0, eventManagement_1.getEventAnalytics)(models, String(req.params.id)));
        }
        catch (error) {
            res.status(statusCode(error)).json({ message: errorMessage(error) });
        }
    });
    return router;
}
function createEventManagementRouter(_models) {
    const router = express_1.default.Router();
    const permission = [auth_1.requireAuth, (0, auth_1.requirePermission)(eventManagement_1.EVENTS_MANAGE_PERMISSION)];
    router.get('/', ...permission, (_req, res) => {
        res.json({ ready: true, permission: eventManagement_1.EVENTS_MANAGE_PERMISSION });
    });
    return router;
}
