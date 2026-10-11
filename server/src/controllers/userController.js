import bcrypt from 'bcryptjs';
import { db } from '../models/db.js';
import { logAudit } from '../middleware/auditLogger.js';
import { determineAccessStatus, formatAccessRecord } from '../utils/platformAccessHelper.js';

export const userController = {
  async getAllUsers(req, res) {
    try {
      const users = await db.all(
        `SELECT id, name, email, username, status, last_login_at, created_at 
         FROM users WHERE deleted_at IS NULL ORDER BY id ASC`
      );

      // Fetch all platform_access records
      const allAccess = await db.all(
        `SELECT pa.id, pa.user_id, pa.platform_id, p.name as platform_name, p.code as platform_code,
                pa.role_id, r.name as role_name, pa.start_date, pa.end_date, pa.status
         FROM platform_access pa
         JOIN platforms p ON pa.platform_id = p.id
         JOIN roles r ON pa.role_id = r.id`
      );

      const now = new Date();
      const usersWithPlatforms = users.map(user => {
        const userAccess = allAccess.filter(pa => pa.user_id === user.id);
        const formattedPlatforms = userAccess.map(rec => formatAccessRecord(rec, now));
        const activePlatforms = formattedPlatforms.filter(p => p.isCurrentlyActive);
        const roles = [...new Set(userAccess.map(p => p.role_name))];

        return {
          ...user,
          roles,
          primaryRole: roles[0] || 'Viewer',
          platforms: formattedPlatforms,
          activePlatformsCount: activePlatforms.length
        };
      });

      return res.status(200).json({ success: true, data: usersWithPlatforms });
    } catch (err) {
      console.error('[UserController] getAllUsers error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await db.get(
        `SELECT id, name, email, username, status, last_login_at, created_at 
         FROM users WHERE id = ? AND deleted_at IS NULL`,
        [id]
      );

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const accessRecords = await db.all(
        `SELECT pa.id, pa.user_id, pa.platform_id, p.name as platform_name, p.code as platform_code,
                pa.role_id, r.name as role_name, pa.start_date, pa.end_date, pa.status
         FROM platform_access pa
         JOIN platforms p ON pa.platform_id = p.id
         JOIN roles r ON pa.role_id = r.id
         WHERE pa.user_id = ?`,
        [id]
      );

      const now = new Date();
      const formatted = accessRecords.map(rec => formatAccessRecord(rec, now));

      return res.status(200).json({
        success: true,
        data: {
          ...user,
          platforms: formatted
        }
      });
    } catch (err) {
      console.error('[UserController] getUserById error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve user details.' });
    }
  },

  async createUser(req, res) {
    try {
      const { name, email, username, password, status, platform_assignments } = req.body;

      if (!name || !email || !username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full Name, Email, Username, and Password are required.'
        });
      }

      // Check for duplicate email or username
      const existing = await db.get(
        'SELECT id FROM users WHERE (LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)) AND deleted_at IS NULL',
        [email.trim(), username.trim()]
      );

      if (existing) {
        return res.status(409).json({ success: false, message: 'User with this email or username already exists.' });
      }

      // Date Range Validation for each platform assignment
      if (Array.isArray(platform_assignments) && platform_assignments.length > 0) {
        for (const assign of platform_assignments) {
          if (assign.platform_id) {
            if (!assign.start_date || !assign.end_date) {
              return res.status(400).json({
                success: false,
                message: 'Every assigned platform must have a valid Start Date and End Date.'
              });
            }
            const sTime = new Date(assign.start_date).getTime();
            const eTime = new Date(assign.end_date).getTime();
            if (isNaN(sTime) || isNaN(eTime)) {
              return res.status(400).json({
                success: false,
                message: 'Invalid date format provided for platform access dates.'
              });
            }
            if (sTime > eTime) {
              return res.status(400).json({
                success: false,
                message: `Validation Error: Start Date (${assign.start_date}) must not be after End Date (${assign.end_date}).`
              });
            }
          }
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const userResult = await db.run(
        `INSERT INTO users (name, email, username, password_hash, status)
         VALUES (?, ?, ?, ?, ?)`,
        [name.trim(), email.trim(), username.trim(), passwordHash, status || 'ACTIVE']
      );

      const newUserId = userResult.lastID;

      // Assign date-wise platform access
      if (Array.isArray(platform_assignments) && platform_assignments.length > 0) {
        for (const assign of platform_assignments) {
          if (assign.platform_id && assign.role_id) {
            const startDate = assign.start_date || new Date().toISOString().replace('T', ' ').slice(0, 19);
            const endDate = assign.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
            const assignStatus = assign.status || 'ACTIVE';

            // Insert into platform_access table
            await db.run(
              `INSERT INTO platform_access (user_id, platform_id, role_id, start_date, end_date, status, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [newUserId, assign.platform_id, assign.role_id, startDate, endDate, assignStatus, req.user?.id || 1]
            );

            // Also mirror in legacy user_platforms for backward compatibility
            await db.run(
              `INSERT OR REPLACE INTO user_platforms (user_id, platform_id, role_id) VALUES (?, ?, ?)`,
              [newUserId, assign.platform_id, assign.role_id]
            );
          }
        }
      }

      await logAudit(req, 'CREATE_USER', 'User', newUserId, { name, email, username });

      return res.status(201).json({
        success: true,
        message: 'User created successfully with platform authorizations.',
        data: { id: newUserId, name, email, username }
      });
    } catch (err) {
      console.error('[UserController] createUser error:', err);
      return res.status(500).json({ success: false, message: 'Failed to create user.' });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, username, status, platform_assignments } = req.body;

      const user = await db.get('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // Validate date ranges if platform_assignments provided
      if (Array.isArray(platform_assignments)) {
        for (const assign of platform_assignments) {
          if (assign.platform_id && assign.start_date && assign.end_date) {
            const sTime = new Date(assign.start_date).getTime();
            const eTime = new Date(assign.end_date).getTime();
            if (sTime > eTime) {
              return res.status(400).json({
                success: false,
                message: `Validation Error: Start Date (${assign.start_date}) must not be after End Date (${assign.end_date}).`
              });
            }
          }
        }
      }

      await db.run(
        `UPDATE users 
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             username = COALESCE(?, username),
             status = COALESCE(?, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, email, username, status, id]
      );

      // If platform assignments updated
      if (Array.isArray(platform_assignments)) {
        // Clear existing access records for this user
        await db.run('DELETE FROM platform_access WHERE user_id = ?', [id]);
        await db.run('DELETE FROM user_platforms WHERE user_id = ?', [id]);

        for (const assign of platform_assignments) {
          if (assign.platform_id && assign.role_id) {
            const startDate = assign.start_date || new Date().toISOString().replace('T', ' ').slice(0, 19);
            const endDate = assign.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
            const assignStatus = assign.status || 'ACTIVE';

            await db.run(
              `INSERT INTO platform_access (user_id, platform_id, role_id, start_date, end_date, status, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, assign.platform_id, assign.role_id, startDate, endDate, assignStatus, req.user?.id || 1]
            );

            await db.run(
              `INSERT OR REPLACE INTO user_platforms (user_id, platform_id, role_id) VALUES (?, ?, ?)`,
              [id, assign.platform_id, assign.role_id]
            );
          }
        }
      }

      await logAudit(req, 'UPDATE_USER', 'User', id, { name, email, status });

      return res.status(200).json({ success: true, message: 'User and platform authorizations updated successfully.' });
    } catch (err) {
      console.error('[UserController] updateUser error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update user.' });
    }
  },

  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, id]);
      await logAudit(req, 'RESET_PASSWORD', 'User', id);

      return res.status(200).json({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
      console.error('[UserController] resetPassword error:', err);
      return res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own active account.' });
      }

      await db.run('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, status = "DELETED" WHERE id = ?', [id]);
      await logAudit(req, 'DELETE_USER', 'User', id);

      return res.status(200).json({ success: true, message: 'User removed successfully.' });
    } catch (err) {
      console.error('[UserController] deleteUser error:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete user.' });
    }
  },

  async getRoles(req, res) {
    try {
      const roles = await db.all('SELECT * FROM roles ORDER BY id ASC');
      return res.status(200).json({ success: true, data: roles });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to fetch roles.' });
    }
  }
};

