import { col, COLLECTIONS } from '../store/index.js';

const ALLOWLIST_ID = 'outbound_allowlist';

/**
 * Administrator-managed list of approved outbound API hosts (in addition to the
 * OUTBOUND_ALLOWED_HOSTS environment variable).
 */
export const settingsRepository = {
  async getOutboundAllowlist() {
    const doc = await col(COLLECTIONS.settings).findOne({ _id: ALLOWLIST_ID });
    return Array.isArray(doc?.hosts) ? doc.hosts : [];
  },

  async setOutboundAllowlist(hosts, userId) {
    await col(COLLECTIONS.settings).updateOne(
      { _id: ALLOWLIST_ID },
      { $set: { hosts, updated_by: userId, updated_at: new Date() } },
      { upsert: true }
    );
    return hosts;
  }
};
