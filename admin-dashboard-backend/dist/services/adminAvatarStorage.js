"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAvatarUpload = void 0;
exports.adminAvatarUrl = adminAvatarUrl;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const avatarUploadDirectory = path_1.default.resolve(process.cwd(), 'uploads', 'avatars');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
fs_1.default.mkdirSync(avatarUploadDirectory, { recursive: true });
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
    destination: (_req, _file, callback) => callback(null, avatarUploadDirectory),
    filename: (_req, file, callback) => {
        const extension = extensionForMimeType(file.mimetype);
        callback(null, `${crypto_1.default.randomUUID()}${extension}`);
    },
});
exports.adminAvatarUpload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for avatars
    fileFilter: (_req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            callback(new Error('Only JPEG, PNG, GIF, and WebP images are allowed.'));
            return;
        }
        callback(null, true);
    },
});
function adminAvatarUrl(req, filename) {
    const configuredBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
    const baseUrl = configuredBaseUrl || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/uploads/avatars/${encodeURIComponent(filename)}`;
}
