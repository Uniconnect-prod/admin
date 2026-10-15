import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { tokenRepository } from '../repositories/tokenRepository.js';
import { logAudit } from '../middleware/auditLogger.js';
import { badRequest, conflict } from '../utils/errors.js';
import { MIN_PASSWORD_LENGTH } from './userController.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const settingsController = {
  async getSettings(req, res) {
    const user = await userRepository.findById(req.user.id);
    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          status: user.status,
          created_at: user.created_at || null,
          last_login_at: user.last_login_at || null
        },
        access: req.user.isSuperAdmin
          ? [{ platform: 'All platforms', role: 'Super Admin' }]
          : req.user.access.map(a => ({
              platform: a.platform.name,
              code: a.platform.code,
              role: a.role_name,
              status: a.status,
              start_date: a.start_date,
              end_date: a.end_date,
              isExpiringSoon: a.isExpiringSoon
            })),
        passwordPolicy: { minLength: MIN_PASSWORD_LENGTH }
      }
    });
  },

  async updateProfile(req, res) {
    const { name, email } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) throw badRequest('Full name is required (2–100 characters).');
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw badRequest('A valid email address is required.');
    if (await userRepository.existsWithEmailOrUsername(email.trim(), req.user.username, req.user.id)) throw conflict('Another account already uses this email.');
    await userRepository.update(req.user.id, { name: name.trim(), email: email.trim().toLowerCase() });
    await logAudit(req, 'UPDATE_PROFILE', 'User', req.user.id, { fields: ['name', 'email'] }, { platformId: null });
    res.json({ success: true, message: 'Profile updated.' });
  },

  async updateSecurity(req, res) {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') throw badRequest('Current and new password are required.');
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw badRequest(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    const user = await userRepository.findById(req.user.id, { includePassword: true });
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) throw badRequest('Current password is incorrect.', undefined, 'INVALID_CURRENT_PASSWORD');
    await userRepository.setPasswordHash(req.user.id, await bcrypt.hash(newPassword, 12));
    await tokenRepository.revokeAllForUser(req.user.id);
    await logAudit(req, 'CHANGE_PASSWORD', 'User', req.user.id, {}, { platformId: null });
    res.json({ success: true, message: 'Password changed. Please sign in again on your other devices.' });
  }
};
