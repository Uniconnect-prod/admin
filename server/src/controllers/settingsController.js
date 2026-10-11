import bcrypt from 'bcryptjs';
import { db } from '../models/db.js';
import { logAudit } from '../middleware/auditLogger.js';

export const settingsController = {
  async getSettings(req, res) {
    try {
      const user = await db.get(
        'SELECT id, name, email, username, status, created_at, last_login_at FROM users WHERE id = ?',
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        data: {
          profile: user,
          preferences: {
            theme: 'light',
            emailNotifications: true,
            renewalAlerts: true,
            churnWarningThreshold: 10,
            defaultExportFormat: 'csv',
            autoRefreshInterval: 60
          }
        }
      });
    } catch (err) {
      console.error('[SettingsController] getSettings error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve settings.' });
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Name and email are required.' });
      }

      await db.run('UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        name.trim(),
        email.trim(),
        req.user.id
      ]);

      await logAudit(req, 'UPDATE_PROFILE', 'User', req.user.id, { name, email });

      return res.status(200).json({ success: true, message: 'Profile updated successfully.' });
    } catch (err) {
      console.error('[SettingsController] updateProfile error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
  },

  async updateSecurity(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
      }

      const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);
      await logAudit(req, 'CHANGE_PASSWORD', 'User', req.user.id);

      return res.status(200).json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
      console.error('[SettingsController] updateSecurity error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update security settings.' });
    }
  }
};

