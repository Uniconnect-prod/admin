import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}

