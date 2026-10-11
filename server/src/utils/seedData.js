import bcrypt from 'bcryptjs';
import { db } from '../models/db.js';
import { initDatabase } from '../models/initDb.js';

export async function seedDatabase() {
  console.log('[Seed] Initializing database schema...');
  await initDatabase();

  // Check if platforms already seeded
  const existingPlatforms = await db.all('SELECT * FROM platforms');
  if (existingPlatforms && existingPlatforms.length > 0) {
    console.log(`[Seed] Database already has ${existingPlatforms.length} platforms. Skipping seed.`);
    return;
  }

  console.log('[Seed] Initializing clean system configuration and authorized administrators...');

  // 1. Roles
  const roles = [
    { id: 1, name: 'Super Admin', description: 'Access every platform, manage users, platforms, audit logs, and exports' },
    { id: 2, name: 'Platform Admin', description: 'Full access to assigned platforms, manage subscribers, content, and reports' },
    { id: 3, name: 'Author', description: 'Access assigned platform content management, quiz upload, and limited reporting' },
    { id: 4, name: 'Analyst', description: 'Reporting and analytics access, export reports, read-only system' },
    { id: 5, name: 'Viewer', description: 'Read-only dashboard and reports, no exports without permission' },
  ];

  for (const role of roles) {
    await db.run('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)', [role.id, role.name, role.description]);
  }

  // 2. Permissions
  const permissions = [
    { name: 'view:dashboard', description: 'View dashboard metrics' },
    { name: 'view:subscribers', description: 'View subscriber records' },
    { name: 'manage:subscribers', description: 'Modify subscribers' },
    { name: 'export:subscribers', description: 'Export subscriber data to CSV' },
    { name: 'view:renewals', description: 'View renewal analytics' },
    { name: 'export:renewals', description: 'Export renewal reports' },
    { name: 'view:churn', description: 'View churn analytics' },
    { name: 'export:churn', description: 'Export churn reports' },
    { name: 'view:reports', description: 'View high-level reports' },
    { name: 'export:reports', description: 'Export report data' },
    { name: 'view:platform_comparison', description: 'Compare platform metrics' },
    { name: 'manage:quizzes', description: 'Create and edit quizzes' },
    { name: 'upload:quizzes', description: 'Upload bulk quiz questions' },
    { name: 'manage:users', description: 'Create and update users' },
    { name: 'manage:platforms', description: 'Configure platforms and modules' },
    { name: 'view:audit_logs', description: 'View system audit trails' }
  ];

  for (let i = 0; i < permissions.length; i++) {
    await db.run('INSERT INTO permissions (id, name, description) VALUES (?, ?, ?)', [
      i + 1,
      permissions[i].name,
      permissions[i].description
    ]);
  }

  // Role permissions mapping
  const rolePermMap = {
    1: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], // Super Admin gets all
    2: [1,2,3,4,5,6,7,8,9,10,12,13],             // Platform Admin
    3: [1,2,9,12,13],                            // Author
    4: [1,2,4,5,6,7,8,9,10],                      // Analyst
    5: [1,2,5,7,9]                               // Viewer
  };

  for (const [roleId, permIds] of Object.entries(rolePermMap)) {
    for (const permId of permIds) {
      await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId]);
    }
  }

  // 3. Platforms
  const platforms = [
    {
      id: 1,
      name: 'ghsuperwinings',
      code: 'GHSUPERWININGS',
      logo_url: '/assets/platforms/ghsuperwinings.svg',
      description: 'SuperWinnings interactive SMS/Web trivia portal with daily cash prizes and educational challenges.',
      status: 'ACTIVE',
      enabled_modules: JSON.stringify(['Subscribers', 'Renewals', 'Churn', 'Quiz', 'Revenue', 'Reports'])
    },
    {
      id: 2,
      name: 'ghanagameium',
      code: 'GHANAGAMEIUM',
      logo_url: '/assets/platforms/ghanagameium.svg',
      description: 'GhanaGameium mobile gaming portal featuring HTML5 web games, leaderboards & tournaments.',
      status: 'ACTIVE',
      enabled_modules: JSON.stringify(['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports'])
    },
    {
      id: 3,
      name: 'crazymuzik',
      code: 'CRAZYMUZIK',
      logo_url: '/assets/platforms/crazymuzik.svg',
      description: 'CrazyMuzik streaming, caller ringback tunes (CRBT), and artist discovery portal.',
      status: 'ACTIVE',
      enabled_modules: JSON.stringify(['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports'])
    }
  ];

  for (const p of platforms) {
    await db.run(
      'INSERT INTO platforms (id, name, code, logo_url, description, status, enabled_modules) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.name, p.code, p.logo_url, p.description, p.status, p.enabled_modules]
    );
  }

  // 4. Authorized System Users (Password: "Password123!" by default)
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Password123!', salt);

  const users = [
    { id: 1, name: 'Main Admin', email: 'main_admin@enterprise.com', username: 'main_admin', status: 'ACTIVE' },
    { id: 2, name: 'Rahul Sharma', email: 'rahul@ghsnapflix.com', username: 'ghsnapflix_rahul', status: 'ACTIVE' }
  ];

  for (const u of users) {
    await db.run(
      'INSERT INTO users (id, name, email, username, password_hash, status, last_login_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [u.id, u.name, u.email, u.username, defaultPasswordHash, u.status]
    );
  }

  // 5. Date-Wise Platform Access (No demo accounts)
  const now = new Date();
  const formatIso = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
  const plusDays = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return formatIso(d);
  };
  const minusDays = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return formatIso(d);
  };

  // main_admin (Super Admin across all 3 platforms)
  for (let platId = 1; platId <= 3; platId++) {
    await db.run(
      `INSERT INTO platform_access (user_id, platform_id, role_id, start_date, end_date, status, created_by)
       VALUES (1, ?, 1, ?, ?, 'ACTIVE', 1)`,
      [platId, minusDays(30), plusDays(730)]
    );
    await db.run(
      'INSERT INTO user_platforms (user_id, platform_id, role_id) VALUES (1, ?, 1)',
      [platId]
    );
  }

  // ghsnapflix_rahul (Platform Admin on ghsuperwinings)
  await db.run(
    `INSERT INTO platform_access (user_id, platform_id, role_id, start_date, end_date, status, created_by)
     VALUES (2, 1, 2, ?, ?, 'ACTIVE', 1)`,
    [minusDays(30), plusDays(365)]
  );
  await db.run(
    'INSERT INTO user_platforms (user_id, platform_id, role_id) VALUES (2, 1, 2)'
  );

  console.log('✅ [Seed] Clean enterprise configuration initialized with authorized administrators.');
}

// Allow direct execution: node src/utils/seedData.js
if (process.argv[1]?.endsWith('seedData.js')) {
  seedDatabase()
    .then(() => {
      console.log('Seed process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during seeding:', err);
      process.exit(1);
    });
}
