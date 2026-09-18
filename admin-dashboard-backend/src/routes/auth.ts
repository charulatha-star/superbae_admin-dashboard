import express from 'express';
import { randomUUID } from 'crypto';
import { cleanDoc } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { adminAvatarUpload, adminAvatarUrl } from '../services/adminAvatarStorage';
import { requireAuth } from '../middleware/auth';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function stripPassword<T extends LooseDocument | null>(admin: T): T {
  if (!admin) return admin;
  const safe = { ...admin };
  delete safe.password;
  return safe as T;
}

export function createAuthRouter(models: ModelRegistry) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const admin = await models.admins.findOne({ email }).lean<LooseDocument | null>();

      if (!admin || admin.password !== password) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      if (admin.status !== 'active') {
        return res.status(403).json({ message: 'Your account is suspended.' });
      }

      const lastLoginAt = new Date().toISOString();
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const updated = await models.admins
        .findOneAndUpdate({ id: admin.id }, { $set: { lastLoginAt } }, { new: true, lean: true })
        .lean<LooseDocument | null>();

      await models.adminSessions.create({
        id: `session_${randomUUID()}`,
        adminId: admin.id,
        token,
        createdAt: new Date(),
        expiresAt,
        revokedAt: null,
      });

      res.json({ ...stripPassword(cleanDoc(updated || { ...admin, lastLoginAt })), token });
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.get('/me', async (req, res) => {
    try {
      const authorization = req.get('Authorization');
      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';

      if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing bearer token.' });
      }

      const session = await models.adminSessions
        .findOne({
          token,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        })
        .lean<LooseDocument | null>();

      if (!session || !session.adminId) {
        return res.status(401).json({ message: 'Unauthorized: Session expired or invalid.' });
      }

      const admin = await models.admins.findOne({ id: session.adminId }).lean<LooseDocument | null>();
      if (!admin) {
        return res.status(401).json({ message: 'Unauthorized: Admin not found for active session.' });
      }

      res.json(stripPassword(cleanDoc(admin)));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      const authorization = req.get('Authorization');
      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';

      if (token) {
        await models.adminSessions.updateMany(
          { token, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  // POST /auth/me/avatar — upload profile picture for the currently logged-in admin
  router.post(
    '/me/avatar',
    requireAuth,
    adminAvatarUpload.single('avatar'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No image file provided.' });
        }
        const adminId = String(req.currentAdmin?.id || '');
        if (!adminId) {
          return res.status(401).json({ message: 'Unauthorized.' });
        }

        const avatarUrl = adminAvatarUrl(req, req.file.filename);

        const updated = await models.admins
          .findOneAndUpdate(
            { id: adminId },
            { $set: { avatar: avatarUrl } },
            { new: true, lean: true }
          )
          .lean<LooseDocument | null>();

        if (!updated) {
          return res.status(404).json({ message: 'Admin not found.' });
        }

        res.json(stripPassword(cleanDoc(updated)));
      } catch (error) {
        res.status(500).json({ message: errorMessage(error) });
      }
    }
  );

  return router;
}
