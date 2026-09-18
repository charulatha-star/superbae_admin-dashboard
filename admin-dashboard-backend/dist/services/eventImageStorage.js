"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventImageUpload = exports.EventImageUploadError = void 0;
exports.eventImageUrl = eventImageUrl;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const eventUploadDirectory = path_1.default.resolve(process.cwd(), 'uploads', 'events');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
fs_1.default.mkdirSync(eventUploadDirectory, { recursive: true });
class EventImageUploadError extends Error {
    statusCode = 400;
}
exports.EventImageUploadError = EventImageUploadError;
function extensionForMimeType(mimeType) {
    const extensions = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
    };
    return extensions[mimeType] || '';
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, callback) => callback(null, eventUploadDirectory),
    filename: (_req, file, callback) => {
        const extension = extensionForMimeType(file.mimetype);
        callback(null, `${crypto_1.default.randomUUID()}${extension}`);
    },
});
exports.eventImageUpload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            // Use the single-argument overload to signal an error
            callback(new EventImageUploadError('Only JPEG, PNG, GIF, and WebP images are allowed.'));
            return;
        }
        // Accept the file
        callback(null, true);
    },
});
function eventImageUrl(req, filename) {
    const configuredBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
    const baseUrl = configuredBaseUrl || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/uploads/events/${encodeURIComponent(filename)}`;
}
