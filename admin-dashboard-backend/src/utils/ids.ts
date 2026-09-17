import crypto from 'crypto';

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}
