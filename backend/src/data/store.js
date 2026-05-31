const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const now = () => new Date().toISOString();

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeTimestamp = (minutesAgo = 0) => {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
};

const adminId = '11111111-1111-4111-8111-111111111111';
const managerId = '22222222-2222-4222-8222-222222222222';
const developerId = '33333333-3333-4333-8333-333333333333';
const testerId = '44444444-4444-4444-8444-444444444444';

const platformTeamId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const incidentTeamId = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

const seedPasswordHash = '$2a$10$icupZt96St5lGEkLrTTRCu4swBjMSJdI7KFUZx/DWBCcMhIfU7ONy';

const users = [
  {
    id: adminId,
    email: 'admin@example.com',
    password_hash: seedPasswordHash,
    first_name: 'Anna',
    last_name: 'Admin',
    avatar_url: null,
    role: 'admin',
    status: 'active',
    phone: '+7 900 000-00-01',
    preferences: {
      digest: 'instant',
      timezone: 'Europe/Moscow'
    },
    email_notifications: true,
    push_notifications: true,
    telegram_notifications: false,
    telegram_chat_id: null,
    last_login_at: null,
    email_verified_at: makeTimestamp(60 * 24 * 30),
    created_at: makeTimestamp(60 * 24 * 14),
    updated_at: makeTimestamp(60 * 24 * 2)
  },
  {
    id: managerId,
    email: 'manager@example.com',
    password_hash: seedPasswordHash,
    first_name: 'Maksim',
    last_name: 'Manager',
    avatar_url: null,
    role: 'manager',
    status: 'active',
    phone: '+7 900 000-00-02',
    preferences: {
      digest: 'instant',
      timezone: 'Europe/Moscow'
    },
    email_notifications: true,
    push_notifications: true,
    telegram_notifications: false,
    telegram_chat_id: null,
    last_login_at: null,
    email_verified_at: makeTimestamp(60 * 24 * 25),
    created_at: makeTimestamp(60 * 24 * 12),
    updated_at: makeTimestamp(60 * 24)
  },
  {
    id: developerId,
    email: 'dev@example.com',
    password_hash: seedPasswordHash,
    first_name: 'Daria',
    last_name: 'Developer',
    avatar_url: null,
    role: 'developer',
    status: 'active',
    phone: '+7 900 000-00-03',
    preferences: {
      digest: 'instant',
      timezone: 'Europe/Moscow'
    },
    email_notifications: true,
    push_notifications: true,
    telegram_notifications: false,
    telegram_chat_id: null,
    last_login_at: null,
    email_verified_at: makeTimestamp(60 * 24 * 20),
    created_at: makeTimestamp(60 * 24 * 10),
    updated_at: makeTimestamp(60 * 12)
  },
  {
    id: testerId,
    email: 'qa@example.com',
    password_hash: seedPasswordHash,
    first_name: 'Timur',
    last_name: 'Tester',
    avatar_url: null,
    role: 'tester',
    status: 'active',
    phone: '+7 900 000-00-04',
    preferences: {
      digest: 'hourly',
      timezone: 'Europe/Moscow'
    },
    email_notifications: true,
    push_notifications: false,
    telegram_notifications: false,
    telegram_chat_id: null,
    last_login_at: null,
    email_verified_at: makeTimestamp(60 * 24 * 18),
    created_at: makeTimestamp(60 * 24 * 8),
    updated_at: makeTimestamp(60 * 6)
  }
];

const teams = [
  {
    id: platformTeamId,
    name: 'Platform',
    description: 'Backend, infrastructure and release ownership.',
    avatar_url: null,
    created_by: adminId,
    is_active: true,
    created_at: makeTimestamp(60 * 24 * 10),
    updated_at: makeTimestamp(60 * 24)
  },
  {
    id: incidentTeamId,
    name: 'Incident Response',
    description: 'Coordinates production alerts and communication.',
    avatar_url: null,
    created_by: managerId,
    is_active: true,
    created_at: makeTimestamp(60 * 24 * 7),
    updated_at: makeTimestamp(60 * 12)
  }
];

const teamMembers = [
  {
    id: uuidv4(),
    team_id: platformTeamId,
    user_id: adminId,
    role: 'owner',
    joined_at: makeTimestamp(60 * 24 * 10)
  },
  {
    id: uuidv4(),
    team_id: platformTeamId,
    user_id: developerId,
    role: 'member',
    joined_at: makeTimestamp(60 * 24 * 9)
  },
  {
    id: uuidv4(),
    team_id: incidentTeamId,
    user_id: managerId,
    role: 'owner',
    joined_at: makeTimestamp(60 * 24 * 7)
  },
  {
    id: uuidv4(),
    team_id: incidentTeamId,
    user_id: developerId,
    role: 'member',
    joined_at: makeTimestamp(60 * 24 * 6)
  },
  {
    id: uuidv4(),
    team_id: incidentTeamId,
    user_id: testerId,
    role: 'admin',
    joined_at: makeTimestamp(60 * 24 * 6)
  }
];

const notifications = [];
const notificationRecipients = [];
const pendingWebNotifications = new Map();
const pushSubscriptions = [];

const pushPendingNotification = (userId, notification) => {
  const queue = pendingWebNotifications.get(userId) || [];
  queue.unshift(clone(notification));
  pendingWebNotifications.set(userId, queue.slice(0, 50));
};

const pullPendingNotifications = (userId) => {
  const queue = pendingWebNotifications.get(userId) || [];
  pendingWebNotifications.set(userId, []);
  return clone(queue);
};

const peekPendingNotifications = (userId) => {
  return clone(pendingWebNotifications.get(userId) || []);
};

const seedNotification = ({
  id,
  title,
  message,
  type,
  priority,
  channels,
  metadata,
  createdBy,
  recipientIds,
  recipientEntryIds,
  teamId,
  createdAtOffsetMinutes
}) => {
  const notificationId = id || uuidv4();
  const createdAt = makeTimestamp(createdAtOffsetMinutes);

  notifications.push({
    id: notificationId,
    title,
    message,
    type,
    priority,
    channels: channels || ['web'],
    created_by: createdBy,
    scheduled_for: null,
    expires_at: null,
    metadata: metadata || { autoRead: true },
    is_active: true,
    created_at: createdAt,
    updated_at: createdAt
  });

  recipientIds.forEach((userId, index) => {
    notificationRecipients.push({
      id: recipientEntryIds?.[index] || uuidv4(),
      notification_id: notificationId,
      user_id: userId,
      team_id: teamId || null,
      status: index === 0 ? 'read' : 'delivered',
      read_at: index === 0 ? makeTimestamp(createdAtOffsetMinutes - 5) : null,
      delivered_at: makeTimestamp(createdAtOffsetMinutes - 1),
      failed_at: null,
      failure_reason: null,
      delivery_results: {
        web: {
          success: true,
          deliveredAt: makeTimestamp(createdAtOffsetMinutes - 1)
        }
      }
    });
  });
};

seedNotification({
  id: '90000000-0000-4000-8000-000000000001',
  title: 'Critical production incident',
  message: 'The API latency crossed 1.5s on the payments cluster. Incident room is open.',
  type: 'error',
  priority: 'critical',
  channels: ['web', 'push'],
  metadata: { autoRead: true },
  createdBy: managerId,
  recipientIds: [adminId, developerId, testerId],
  recipientEntryIds: [
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003'
  ],
  teamId: incidentTeamId,
  createdAtOffsetMinutes: 120
});

seedNotification({
  id: '90000000-0000-4000-8000-000000000002',
  title: 'Release deployed successfully',
  message: 'Version 2.8.4 has been rolled out to production. Monitoring is stable.',
  type: 'success',
  priority: 'medium',
  channels: ['web', 'email'],
  metadata: { autoRead: true },
  createdBy: adminId,
  recipientIds: [managerId, developerId],
  recipientEntryIds: [
    '91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000005'
  ],
  teamId: platformTeamId,
  createdAtOffsetMinutes: 55
});

seedNotification({
  id: '90000000-0000-4000-8000-000000000003',
  title: 'Standup reminder',
  message: 'Daily sync starts in 15 minutes. Please update blockers before joining.',
  type: 'info',
  priority: 'low',
  channels: ['web'],
  metadata: { autoRead: true },
  createdBy: testerId,
  recipientIds: [adminId, managerId, developerId, testerId],
  recipientEntryIds: [
    '91000000-0000-4000-8000-000000000006',
    '91000000-0000-4000-8000-000000000007',
    '91000000-0000-4000-8000-000000000008',
    '91000000-0000-4000-8000-000000000009'
  ],
  createdAtOffsetMinutes: 20
});

module.exports = {
  adminId,
  managerId,
  developerId,
  testerId,
  platformTeamId,
  incidentTeamId,
  users,
  teams,
  teamMembers,
  notifications,
  notificationRecipients,
  pushSubscriptions,
  clone,
  now,
  createId: uuidv4,
  pushPendingNotification,
  pullPendingNotifications,
  peekPendingNotifications
};
