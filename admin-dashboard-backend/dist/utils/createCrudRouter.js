"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCrudRouter = createCrudRouter;
const express_1 = __importDefault(require("express"));
const clean_1 = require("./clean");
const ids_1 = require("./ids");
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Unexpected error';
}
function buildFilter(query) {
    const filter = {};
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '')
            continue;
        if (['_limit', '_page', '_sort', '_order', '_embed', '_expand'].includes(key)) {
            continue;
        }
        filter[key] = value;
    }
    return filter;
}
function createCrudRouter(ModelClass, resourceName) {
    const router = express_1.default.Router();
    const shouldHidePasswords = resourceName === 'admins';
    function sanitize(doc) {
        const cleaned = (0, clean_1.cleanDoc)(doc);
        if (shouldHidePasswords && cleaned) {
            delete cleaned.password;
        }
        return cleaned;
    }
    function sanitizeMany(docs) {
        return docs.map(sanitize);
    }
    // Updated GET handler with pagination and sorting
    router.get('/', async (req, res) => {
        try {
            // Build filter excluding special params
            const filter = buildFilter(req.query);
            // Pagination parameters
            const limit = parseInt(req.query._limit) || 0;
            const page = parseInt(req.query._page) || 1;
            const skip = limit && page > 1 ? (page - 1) * limit : 0;
            // Sorting parameters
            const sortKey = req.query._sort;
            const sortOrder = req.query._order === 'desc' ? -1 : 1;
            let query = ModelClass.find(filter).lean();
            if (sortKey) {
                // @ts-ignore dynamic sort object
                query = query.sort({ [sortKey]: sortOrder });
            }
            if (limit) {
                query = query.skip(skip).limit(limit);
            }
            const docs = await query;
            res.json(shouldHidePasswords ? sanitizeMany(docs) : (0, clean_1.cleanDocs)(docs));
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const doc = await ModelClass.findOne({ id: req.params.id }).lean();
            if (!doc) {
                return res.status(404).json({ message: `${resourceName} not found` });
            }
            res.json(sanitize(doc));
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.post('/', async (req, res) => {
        try {
            const payload = { ...req.body };
            if (!payload.id) {
                payload.id = (0, ids_1.createId)(resourceName.replace(/s$/, ''));
            }
            const created = await ModelClass.create(payload);
            res.status(201).json(sanitize((0, clean_1.cleanDoc)(created)));
        }
        catch (error) {
            res.status(400).json({ message: errorMessage(error) });
        }
    });
    router.put('/:id', async (req, res) => {
        try {
            const payload = { ...req.body, id: req.params.id };
            const updated = await ModelClass.findOneAndReplace({ id: req.params.id }, payload, {
                new: true,
                upsert: false,
                lean: true,
            });
            if (!updated) {
                return res.status(404).json({ message: `${resourceName} not found` });
            }
            res.json(sanitize(updated));
        }
        catch (error) {
            res.status(400).json({ message: errorMessage(error) });
        }
    });
    router.patch('/:id', async (req, res) => {
        try {
            const updates = { ...req.body };
            delete updates.id;
            const updated = await ModelClass.findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true, lean: true });
            if (!updated) {
                return res.status(404).json({ message: `${resourceName} not found` });
            }
            res.json(sanitize(updated));
        }
        catch (error) {
            res.status(400).json({ message: errorMessage(error) });
        }
    });
    router.delete('/:id', async (req, res) => {
        try {
            const deleted = await ModelClass.findOneAndDelete({ id: req.params.id }).lean();
            if (!deleted) {
                return res.status(404).json({ message: `${resourceName} not found` });
            }
            res.status(200).json(sanitize(deleted));
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    return router;
}
