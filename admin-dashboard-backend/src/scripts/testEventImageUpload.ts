import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';

async function upload(baseUrl: string, token: string | undefined, content: Buffer, filename: string, type: string): Promise<Response> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(content)], { type }), filename);
  return fetch(`${baseUrl}/events/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
}

async function testEventImageUpload(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    deniedRole: `test_image_role_denied_${suffix}`,
    allowedRole: `test_image_role_allowed_${suffix}`,
    deniedAdmin: `test_image_admin_denied_${suffix}`,
    allowedAdmin: `test_image_admin_allowed_${suffix}`,
    deniedSession: `test_image_session_denied_${suffix}`,
    allowedSession: `test_image_session_allowed_${suffix}`,
  };
  const createdFiles: string[] = [];

  const app = express();
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));
  registerRoutes(app);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : error?.code === 'LIMIT_FILE_SIZE' ? 400 : 500;
    res.status(statusCode).json({ message: error?.code === 'LIMIT_FILE_SIZE' ? 'Image file must be 5MB or smaller.' : error?.message || 'Upload failed.' });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const now = new Date();

  try {
    await models.roles.create([
      { id: ids.deniedRole, name: 'Image Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Image Allowed', permissions: ['EVENTS_MANAGE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Image Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Image Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
    ]);

    const imageBytes = Buffer.from('phase-6-image');
    const denied = await upload(baseUrl, ids.deniedSession, imageBytes, 'denied.png', 'image/png');
    if (denied.status !== 403) throw new Error(`Expected upload permission denial 403, received ${denied.status}.`);

    const first = await upload(baseUrl, ids.allowedSession, imageBytes, 'first.png', 'image/png');
    if (first.status !== 201) throw new Error(`Expected valid image upload 201, received ${first.status}.`);
    const firstBody = await first.json() as { imageUrl?: string };
    if (!firstBody.imageUrl) throw new Error('Expected imageUrl from valid upload.');
    const firstUrl = new URL(firstBody.imageUrl);
    createdFiles.push(path.join('uploads', 'events', path.basename(firstUrl.pathname)));
    if (!/^https?:\/\//.test(firstBody.imageUrl)) throw new Error(`Expected absolute imageUrl, received ${firstBody.imageUrl}.`);

    const staticResponse = await fetch(firstBody.imageUrl);
    if (staticResponse.status !== 200) throw new Error(`Expected uploaded file to be static, received ${staticResponse.status}.`);

    const second = await upload(baseUrl, ids.allowedSession, imageBytes, 'second.png', 'image/png');
    if (second.status !== 201) throw new Error(`Expected second image upload 201, received ${second.status}.`);
    const secondBody = await second.json() as { imageUrl?: string };
    if (!secondBody.imageUrl || secondBody.imageUrl === firstBody.imageUrl) throw new Error('Expected unique upload filenames.');
    createdFiles.push(path.join('uploads', 'events', path.basename(new URL(secondBody.imageUrl).pathname)));

    const invalidMime = await upload(baseUrl, ids.allowedSession, imageBytes, 'text.txt', 'text/plain');
    if (invalidMime.status !== 400) throw new Error(`Expected invalid MIME 400, received ${invalidMime.status}.`);

    const oversized = await upload(baseUrl, ids.allowedSession, Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png', 'image/png');
    if (oversized.status !== 400) throw new Error(`Expected oversized image 400, received ${oversized.status}.`);

    console.log('Event image upload Phase 6 test passed.');
  } finally {
    for (const file of createdFiles) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    await Promise.all([
      models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
      models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
      models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
    ]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
  }
}

testEventImageUpload().catch((error: unknown) => {
  console.error('Event image upload Phase 6 test failed:', error);
  process.exitCode = 1;
});
