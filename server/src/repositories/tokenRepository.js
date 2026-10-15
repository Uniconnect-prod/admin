import { col, COLLECTIONS } from '../store/index.js';

/**
 * Refresh-token registry used for rotation and reuse detection.
 * Only the token id (jti) is stored, never the signed token itself.
 */
export const tokenRepository = {
  async register({ jti, userId, expiresAt, familyId }) {
    await col(COLLECTIONS.refreshTokens).insertOne({
      jti,
      user_id: userId,
      family_id: familyId,
      expires_at: expiresAt,
      revoked_at: null,
      replaced_by: null,
      created_at: new Date()
    });
  },

  async find(jti) {
    return col(COLLECTIONS.refreshTokens).findOne({ jti });
  },

  async markRotated(jti, replacedBy) {
    const res = await col(COLLECTIONS.refreshTokens).updateOne(
      { jti, revoked_at: null },
      { $set: { revoked_at: new Date(), replaced_by: replacedBy } }
    );
    return res.modifiedCount === 1;
  },

  async revokeFamily(familyId) {
    await col(COLLECTIONS.refreshTokens).updateMany({ family_id: familyId, revoked_at: null }, { $set: { revoked_at: new Date() } });
  },

  async revokeAllForUser(userId) {
    await col(COLLECTIONS.refreshTokens).updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: new Date() } });
  }
};
