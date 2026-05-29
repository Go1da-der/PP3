export type UserRole = 'admin' | 'manager' | 'developer' | 'tester'
export type UserStatus = 'active' | 'inactive' | 'suspended'
export type NotificationType = 'info' | 'warning' | 'error' | 'success'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
export type NotificationChannel = 'web' | 'email' | 'telegram' | 'slack' | 'push'
export type RecipientStatus = 'pending' | 'delivered' | 'read' | 'failed'
export type TeamRole = 'owner' | 'admin' | 'member'
export type DirectoryScope = 'all' | 'shared' | 'none'

export interface RolePermissions {
  broadcastAll: boolean
  messageIndividuals: boolean
  messageTeams: boolean
  createNotifications: boolean
  manageUsers: boolean
  viewGlobalNotifications: boolean
  viewSystemStats: boolean
  directoryScope: DirectoryScope
  label: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  status: UserStatus
  phone?: string | null
  preferences?: {
    digest?: string
    timezone?: string
  }
  emailNotifications?: boolean
  pushNotifications?: boolean
  telegramNotifications?: boolean
  lastLoginAt?: string | null
  createdAt?: string
  permissions?: RolePermissions
}

export interface PresenceUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface Team {
  id: string
  name: string
  description: string
  createdAt: string
  isActive: boolean
  creatorName?: string
  memberRole?: TeamRole
  membersCount?: number
}

export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  priority: NotificationPriority
  channels: NotificationChannel[]
  createdBy: string
  createdAt: string
  recipientStatus: RecipientStatus
  readAt: string | null
  deliveredAt: string | null
  creatorName?: string
  metadata: Record<string, unknown>
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

export interface RecipientSelection {
  userId?: string
  teamId?: string
}

export interface CreateNotificationData {
  title: string
  message: string
  type: NotificationType
  priority: NotificationPriority
  channels: NotificationChannel[]
  recipients: RecipientSelection[] | 'all'
  scheduledFor?: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

export interface NotificationFeed {
  notifications: Notification[]
  unreadCount: number
}

export interface OnlineUsersPayload {
  onlineUsers: PresenceUser[]
  total: number
}
