-- PostgreSQL Relational Schema for Enterprise Multi-Platform Reporting System

CREATE TABLE IF NOT EXISTS platforms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  logo_url VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  enabled_modules TEXT DEFAULT '["Subscribers","Renewals","Churn","Revenue","Quiz","Reports"]',
  country VARCHAR(100),
  mongo_uri TEXT,
  database_name VARCHAR(100),
  collection_sdp VARCHAR(100),
  collection_callback VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS user_platforms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, platform_id)
);

CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  msisdn VARCHAR(30) NOT NULL,
  offer_code VARCHAR(50) NOT NULL,
  reason VARCHAR(100) DEFAULT 'Scheduled Renewal',
  lifecycle VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'NEW', 'ACTIVE', 'GRACE', 'CHURNED', 'SUSPENDED'
  next_billing_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) NOT NULL DEFAULT 'Renewed', -- 'Renewed', 'Failed', 'Pending', 'Cancelled', 'Expired'
  charging_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'GHC',
  renewal_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_subscribers_platform ON subscribers(platform_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_msisdn ON subscribers(msisdn);
CREATE INDEX IF NOT EXISTS idx_subscribers_billing_date ON subscribers(next_billing_date);

CREATE TABLE IF NOT EXISTS renewals (
  id SERIAL PRIMARY KEY,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL, -- 'Successful', 'Failed', 'Pending'
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  failure_reason VARCHAR(150),
  offer_code VARCHAR(50),
  renewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_renewals_platform ON renewals(platform_id);
CREATE INDEX IF NOT EXISTS idx_renewals_subscriber ON renewals(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_renewals_renewed_at ON renewals(renewed_at);

CREATE TABLE IF NOT EXISTS churns (
  id SERIAL PRIMARY KEY,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL, -- 'Insufficient Balance', 'User Service Denied', 'Subscription Expired', 'User Cancelled', 'System Failure', 'Other'
  offer_code VARCHAR(50),
  lifecycle VARCHAR(30),
  churned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_churns_platform ON churns(platform_id);
CREATE INDEX IF NOT EXISTS idx_churns_subscriber ON churns(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_churns_churned_at ON churns(churned_at);

CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  difficulty VARCHAR(20) DEFAULT 'Medium', -- 'Easy', 'Medium', 'Hard'
  status VARCHAR(20) DEFAULT 'Draft', -- 'Draft', 'Published', 'Archived'
  publish_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  metadata TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_platform ON audit_logs(platform_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

