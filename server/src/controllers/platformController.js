import { db } from '../models/db.js';
import { logAudit } from '../middleware/auditLogger.js';

export const platformController = {
  // Public showcase for login hero automated carousel
  async getPublicShowcase(req, res) {
    try {
      const showcasePlatforms = [
        {
          code: 'GHSUPERWININGS',
          name: 'ghsuperwinings',
          tagline: 'Daily Trivia, Brain Battles & Instant MoMo Cash Prizes',
          description: 'Interactive SMS and web trivia challenges covering sports, general knowledge, pop culture, and science with real-time cash payouts.',
          bgImage: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=1200&q=80',
          badge: 'Trivia & Rewards',
          accentColor: '#00E676',
          stats: [
            { label: 'Quiz Masters', value: '78K+' },
            { label: 'Daily Winners', value: '1,200+' },
            { label: 'Win Rate', value: '34.2%' }
          ]
        },
        {
          code: 'GHANAGAMEIUM',
          name: 'ghanagameium',
          tagline: 'Ultimate Cloud & Mobile HTML5 Gaming Arena',
          description: 'Compete in daily tournament leaderboards, high-stakes arcade battles, action racing, and multi-player tournaments with instant MoMo rewards.',
          bgImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
          badge: 'Cloud Gaming',
          accentColor: '#00E5FF',
          stats: [
            { label: 'Daily Gamers', value: '142K+' },
            { label: 'Instant Games', value: '380+ Games' },
            { label: 'Prize Pool Paid', value: 'GHC 240K' }
          ]
        },
        {
          code: 'CRAZYMUZIK',
          name: 'crazymuzik',
          tagline: 'Afrobeats, Highlife & Live Gospel Streaming Hub',
          description: 'Unlimited high-fidelity streaming, offline downloads, curated DJ playlists, and artist monetization for West Africa\'s finest talent.',
          bgImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
          badge: 'Music & Audio',
          accentColor: '#FF6B00',
          stats: [
            { label: 'Subscribers', value: '115K+' },
            { label: 'Audio Tracks', value: '250K+ Songs' },
            { label: 'Live Radio', value: '24/7 Airtime' }
          ]
        }
      ];

      return res.status(200).json({
        success: true,
        data: showcasePlatforms
      });
    } catch (err) {
      console.error('[PlatformController] getPublicShowcase error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load showcase data.' });
    }
  },
  async getAllPlatforms(req, res) {
    try {
      let platforms;
      if (req.user.isSuperAdmin) {
        platforms = await db.all('SELECT * FROM platforms ORDER BY id ASC');
      } else {
        const platformIds = req.user.platforms.map(p => p.platform_id);
        if (platformIds.length === 0) {
          return res.status(200).json({ success: true, data: [] });
        }
        const placeholders = platformIds.map(() => '?').join(',');
        platforms = await db.all(
          `SELECT * FROM platforms WHERE id IN (${placeholders}) AND status = 'ACTIVE' ORDER BY id ASC`,
          platformIds
        );
      }

      const formatted = platforms.map(p => {
        let modules = [];
        try { modules = JSON.parse(p.enabled_modules || '[]'); } catch { modules = []; }
        return { ...p, enabled_modules: modules };
      });

      return res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      console.error('[PlatformController] getAllPlatforms error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve platforms.' });
    }
  },

  async getPlatformById(req, res) {
    try {
      const { id } = req.params;
      const platform = await db.get('SELECT * FROM platforms WHERE id = ? OR UPPER(code) = UPPER(?)', [id, id]);
      if (!platform) {
        return res.status(404).json({ success: false, message: 'Platform not found.' });
      }

      // If not Super Admin, check if user has access
      if (!req.user.isSuperAdmin) {
        const hasAccess = req.user.platforms.some(p => p.platform_id === platform.id);
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: 'Access denied to this platform.' });
        }
      }

      let modules = [];
      try { modules = JSON.parse(platform.enabled_modules || '[]'); } catch { modules = []; }

      return res.status(200).json({
        success: true,
        data: { ...platform, enabled_modules: modules }
      });
    } catch (err) {
      console.error('[PlatformController] getPlatformById error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve platform details.' });
    }
  },

  async createPlatform(req, res) {
    try {
      const { name, code, logo_url, description, enabled_modules, country, mongo_uri, database_name, collection_sdp, collection_callback } = req.body;
      if (!name || !code) {
        return res.status(400).json({ success: false, message: 'Name and unique code are required.' });
      }

      const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
      const modulesJson = JSON.stringify(
        enabled_modules || ['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports']
      );

      const result = await db.run(
        `INSERT INTO platforms (name, code, logo_url, description, status, enabled_modules, country, mongo_uri, database_name, collection_sdp, collection_callback)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)`,
        [name.trim(), cleanCode, logo_url || '/assets/platforms/default.svg', description || '', modulesJson, country || '', mongo_uri || '', database_name || '', collection_sdp || '', collection_callback || '']
      );

      const newPlatformId = result.lastID;

      // Automatically assign Super Admin access to new platform
      await db.run(
        `INSERT OR IGNORE INTO user_platforms (user_id, platform_id, role_id) VALUES (?, ?, 1)`,
        [req.user.id, newPlatformId]
      );

      await logAudit(req, 'CREATE_PLATFORM', 'Platform', newPlatformId, { name, code: cleanCode });

      return res.status(201).json({
        success: true,
        message: 'Platform created successfully.',
        data: { id: newPlatformId, name, code: cleanCode, enabled_modules }
      });
    } catch (err) {
      console.error('[PlatformController] createPlatform error:', err);
      return res.status(500).json({ success: false, message: 'Failed to create platform. Code may already exist.' });
    }
  },

  async updatePlatform(req, res) {
    try {
      const { id } = req.params;
      const { name, logo_url, description, status, enabled_modules, country, mongo_uri, database_name, collection_sdp, collection_callback } = req.body;

      const existing = await db.get('SELECT * FROM platforms WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Platform not found.' });
      }

      const modulesJson = enabled_modules ? JSON.stringify(enabled_modules) : existing.enabled_modules;

      await db.run(
        `UPDATE platforms 
         SET name = COALESCE(?, name),
             logo_url = COALESCE(?, logo_url),
             description = COALESCE(?, description),
             status = COALESCE(?, status),
             enabled_modules = ?,
             country = COALESCE(?, country),
             mongo_uri = COALESCE(?, mongo_uri),
             database_name = COALESCE(?, database_name),
             collection_sdp = COALESCE(?, collection_sdp),
             collection_callback = COALESCE(?, collection_callback),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, logo_url, description, status, modulesJson, country, mongo_uri, database_name, collection_sdp, collection_callback, id]
      );

      await logAudit(req, 'UPDATE_PLATFORM', 'Platform', id, { name, status, enabled_modules });

      return res.status(200).json({ success: true, message: 'Platform updated successfully.' });
    } catch (err) {
      console.error('[PlatformController] updatePlatform error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update platform.' });
    }
  },

  async deletePlatform(req, res) {
    try {
      const { id } = req.params;
      await db.run("UPDATE platforms SET status = 'INACTIVE' WHERE id = ?", [id]);
      await logAudit(req, 'DEACTIVATE_PLATFORM', 'Platform', id);
      return res.status(200).json({ success: true, message: 'Platform deactivated successfully.' });
    } catch (err) {
      console.error('[PlatformController] deletePlatform error:', err);
      return res.status(500).json({ success: false, message: 'Failed to deactivate platform.' });
    }
  }
};

