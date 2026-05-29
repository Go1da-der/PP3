import { io, Socket } from 'socket.io-client'
import apiService from './api'
import {
  CreateNotificationData,
  Notification,
  NotificationFeed,
  OnlineUsersPayload,
  Team,
  User,
} from '../types'
import {
  normalizeNotification,
  normalizePresenceUser,
  normalizeTeam,
  normalizeUser,
} from './normalizers'

type NotificationEventMap = {
  socket_connected: undefined
  socket_disconnected: undefined
  authenticated: { user: User }
  authentication_error: { message: string }
  new_notification: Notification
  notification_read: { notificationId: string; unreadCount: number }
  all_marked_read: { unreadCount: number }
  online_users: OnlineUsersPayload
  socket_error: { message: string }
}

type NotificationEvent = keyof NotificationEventMap
type NotificationListener<K extends NotificationEvent> = (payload: NotificationEventMap[K]) => void
export type BrowserNotificationPermission = NotificationPermission | 'unsupported'

class NotificationService {
  private socket: Socket | null = null
  private listeners = new Map<NotificationEvent, Set<Function>>()
  private lastToken: string | null = null

  connect(token: string): void {
    if (this.socket && this.lastToken === token) {
      if (!this.socket.connected) {
        this.socket.connect()
      }
      return
    }

    this.disconnect()
    this.lastToken = token

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      this.emit('socket_connected', undefined)
    })

    this.socket.on('disconnect', () => {
      this.emit('socket_disconnected', undefined)
    })

    this.socket.on('authenticated', (data: { user: unknown }) => {
      this.emit('authenticated', {
        user: normalizeUser(data.user),
      })
    })

    this.socket.on('authentication_error', (payload: { message: string }) => {
      this.emit('authentication_error', payload)
    })

    this.socket.on('new_notification', (payload: unknown) => {
      this.emit('new_notification', normalizeNotification(payload))
    })

    this.socket.on('notification_read', (payload: { notificationId: string; unreadCount: number }) => {
      this.emit('notification_read', payload)
    })

    this.socket.on('all_marked_read', (payload: { unreadCount: number }) => {
      this.emit('all_marked_read', payload)
    })

    this.socket.on('online_users', (payload: { onlineUsers: unknown[]; total: number }) => {
      this.emit('online_users', {
        onlineUsers: payload.onlineUsers.map(normalizePresenceUser),
        total: payload.total,
      })
    })

    this.socket.on('error', (payload: { message: string }) => {
      this.emit('socket_error', payload)
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  on<K extends NotificationEvent>(event: K, callback: NotificationListener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)?.add(callback)
  }

  off<K extends NotificationEvent>(event: K, callback: NotificationListener<K>): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit<K extends NotificationEvent>(event: K, payload: NotificationEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => {
      ;(listener as NotificationListener<K>)(payload)
    })
  }

  requestOnlineUsers(teamId?: string): void {
    this.socket?.emit('get_online_users', teamId ? { teamId } : {})
  }

  getBrowserNotificationPermission(): BrowserNotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }

    return window.Notification.permission
  }

  async ensureBrowserNotificationPermission(enabled: boolean): Promise<BrowserNotificationPermission> {
    const currentPermission = this.getBrowserNotificationPermission()

    if (!enabled || currentPermission === 'unsupported' || currentPermission === 'granted' || currentPermission === 'denied') {
      return currentPermission
    }

    return window.Notification.requestPermission()
  }

  showBrowserNotification(notification: Notification): void {
    if (this.getBrowserNotificationPermission() !== 'granted') {
      return
    }

    const instance = new window.Notification(notification.title, {
      body: notification.message,
      tag: notification.id,
      requireInteraction: notification.priority === 'critical',
    })

    instance.onclick = () => {
      window.focus()
      instance.close()
    }
  }

  async getMyNotifications(params?: {
    unreadOnly?: boolean
    type?: Notification['type']
  }): Promise<NotificationFeed> {
    const payload = await apiService.get<{
      notifications: unknown[]
      unreadCount: number
    }>('/notifications/me', {
      params: {
        unread_only: params?.unreadOnly,
        type: params?.type,
      },
    })

    return {
      notifications: payload.notifications.map(normalizeNotification),
      unreadCount: payload.unreadCount ?? 0,
    }
  }

  async getUsers(): Promise<User[]> {
    const payload = await apiService.get<{ users: unknown[] }>('/users')
    return payload.users.map(normalizeUser)
  }

  async getTeams(): Promise<Team[]> {
    const payload = await apiService.get<{ teams: unknown[] }>('/teams')
    return payload.teams.map(normalizeTeam)
  }

  async createNotification(data: CreateNotificationData): Promise<Notification> {
    const payload = await apiService.post<{ notification: unknown }>('/notifications', data)
    return normalizeNotification(payload.notification)
  }
}

export const notificationService = new NotificationService()
export default notificationService
