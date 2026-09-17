"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSingletonRouter = createSingletonRouter;
const express_1 = __importDefault(require("express"));
const clean_1 = require("./clean");
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Unexpected error';
}
function createSingletonRouter(ModelClass, resourceName) {
    const router = express_1.default.Router();
    async function getSingleton() {
        return ModelClass.findOne({ _singleton: resourceName }).lean();
    }
    router.get('/', async (_req, res) => {
        try {
            const doc = await getSingleton();
            if (!doc) {
                return res.status(404).json({ message: `${resourceName} not found` });
            }
            const cleaned = (0, clean_1.cleanDoc)(doc);
            delete cleaned._singleton;
            res.json(cleaned);
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.put('/', async (req, res) => {
        try {
            const payload = { ...req.body, _singleton: resourceName };
            const updated = await ModelClass.findOneAndReplace({ _singleton: resourceName }, payload, {
                new: true,
                upsert: true,
                lean: true,
            });
            const cleaned = (0, clean_1.cleanDoc)(updated);
            delete cleaned._singleton;
            res.json(cleaned);
        }
        catch (error) {
            res.status(400).json({ message: errorMessage(error) });
        }
    });
    router.patch('/', async (req, res) => {
        try {
            const updates = { ...req.body };
            delete updates._singleton;
            const updated = await ModelClass.findOneAndUpdate({ _singleton: resourceName }, { $set: updates, $setOnInsert: { _singleton: resourceName } }, { new: true, upsert: true, lean: true });
            const cleaned = (0, clean_1.cleanDoc)(updated);
            delete cleaned._singleton;
            res.json(cleaned);
        }
        catch (error) {
            res.status(400).json({ message: errorMessage(error) });
        }
    });
    return router;
}
