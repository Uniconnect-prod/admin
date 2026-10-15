import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Refresh tokens carry a unique jti and a family id so rotation and reuse
 * detection can be enforced server-side.
 */
export function generateRefreshToken({ userId, familyId = crypto.randomUUID() }) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ userId, fam: familyId }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
    jwtid: jti
  });
  const decoded = jwt.decode(token);
  return { token, jti, familyId, expiresAt: new Date(decoded.exp * 1000) };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}
