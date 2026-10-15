import { col, COLLECTIONS, nextSequence } from '../store/index.js';

function access() {
  return col(COLLECTIONS.access);
}

export const roleRepository = {
  async list() {
    return col(COLLECTIONS.roles).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  },
  async findById(id) {
    return col(COLLECTIONS.roles).findOne({ id: parseInt(id, 10) }, { projection: { _id: 0 } });
  }
};

/**
 * Date-windowed platform authorisations (user × platform × role × [start, end]).
 */
export const accessRepository = {
  async listForUser(userId) {
    return access().find({ user_id: parseInt(userId, 10) }).toArray();
  },

  async listAll() {
    return access().find({}).toArray();
  },

  async findForUserAndPlatform(userId, platformId) {
    return access().findOne({ user_id: parseInt(userId, 10), platform_id: parseInt(platformId, 10) });
  },

  /**
   * Replace a user's assignments with the supplied list (validated by the caller).
   */
  async replaceForUser(userId, assignments, createdBy) {
    const uid = parseInt(userId, 10);
    await access().deleteMany({ user_id: uid });
    const now = new Date();
    for (const a of assignments) {
      await access().insertOne({
        id: await nextSequence(COLLECTIONS.access),
        user_id: uid,
        platform_id: parseInt(a.platform_id, 10),
        role_id: parseInt(a.role_id, 10),
        start_date: new Date(a.start_date).toISOString(),
        end_date: new Date(a.end_date).toISOString(),
        status: a.status === 'REVOKED' ? 'REVOKED' : 'ACTIVE',
        created_by: createdBy,
        created_at: now,
        updated_at: now
      });
    }
  },

  async grant({ userId, platformId, roleId, startDate, endDate, createdBy }) {
    const now = new Date();
    await access().updateOne(
      { user_id: parseInt(userId, 10), platform_id: parseInt(platformId, 10) },
      {
        $set: {
          role_id: roleId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'ACTIVE',
          updated_at: now
        },
        $setOnInsert: { id: await nextSequence(COLLECTIONS.access), created_by: createdBy, created_at: now }
      },
      { upsert: true }
    );
  },

  async revokeAllForUser(userId) {
    await access().updateMany({ user_id: parseInt(userId, 10) }, { $set: { status: 'REVOKED', updated_at: new Date() } });
  }
};
