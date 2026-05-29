import {
  Notification,
  PresenceUser,
  RolePermissions,
  Team,
  User,
} from '../types'

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord => {
  return (value && typeof value === 'object' ? value : {}) as UnknownRecord
}

const pickString = (record: UnknownRecord, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') {
      return value
    }
  }

  return ''
}

const pickNullableString = (record: UnknownRecord, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') {
      return value
    }
    if (value === null) {
      return null
    }
  }

  return null
}

const pickBoolean = (record: UnknownRecord, fallback: boolean, ...keys: string[]): boolean => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') {
      return value
    }
  }

  return fallback
}

const buildCreatorName = (record: UnknownRecord): string | undefined => {
  const directName = pickString(record, 'creatorName')
  if (directName) {
    return directName
  }

  const firstName = pickString(record, 'creator_first_name', 'firstName')
  const lastName = pickString(record, 'creator_last_name', 'lastName')
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || undefined
}

const normalizePermissions = (value: unknown): RolePermissions | undefined => {
  const record = asRecord(value)

  if (Object.keys(record).length === 0) {
    return undefined
  }

  const directoryScope = pickString(record, 'directoryScope')

  return {
    broadcastAll: pickBoolean(record, false, 'broadcastAll'),
    messageIndividuals: pickBoolean(record, false, 'messageIndividuals'),
    messageTeams: pickBoolean(record, false, 'messageTeams'),
    createNotifications: pickBoolean(record, false, 'createNotifications'),
    manageUsers: pickBoolean(record, false, 'manageUsers'),
    viewGlobalNotifications: pickBoolean(record, false, 'viewGlobalNotifications'),
    viewSystemStats: pickBoolean(record, false, 'viewSystemStats'),
    directoryScope: (directoryScope === 'all' || directoryScope === 'shared' || directoryScope === 'none'
      ? directoryScope
      : 'none') as RolePermissions['directoryScope'],
    label: pickString(record, 'label'),
  }
}

export const normalizeUser = (value: unknown): User => {
  const record = asRecord(value)

  return {
    id: pickString(record, 'id'),
    email: pickString(record, 'email'),
    firstName: pickString(record, 'firstName', 'first_name'),
    lastName: pickString(record, 'lastName', 'last_name'),
    role: pickString(record, 'role') as User['role'],
    status: pickString(record, 'status') as User['status'],
    phone: pickNullableString(record, 'phone'),
    preferences: (record.preferences as User['preferences']) || {},
    emailNotifications: pickBoolean(record, true, 'emailNotifications', 'email_notifications'),
    pushNotifications: pickBoolean(record, true, 'pushNotifications', 'push_notifications'),
    telegramNotifications: pickBoolean(record, false, 'telegramNotifications', 'telegram_notifications'),
    lastLoginAt: pickNullableString(record, 'lastLoginAt', 'last_login_at'),
    createdAt: pickString(record, 'createdAt', 'created_at'),
    permissions: normalizePermissions(record.permissions),
  }
}

export const normalizePresenceUser = (value: unknown): PresenceUser => {
  const record = asRecord(value)

  return {
    id: pickString(record, 'id'),
    email: pickString(record, 'email'),
    firstName: pickString(record, 'firstName', 'first_name'),
    lastName: pickString(record, 'lastName', 'last_name'),
  }
}

export const normalizeTeam = (value: unknown): Team => {
  const record = asRecord(value)
  const creatorFirstName = pickString(record, 'creator_first_name')
  const creatorLastName = pickString(record, 'creator_last_name')
  const creatorName = `${creatorFirstName} ${creatorLastName}`.trim() || undefined

  return {
    id: pickString(record, 'id'),
    name: pickString(record, 'name'),
    description: pickString(record, 'description'),
    createdAt: pickString(record, 'createdAt', 'created_at'),
    isActive: Boolean(record.is_active ?? record.isActive ?? true),
    creatorName,
    memberRole: pickString(record, 'member_role', 'memberRole') as Team['memberRole'],
    membersCount: typeof record.members_count === 'number'
      ? record.members_count
      : typeof record.membersCount === 'number'
        ? record.membersCount
        : undefined,
  }
}

export const normalizeNotification = (value: unknown): Notification => {
  const record = asRecord(value)

  return {
    id: pickString(record, 'id'),
    title: pickString(record, 'title'),
    message: pickString(record, 'message'),
    type: pickString(record, 'type') as Notification['type'],
    priority: pickString(record, 'priority') as Notification['priority'],
    channels: Array.isArray(record.channels) ? (record.channels as Notification['channels']) : ['web'],
    createdBy: pickString(record, 'createdBy', 'created_by'),
    createdAt: pickString(record, 'createdAt', 'created_at'),
    recipientStatus: pickString(record, 'recipientStatus', 'recipient_status') as Notification['recipientStatus'],
    readAt: pickNullableString(record, 'readAt', 'read_at'),
    deliveredAt: pickNullableString(record, 'deliveredAt', 'delivered_at'),
    creatorName: buildCreatorName(record),
    metadata: (record.metadata as Record<string, unknown>) || {},
  }
}
