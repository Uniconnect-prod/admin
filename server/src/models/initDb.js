import { db } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  if (db.dialect === 'postgres') {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.exec(schemaSql);
    console.log('[DB] PostgreSQL schema applied successfully');
    return;
  }

  // SQLite Schema DDL
  const sqliteSchema = `
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'ACTIVE',
      enabled_modules TEXT DEFAULT '["Subscribers","Renewals","Churn","Revenue","Quiz","Reports"]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS user_platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, platform_id)
    );

    CREATE TABLE IF NOT EXISTS platform_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_platform_access_user ON platform_access(user_id);
    CREATE INDEX IF NOT EXISTS idx_platform_access_platform ON platform_access(platform_id);
    CREATE INDEX IF NOT EXISTS idx_platform_access_dates ON platform_access(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_platform_access_status ON platform_access(status);


    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      msisdn TEXT NOT NULL,
      offer_code TEXT NOT NULL,
      reason TEXT DEFAULT 'Scheduled Renewal',
      lifecycle TEXT NOT NULL DEFAULT 'ACTIVE',
      next_billing_date DATETIME,
      status TEXT NOT NULL DEFAULT 'Renewed',
      charging_amount REAL NOT NULL DEFAULT 0.00,
      currency TEXT DEFAULT 'GHC',
      renewal_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_subscribers_platform ON subscribers(platform_id);
    CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
    CREATE INDEX IF NOT EXISTS idx_subscribers_msisdn ON subscribers(msisdn);
    CREATE INDEX IF NOT EXISTS idx_subscribers_billing_date ON subscribers(next_billing_date);

    CREATE TABLE IF NOT EXISTS renewals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0.00,
      failure_reason TEXT,
      offer_code TEXT,
      renewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_renewals_platform ON renewals(platform_id);
    CREATE INDEX IF NOT EXISTS idx_renewals_subscriber ON renewals(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_renewals_renewed_at ON renewals(renewed_at);

    CREATE TABLE IF NOT EXISTS churns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      offer_code TEXT,
      lifecycle TEXT,
      churned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_churns_platform ON churns(platform_id);
    CREATE INDEX IF NOT EXISTS idx_churns_subscriber ON churns(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_churns_churned_at ON churns(churned_at);

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Draft',
      publish_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_platform ON audit_logs(platform_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
  `;

  await db.exec(sqliteSchema);
  console.log('[DB] SQLite tables and indexes initialized');
}

