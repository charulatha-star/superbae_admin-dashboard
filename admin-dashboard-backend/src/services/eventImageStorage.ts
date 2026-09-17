import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

const eventUploadDirectory = path.resolve(process.cwd(), 'uploads', 'events');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

fs.mkdirSync(eventUploadDirectory, { recursive: true });

export class EventImageUploadError extends Error {
  statusCode = 400;
}

function extensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return extensions[mimeType] || '';
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, eventUploadDirectory),
  filename: (_req, file, callback) => {
    const extension = extensionForMimeType(file.mimetype);
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

export const eventImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new EventImageUploadError('Only JPEG, PNG, GIF, and WebP images are allowed.'));
      return;
    }
    callback(null, true);
  },
});

export function eventImageUrl(req: { protocol: string; get(name: string): string | undefined }, filename: string): string {
  const configuredBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  const baseUrl = configuredBaseUrl || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/events/${encodeURIComponent(filename)}`;
}
