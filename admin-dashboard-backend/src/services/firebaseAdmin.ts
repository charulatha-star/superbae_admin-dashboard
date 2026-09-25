// src/services/firebaseAdmin.ts
import fs from 'fs';
import path from 'path';
import * as firebaseAdmin from 'firebase-admin';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

/**
 * Firebase Admin SDK bootstrap — Step 3 foundation ONLY.
 *
 * Design rules:
 *  - The service-account credential NEVER enters this source file, the .env
 *    private key or any log/API response. Only its filesystem path is
 *    configured via FIREBASE_SERVICE_ACCOUNT_PATH (see backend .env).
 *  - The path is resolved relative to the backend project root (dist/services
 *    -> two levels up), never hardcoded to an absolute Windows path.
 *  - Initialization is lazy and happens exactly once, guarded by both a local
 *    cache and the Firebase Admin SDK's own app list (no duplicate apps).
 *  - Errors are descriptive but never include credential contents — only the
 *    configured path and the names of missing structural fields.
 *  - NO sending happens here. Future notification services obtain access via
 *    getFirebaseAdminApp() / getFirebaseMessaging().
 */

const FIREBASE_APP_NAME = 'superbae-admin';

export const FIREBASE_SERVICE_ACCOUNT_ENV_VAR = 'FIREBASE_SERVICE_ACCOUNT_PATH';

export class FirebaseConfigError extends Error {
  statusCode = 500;
}

interface ServiceAccountFileShape {
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
}

/**
 * Backend project root, stable regardless of the process working directory:
 * this module is compiled to dist/services/firebaseAdmin.js, so two levels
 * up is always admin-dashboard-backend/.
 */
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Resolves the configured service-account path relative to the backend root.
 * Absolute paths are honoured (path.resolve passes them through unchanged);
 * relative paths must stay inside the backend project.
 */
export function resolveFirebaseCredentialPath(): string {
  const configured = process.env[FIREBASE_SERVICE_ACCOUNT_ENV_VAR];
  if (!configured || !configured.trim()) {
    throw new FirebaseConfigError(
      `${FIREBASE_SERVICE_ACCOUNT_ENV_VAR} is not set. Add e.g. ${FIREBASE_SERVICE_ACCOUNT_ENV_VAR}=./secrets/firebase-service-account.json to the backend .env file.`
    );
  }
  if (configured.includes('..')) {
    throw new FirebaseConfigError(
      `${FIREBASE_SERVICE_ACCOUNT_ENV_VAR} must stay inside the backend project directory (no '..' segments).`
    );
  }
  return path.resolve(BACKEND_ROOT, configured);
}

/**
 * Reads and structurally validates the service-account JSON.
 * Never returns or logs any credential value — only validates presence of
 * the three required fields.
 */
export function loadServiceAccountCredential(filePath: string): firebaseAdmin.ServiceAccount {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    throw new FirebaseConfigError(
      `Firebase service-account file is missing or unreadable at ${filePath}. ` +
        `Check ${FIREBASE_SERVICE_ACCOUNT_ENV_VAR} and make sure the credential file exists (it is git-ignored and must never be committed).`
    );
  }

  let parsed: ServiceAccountFileShape;
  try {
    parsed = JSON.parse(raw) as ServiceAccountFileShape;
  } catch {
    throw new FirebaseConfigError(`Firebase service-account file at ${filePath} is not valid JSON.`);
  }

  const missing = (['project_id', 'client_email', 'private_key'] as const).filter((field) => {
    const value = parsed[field];
    return typeof value !== 'string' || value.trim() === '';
  });
  if (missing.length > 0) {
    throw new FirebaseConfigError(
      `Firebase service-account file at ${filePath} is missing required field(s): ${missing.join(', ')}.`
    );
  }

  return parsed as unknown as firebaseAdmin.ServiceAccount;
}

let cachedApp: firebaseAdmin.App | null = null;
let cachedProjectId = '';

/**
 * Returns the initialized Firebase Admin app, initializing it on first use.
 * Duplicate initialization is impossible: the local cache short-circuits, and
 * the Firebase Admin SDK app list is consulted before initializeApp, so
 * re-entering this function (e.g. after a test reset) reuses the existing
 * named app instead of registering a second one.
 */
export function getFirebaseAdminApp(): firebaseAdmin.App {
  if (cachedApp) return cachedApp;

  const existing = firebaseAdmin.getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existing) {
    cachedApp = existing;
    return cachedApp;
  }

  const credentialPath = resolveFirebaseCredentialPath();
  const serviceAccount = loadServiceAccountCredential(credentialPath);

  try {
    cachedApp = firebaseAdmin.initializeApp(
      { credential: firebaseAdmin.cert(serviceAccount) },
      FIREBASE_APP_NAME
    );
  } catch (error) {
    cachedApp = null;
    const message = error instanceof Error ? error.message : 'unknown error';
    // Rethrow without the raw error payload to avoid leaking credential material.
    throw new FirebaseConfigError(`Failed to initialize Firebase Admin: ${message.split('\n')[0]}`);
  }

  return cachedApp;
}

/** Messaging access for FUTURE notification services. No sending in this step. */
export function getFirebaseMessaging(): Messaging {
  return getMessaging(getFirebaseAdminApp());
}

/** Non-secret identifier of the configured Firebase project (for diagnostics/tests). */
export function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;

  const fromOptions = getFirebaseAdminApp().options.projectId;
  if (typeof fromOptions === 'string' && fromOptions) {
    cachedProjectId = fromOptions;
    return cachedProjectId;
  }

  // v14 does not populate options.projectId at initializeApp time; derive it
  // from the credential file itself (project_id is an identifier, not a secret).
  // The raw service-account JSON uses snake_case keys (which is exactly what
  // cert()/ServiceAccountCredential expects — it normalizes them internally).
  const raw = loadServiceAccountCredential(resolveFirebaseCredentialPath()) as unknown as { project_id?: unknown };
  cachedProjectId = typeof raw.project_id === 'string' ? raw.project_id : '';
  return cachedProjectId;
}

/** Test-only: clears the local cache so the app-list reuse path can be verified. */
export function resetFirebaseAdminCacheForTests(): void {
  cachedApp = null;
}
