CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'manager', 'developer', 'tester')),
  status VARCHAR(32) NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
  phone VARCHAR(64),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  telegram_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_chat_id VARCHAR(255),
  last_login_at TIMESTAMP,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  avatar_url VARCHAR(500),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
  priority VARCHAR(32) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  channels JSONB NOT NULL DEFAULT '["web"]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'delivered', 'read', 'failed')),
  delivery_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_channels (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('email', 'telegram', 'slack', 'push', 'webhook')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO users (
  id,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  status,
  phone,
  preferences,
  email_notifications,
  push_notifications,
  telegram_notifications,
  email_verified_at,
  created_at,
  updated_at
) VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'admin@example.com',
    '$2a$10$icupZt96St5lGEkLrTTRCu4swBjMSJdI7KFUZx/DWBCcMhIfU7ONy',
    'Anna',
    'Admin',
    'admin',
    'active',
    '+7 900 000-00-01',
    '{"digest":"instant","timezone":"Europe/Moscow"}'::jsonb,
    TRUE,
    TRUE,
    FALSE,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'manager@example.com',
    '$2a$10$icupZt96St5lGEkLrTTRCu4swBjMSJdI7KFUZx/DWBCcMhIfU7ONy',
    'Maksim',
    'Manager',
    'manager',
    'active',
    '+7 900 000-00-02',
    '{"digest":"instant","timezone":"Europe/Moscow"}'::jsonb,
    TRUE,
    TRUE,
    FALSE,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'dev@example.com',
    '$2a$10$icupZt96St5lGEkLrTTRCu4swBjMSJdI7KFUZx/DWBCcMhIfU7ONy',
    'Daria',
    'Developer',
    'developer',
    'active',
    '+7 900 000-00-03',
    '{"digest":"instant","timezone":"Europe/Moscow"}'::jsonb,
    TRUE,
    TRUE,
    FALSE,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '12 hours'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'qa@example.com',
    '$2a$10$icupZt96St5lGEkLrTTRCu4swBjMSJdI7KFUZx/DWBCcMhIfU7ONy',
    'Timur',
    'Tester',
    'tester',
    'active',
    '+7 900 000-00-04',
    '{"digest":"hourly","timezone":"Europe/Moscow"}'::jsonb,
    TRUE,
    FALSE,
    FALSE,
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '6 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  phone = EXCLUDED.phone,
  preferences = EXCLUDED.preferences,
  email_notifications = EXCLUDED.email_notifications,
  push_notifications = EXCLUDED.push_notifications,
  telegram_notifications = EXCLUDED.telegram_notifications,
  updated_at = EXCLUDED.updated_at;

INSERT INTO teams (
  id,
  name,
  description,
  created_by,
  is_active,
  created_at,
  updated_at
) VALUES
  (
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'Platform',
    'Backend, infrastructure and release ownership.',
    '11111111-1111-4111-8111-111111111111',
    TRUE,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'Incident Response',
    'Coordinates production alerts and communication.',
    '22222222-2222-4222-8222-222222222222',
    TRUE,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '12 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  created_by = EXCLUDED.created_by,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;

INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner', NOW() - INTERVAL '10 days'),
  ('10000000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'member', NOW() - INTERVAL '9 days'),
  ('10000000-0000-4000-8000-000000000003', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'owner', NOW() - INTERVAL '7 days'),
  ('10000000-0000-4000-8000-000000000004', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'member', NOW() - INTERVAL '6 days'),
  ('10000000-0000-4000-8000-000000000005', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'admin', NOW() - INTERVAL '6 days')
ON CONFLICT (team_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  joined_at = EXCLUDED.joined_at;

INSERT INTO notifications (
  id,
  title,
  message,
  type,
  priority,
  channels,
  created_by,
  metadata,
  is_active,
  created_at,
  updated_at
) VALUES
  (
    '90000000-0000-4000-8000-000000000001',
    'Critical production incident',
    'The API latency crossed 1.5s on the payments cluster. Incident room is open.',
    'error',
    'critical',
    '["web","push"]'::jsonb,
    '22222222-2222-4222-8222-222222222222',
    '{"autoRead":true}'::jsonb,
    TRUE,
    NOW() - INTERVAL '120 minutes',
    NOW() - INTERVAL '120 minutes'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    'Release deployed successfully',
    'Version 2.8.4 has been rolled out to production. Monitoring is stable.',
    'success',
    'medium',
    '["web","email"]'::jsonb,
    '11111111-1111-4111-8111-111111111111',
    '{"autoRead":true}'::jsonb,
    TRUE,
    NOW() - INTERVAL '55 minutes',
    NOW() - INTERVAL '55 minutes'
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    'Standup reminder',
    'Daily sync starts in 15 minutes. Please update blockers before joining.',
    'info',
    'low',
    '["web"]'::jsonb,
    '44444444-4444-4444-8444-444444444444',
    '{"autoRead":true}'::jsonb,
    TRUE,
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  message = EXCLUDED.message,
  type = EXCLUDED.type,
  priority = EXCLUDED.priority,
  channels = EXCLUDED.channels,
  created_by = EXCLUDED.created_by,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;

INSERT INTO notification_recipients (
  id,
  notification_id,
  user_id,
  team_id,
  status,
  delivery_results,
  read_at,
  delivered_at,
  created_at,
  updated_at
) VALUES
  (
    '91000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'read',
    '{"web":{"success":true},"push":{"success":true,"mode":"browser-native"}}'::jsonb,
    NOW() - INTERVAL '125 minutes',
    NOW() - INTERVAL '121 minutes',
    NOW() - INTERVAL '120 minutes',
    NOW() - INTERVAL '120 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'delivered',
    '{"web":{"success":true},"push":{"success":true,"mode":"browser-native"}}'::jsonb,
    NULL,
    NOW() - INTERVAL '121 minutes',
    NOW() - INTERVAL '120 minutes',
    NOW() - INTERVAL '120 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    '90000000-0000-4000-8000-000000000001',
    '44444444-4444-4444-8444-444444444444',
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'delivered',
    '{"web":{"success":true}}'::jsonb,
    NULL,
    NOW() - INTERVAL '121 minutes',
    NOW() - INTERVAL '120 minutes',
    NOW() - INTERVAL '120 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000004',
    '90000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'delivered',
    '{"web":{"success":true},"email":{"success":true,"mode":"simulated"}}'::jsonb,
    NULL,
    NOW() - INTERVAL '56 minutes',
    NOW() - INTERVAL '55 minutes',
    NOW() - INTERVAL '55 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000005',
    '90000000-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'delivered',
    '{"web":{"success":true},"email":{"success":true,"mode":"simulated"}}'::jsonb,
    NULL,
    NOW() - INTERVAL '56 minutes',
    NOW() - INTERVAL '55 minutes',
    NOW() - INTERVAL '55 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000006',
    '90000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    NULL,
    'read',
    '{"web":{"success":true}}'::jsonb,
    NOW() - INTERVAL '18 minutes',
    NOW() - INTERVAL '19 minutes',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000007',
    '90000000-0000-4000-8000-000000000003',
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'delivered',
    '{"web":{"success":true}}'::jsonb,
    NULL,
    NOW() - INTERVAL '19 minutes',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000008',
    '90000000-0000-4000-8000-000000000003',
    '33333333-3333-4333-8333-333333333333',
    NULL,
    'delivered',
    '{"web":{"success":true}}'::jsonb,
    NULL,
    NOW() - INTERVAL '19 minutes',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000009',
    '90000000-0000-4000-8000-000000000003',
    '44444444-4444-4444-8444-444444444444',
    NULL,
    'delivered',
    '{"web":{"success":true}}'::jsonb,
    NULL,
    NOW() - INTERVAL '19 minutes',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  )
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  delivery_results = EXCLUDED.delivery_results,
  read_at = EXCLUDED.read_at,
  delivered_at = EXCLUDED.delivered_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO delivery_channels (
  id,
  name,
  type,
  config,
  enabled,
  created_by,
  created_at,
  updated_at
) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'Primary Email', 'email', '{}'::jsonb, TRUE, '11111111-1111-4111-8111-111111111111', NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day'),
  ('d1000000-0000-4000-8000-000000000002', 'Slack Alerts', 'slack', '{"workspace":"it-team"}'::jsonb, TRUE, '11111111-1111-4111-8111-111111111111', NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day'),
  ('d1000000-0000-4000-8000-000000000003', 'Browser Push', 'push', '{"provider":"native-browser"}'::jsonb, TRUE, '11111111-1111-4111-8111-111111111111', NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  updated_at = EXCLUDED.updated_at;
