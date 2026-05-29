import { FormEvent, startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  BellRing,
  BookOpen,
  CheckCheck,
  Loader,
  LogOut,
  Search,
  Send,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import apiService, { ApiError } from '../services/api'
import notificationService, { BrowserNotificationPermission } from '../services/notificationService'
import {
  CreateNotificationData,
  Notification,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  PresenceUser,
  RolePermissions,
  Team,
  User,
  UserRole,
} from '../types'

type AudienceMode = 'all' | 'team' | 'person'
type FeedFilter = 'all' | 'critical' | 'push'
type SocketStatus = 'connecting' | 'online' | 'offline'

const channelOptions: Array<{
  key: NotificationChannel
  label: string
}> = [
  { key: 'web', label: 'Web' },
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'slack', label: 'Slack' },
  { key: 'telegram', label: 'Telegram' },
]

const typeOptions: NotificationType[] = ['info', 'warning', 'error', 'success']
const priorityOptions: NotificationPriority[] = ['low', 'medium', 'high', 'critical']

const defaultPermissionsByRole: Record<UserRole, RolePermissions> = {
  admin: {
    broadcastAll: true,
    messageIndividuals: true,
    messageTeams: true,
    createNotifications: true,
    manageUsers: true,
    viewGlobalNotifications: true,
    viewSystemStats: true,
    directoryScope: 'all',
    label: 'Administrator',
  },
  manager: {
    broadcastAll: false,
    messageIndividuals: true,
    messageTeams: true,
    createNotifications: true,
    manageUsers: false,
    viewGlobalNotifications: true,
    viewSystemStats: true,
    directoryScope: 'shared',
    label: 'Manager',
  },
  developer: {
    broadcastAll: false,
    messageIndividuals: false,
    messageTeams: true,
    createNotifications: true,
    manageUsers: false,
    viewGlobalNotifications: false,
    viewSystemStats: false,
    directoryScope: 'none',
    label: 'Developer',
  },
  tester: {
    broadcastAll: false,
    messageIndividuals: false,
    messageTeams: false,
    createNotifications: false,
    manageUsers: false,
    viewGlobalNotifications: false,
    viewSystemStats: false,
    directoryScope: 'none',
    label: 'Tester',
  },
}

const roleMeta: Record<UserRole, { title: string; summary: string }> = {
  admin: {
    title: 'Администратор',
    summary: 'Глобальная рассылка, полный каталог пользователей и управление доступом.',
  },
  manager: {
    title: 'Менеджер',
    summary: 'Рассылки по своим командам и прямые сообщения только людям из общего контура.',
  },
  developer: {
    title: 'Разработчик',
    summary: 'Отправка уведомлений только в команды, где вы состоите.',
  },
  tester: {
    title: 'Тестировщик',
    summary: 'Получение и автоматическое подтверждение уведомлений без прав на рассылку.',
  },
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const getTypeLabel = (type: NotificationType) => {
  switch (type) {
    case 'error':
      return 'Инцидент'
    case 'warning':
      return 'Внимание'
    case 'success':
      return 'Успешно'
    default:
      return 'Информация'
  }
}

const getPriorityClass = (priority: NotificationPriority) => {
  switch (priority) {
    case 'critical':
      return 'border-rose-400/50 bg-rose-500/[0.12] text-rose-100'
    case 'high':
      return 'border-orange-400/50 bg-orange-500/[0.12] text-orange-100'
    case 'medium':
      return 'border-sky-400/50 bg-sky-500/[0.12] text-sky-100'
    default:
      return 'border-emerald-400/50 bg-emerald-500/[0.12] text-emerald-100'
  }
}

const getPushBadge = (permission: BrowserNotificationPermission) => {
  switch (permission) {
    case 'granted':
      return { value: 'ON', label: 'Браузерные push разрешены' }
    case 'denied':
      return { value: 'OFF', label: 'Браузерные push запрещены' }
    case 'unsupported':
      return { value: 'N/A', label: 'Браузер не поддерживает push' }
    default:
      return { value: 'ASK', label: 'Нужно разрешение браузера' }
  }
}

const DashboardPage = () => {
  const { user, logout } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [composerMessage, setComposerMessage] = useState('')
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting')
  const [browserPushPermission, setBrowserPushPermission] = useState<BrowserNotificationPermission>('default')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all')
  const [audienceId, setAudienceId] = useState('')
  const [draft, setDraft] = useState({
    title: '',
    message: '',
    type: 'warning' as NotificationType,
    priority: 'high' as NotificationPriority,
    scheduledFor: '',
    channels: {
      web: true,
      push: true,
      email: false,
      slack: false,
      telegram: false,
    } as Record<NotificationChannel, boolean>,
  })

  const permissions = user ? user.permissions || defaultPermissionsByRole[user.role] : null
  const canCreateNotifications = Boolean(permissions?.createNotifications)
  const canBroadcastToAll = Boolean(permissions?.broadcastAll)
  const canTargetIndividuals = Boolean(permissions?.messageIndividuals) && users.length > 0
  const canTargetTeams = Boolean(permissions?.messageTeams) && teams.length > 0
  const hasAudienceOptions = canBroadcastToAll || canTargetTeams || canTargetIndividuals
  const visibleDirectoryCount = permissions?.directoryScope === 'none' ? '—' : `${users.length}`
  const autoReadCount = notifications.filter((notification) => Boolean(notification.readAt)).length
  const criticalCount = notifications.filter((notification) => notification.priority === 'critical').length
  const pushCount = notifications.filter((notification) => notification.channels.includes('push')).length
  const pushBadge = getPushBadge(browserPushPermission)
  const apiDocsUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')}/api-docs`

  useEffect(() => {
    if (!user) {
      return
    }

    const loadDashboard = async () => {
      setPageLoading(true)
      setPageError('')

      const [notificationsResult, teamsResult, usersResult] = await Promise.allSettled([
        notificationService.getMyNotifications(),
        notificationService.getTeams(),
        notificationService.getUsers(),
      ])

      if (notificationsResult.status === 'fulfilled') {
        setNotifications(notificationsResult.value.notifications)
      } else {
        setPageError('Не удалось загрузить персональную ленту уведомлений.')
      }

      if (teamsResult.status === 'fulfilled') {
        setTeams(teamsResult.value)
      } else {
        setTeams([])
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value.filter((entry) => entry.id !== user.id))
      } else if (!(usersResult.reason instanceof ApiError && usersResult.reason.status === 403)) {
        setUsers([])
      }

      setPageLoading(false)
    }

    loadDashboard()
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }

    let active = true

    const syncBrowserPermission = async () => {
      const permission = await notificationService.ensureBrowserNotificationPermission(Boolean(user.pushNotifications))
      if (active) {
        setBrowserPushPermission(permission)
      }
    }

    syncBrowserPermission()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }

    const token = apiService.getStoredToken()
    if (!token) {
      return
    }

    const handleConnected = () => setSocketStatus('connecting')
    const handleAuthenticated = () => {
      setSocketStatus('online')
      notificationService.requestOnlineUsers()
    }
    const handleDisconnected = () => setSocketStatus('offline')
    const handleSocketError = () => setSocketStatus('offline')
    const handleOnlineUsers = (payload: { onlineUsers: PresenceUser[] }) => setOnlineUsers(payload.onlineUsers)
    const handleNewNotification = (incoming: Notification) => {
      startTransition(() => {
        setNotifications((current) => [incoming, ...current.filter((item) => item.id !== incoming.id)])
      })

      if (incoming.channels.includes('push')) {
        notificationService.showBrowserNotification(incoming)
      }
    }

    notificationService.connect(token)
    notificationService.on('socket_connected', handleConnected)
    notificationService.on('authenticated', handleAuthenticated)
    notificationService.on('socket_disconnected', handleDisconnected)
    notificationService.on('socket_error', handleSocketError)
    notificationService.on('online_users', handleOnlineUsers)
    notificationService.on('new_notification', handleNewNotification)

    return () => {
      notificationService.off('socket_connected', handleConnected)
      notificationService.off('authenticated', handleAuthenticated)
      notificationService.off('socket_disconnected', handleDisconnected)
      notificationService.off('socket_error', handleSocketError)
      notificationService.off('online_users', handleOnlineUsers)
      notificationService.off('new_notification', handleNewNotification)
      notificationService.disconnect()
    }
  }, [user])

  useEffect(() => {
    if (!permissions) {
      return
    }

    if (!canBroadcastToAll && audienceMode === 'all') {
      setAudienceMode(canTargetTeams ? 'team' : 'person')
      return
    }

    if (audienceMode === 'all') {
      setAudienceId('')
      return
    }

    if (audienceMode === 'team') {
      if (!canTargetTeams && canTargetIndividuals) {
        setAudienceMode('person')
        return
      }

      if (teams.length > 0 && !teams.some((team) => team.id === audienceId)) {
        setAudienceId(teams[0].id)
      }
    }

    if (audienceMode === 'person') {
      if (!canTargetIndividuals && canTargetTeams) {
        setAudienceMode('team')
        return
      }

      if (users.length > 0 && !users.some((entry) => entry.id === audienceId)) {
        setAudienceId(users[0].id)
      }
    }
  }, [audienceId, audienceMode, canBroadcastToAll, canTargetIndividuals, canTargetTeams, permissions, teams, users])

  const filteredNotifications = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()

    return notifications.filter((notification) => {
      if (feedFilter === 'critical' && notification.priority !== 'critical') {
        return false
      }

      if (feedFilter === 'push' && !notification.channels.includes('push')) {
        return false
      }

      if (!term) {
        return true
      }

      return [notification.title, notification.message, notification.creatorName || '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [deferredSearch, feedFilter, notifications])

  const handleLogout = async () => {
    await logout()
  }

  const handleEnablePush = async () => {
    const permission = await notificationService.ensureBrowserNotificationPermission(true)
    setBrowserPushPermission(permission)
  }

  const getTeamAccessLabel = (team: Team) => {
    if (team.memberRole) {
      return team.memberRole
    }

    if (permissions?.directoryScope === 'all') {
      return 'catalog'
    }

    if (permissions?.directoryScope === 'shared') {
      return 'shared'
    }

    return 'team'
  }

  const handleDraftChange = <K extends keyof typeof draft>(field: K, value: typeof draft[K]) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const toggleChannel = (channel: NotificationChannel) => {
    setDraft((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel]: !current.channels[channel],
      },
    }))
  }

  const handleCreateNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setComposerMessage('')

    if (!canCreateNotifications) {
      setComposerMessage('Эта роль может получать уведомления, но не отправлять их.')
      return
    }

    const title = draft.title.trim()
    const message = draft.message.trim()

    if (!title || !message) {
      setComposerMessage('Заполните заголовок и текст уведомления.')
      return
    }

    const activeChannels = channelOptions
      .filter((channel) => draft.channels[channel.key])
      .map((channel) => channel.key)

    if (activeChannels.length === 0) {
      setComposerMessage('Выберите хотя бы один канал доставки.')
      return
    }

    let recipients: CreateNotificationData['recipients']

    if (audienceMode === 'all') {
      recipients = 'all'
    } else if (!audienceId) {
      setComposerMessage('Выберите команду или конкретного получателя.')
      return
    } else if (audienceMode === 'team') {
      recipients = [{ teamId: audienceId }]
    } else {
      recipients = [{ userId: audienceId }]
    }

    setSubmitLoading(true)

    try {
      await notificationService.createNotification({
        title,
        message,
        type: draft.type,
        priority: draft.priority,
        channels: activeChannels,
        recipients,
        scheduledFor: draft.scheduledFor ? new Date(draft.scheduledFor).toISOString() : undefined,
        metadata: {
          autoRead: true,
        },
      })

      const refreshedFeed = await notificationService.getMyNotifications()
      setNotifications(refreshedFeed.notifications)
      setComposerMessage('Уведомление отправлено. Для получателей оно помечается прочитанным автоматически.')
      setDraft({
        title: '',
        message: '',
        type: 'warning',
        priority: 'high',
        scheduledFor: '',
        channels: {
          web: true,
          push: true,
          email: false,
          slack: false,
          telegram: false,
        },
      })
    } catch (error) {
      setComposerMessage(error instanceof Error ? error.message : 'Не удалось отправить уведомление.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (!user || !permissions || pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,_#06131d_0%,_#102434_55%,_#18384a_100%)] text-slate-100">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm">
          <Loader className="h-4 w-4 animate-spin" />
          Загружаем рабочий контур команды...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.16),_transparent_36%),linear-gradient(160deg,_#06131d_0%,_#102434_55%,_#18384a_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="panel flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-amber-200">
              Система уведомлений для IT-команды
            </p>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                Рабочий центр уведомлений, {user.firstName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Push в браузере, роли с разными правами, Swagger для API и лента, где сообщения не требуют ручной кнопки
                подтверждения.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <span className="font-semibold text-white">{roleMeta[user.role].title}</span>
              <span className="mx-2 text-slate-500">/</span>
              <span className={socketStatus === 'online' ? 'text-emerald-300' : 'text-amber-200'}>
                {socketStatus === 'online' ? 'realtime активен' : 'realtime переподключается'}
              </span>
            </div>
            <a className="btn-secondary" href={apiDocsUrl} target="_blank" rel="noreferrer">
              <BookOpen className="h-4 w-4" />
              Swagger API
            </a>
            <button className="btn-secondary" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        </header>

        {pageError && (
          <div className="rounded-[1.6rem] border border-rose-400/[0.35] bg-rose-500/[0.12] px-5 py-4 text-sm text-rose-100">
            {pageError}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-icon bg-amber-400/15 text-amber-200">
              <BellRing className="h-5 w-5" />
            </div>
            <p className="metric-value">{notifications.length}</p>
            <p className="metric-label">Уведомлений в персональной ленте</p>
          </div>

          <div className="metric-card">
            <div className="metric-icon bg-emerald-400/15 text-emerald-200">
              <CheckCheck className="h-5 w-5" />
            </div>
            <p className="metric-value">{autoReadCount}</p>
            <p className="metric-label">Помечено прочитанным автоматически</p>
          </div>

          <div className="metric-card">
            <div className="metric-icon bg-rose-400/15 text-rose-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <p className="metric-value">{criticalCount}</p>
            <p className="metric-label">Критичных уведомлений в истории</p>
          </div>

          <div className="metric-card">
            <div className="metric-icon bg-sky-400/15 text-sky-200">
              <Zap className="h-5 w-5" />
            </div>
            <p className="metric-value">{pushBadge.value}</p>
            <p className="metric-label">{pushBadge.label}</p>
          </div>
        </section>

        <main className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr,0.9fr]">
          <section className="panel space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Composer
              </p>
              <h2 className="section-title">Новое уведомление</h2>
              <p className="text-sm leading-6 text-slate-300">
                {roleMeta[user.role].summary}
              </p>
            </div>

            {canCreateNotifications ? (
              hasAudienceOptions ? (
              <form onSubmit={handleCreateNotification} className="space-y-4">
                <div className="space-y-2">
                  <label className="label-text" htmlFor="draft-title">
                    Заголовок
                  </label>
                  <input
                    id="draft-title"
                    className="field"
                    value={draft.title}
                    onChange={(event) => handleDraftChange('title', event.target.value)}
                    placeholder="Например: Production incident"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="label-text" htmlFor="draft-message">
                    Сообщение
                  </label>
                  <textarea
                    id="draft-message"
                    className="textarea-field"
                    value={draft.message}
                    onChange={(event) => handleDraftChange('message', event.target.value)}
                    placeholder="Что произошло и что должна сделать команда."
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="label-text" htmlFor="draft-type">
                      Тип
                    </label>
                    <select
                      id="draft-type"
                      className="select-field"
                      value={draft.type}
                      onChange={(event) => handleDraftChange('type', event.target.value as NotificationType)}
                    >
                      {typeOptions.map((type) => (
                        <option key={type} value={type}>
                          {getTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="label-text" htmlFor="draft-priority">
                      Приоритет
                    </label>
                    <select
                      id="draft-priority"
                      className="select-field"
                      value={draft.priority}
                      onChange={(event) => handleDraftChange('priority', event.target.value as NotificationPriority)}
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-text">Аудитория</label>
                  <div className="flex flex-wrap gap-2">
                    {canBroadcastToAll && (
                      <button
                        type="button"
                        className={audienceMode === 'all' ? 'pill pill-active' : 'pill'}
                        onClick={() => setAudienceMode('all')}
                      >
                        Всем
                      </button>
                    )}
                    {canTargetTeams && (
                      <button
                        type="button"
                        className={audienceMode === 'team' ? 'pill pill-active' : 'pill'}
                        onClick={() => setAudienceMode('team')}
                      >
                        Команде
                      </button>
                    )}
                    {canTargetIndividuals && (
                      <button
                        type="button"
                        className={audienceMode === 'person' ? 'pill pill-active' : 'pill'}
                        onClick={() => setAudienceMode('person')}
                      >
                        Человеку
                      </button>
                    )}
                  </div>
                </div>

                {audienceMode === 'team' && (
                  <div className="space-y-2">
                    <label className="label-text" htmlFor="audience-team">
                      Команда
                    </label>
                    <select
                      id="audience-team"
                      className="select-field"
                      value={audienceId}
                      onChange={(event) => setAudienceId(event.target.value)}
                    >
                      <option value="">Выберите команду</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {audienceMode === 'person' && (
                  <div className="space-y-2">
                    <label className="label-text" htmlFor="audience-user">
                      Получатель
                    </label>
                    <select
                      id="audience-user"
                      className="select-field"
                      value={audienceId}
                      onChange={(event) => setAudienceId(event.target.value)}
                    >
                      <option value="">Выберите человека</option>
                      {users.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.firstName} {entry.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="label-text">Каналы доставки</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {channelOptions.map((channel) => (
                      <button
                        key={channel.key}
                        type="button"
                        className={draft.channels[channel.key] ? 'pill pill-active justify-center' : 'pill justify-center'}
                        onClick={() => toggleChannel(channel.key)}
                      >
                        {channel.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-text" htmlFor="draft-scheduled">
                    Запланировать на время
                  </label>
                  <input
                    id="draft-scheduled"
                    type="datetime-local"
                    className="field"
                    value={draft.scheduledFor}
                    onChange={(event) => handleDraftChange('scheduledFor', event.target.value)}
                  />
                </div>

                {composerMessage && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    {composerMessage}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full" disabled={submitLoading}>
                  {submitLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{submitLoading ? 'Отправляем...' : 'Отправить уведомление'}</span>
                </button>
              </form>
              ) : (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
                  У этой роли пока нет доступной аудитории для рассылки. Добавьте пользователя в команду или откройте доступ через администратора.
                </div>
              )
            ) : (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
                Эта роль работает только с входящими уведомлениями. Сообщения читаются автоматически, отдельная кнопка подтверждения больше не нужна.
              </div>
            )}
          </section>

          <section className="panel space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Live Feed
                </p>
                <h2 className="section-title">Персональная лента</h2>
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Push-сообщений: {pushCount}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="field pl-11"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Поиск по заголовку, тексту или автору"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Все' },
                  { value: 'critical', label: 'Критичные' },
                  { value: 'push', label: 'Push' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={feedFilter === filter.value ? 'pill pill-active' : 'pill'}
                    onClick={() => setFeedFilter(filter.value as FeedFilter)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-sm text-slate-300">
                  По текущему фильтру уведомлений не найдено.
                </div>
              ) : (
                filteredNotifications.map((notification, index) => (
                  <motion.article
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="rounded-[1.8rem] border border-white/10 bg-slate-950/25 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityClass(notification.priority)}`}>
                              {notification.priority}
                            </span>
                            <span className="pill text-slate-200">{getTypeLabel(notification.type)}</span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.35] bg-emerald-300/[0.12] px-3 py-1 text-xs font-semibold text-emerald-100">
                              <Activity className="h-3.5 w-3.5" />
                              {notification.readAt ? 'Прочитано автоматически' : 'Новое'}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-lg font-bold text-white">{notification.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">{notification.message}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                        <span>{formatDate(notification.createdAt)}</span>
                        {notification.creatorName && <span>{notification.creatorName}</span>}
                        <span>{notification.channels.join(', ')}</span>
                      </div>
                    </div>
                  </motion.article>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="panel space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Role Access
                </p>
                <h2 className="section-title">{roleMeta[user.role].title}</h2>
              </div>

              <p className="text-sm leading-6 text-slate-300">{roleMeta[user.role].summary}</p>

              <div className="flex flex-wrap gap-2">
                {permissions.broadcastAll && <span className="pill pill-active">Глобальная рассылка</span>}
                {permissions.messageTeams && <span className="pill">Команды</span>}
                {permissions.messageIndividuals && <span className="pill">Личные сообщения</span>}
                {permissions.manageUsers && <span className="pill">Управление ролями</span>}
                <span className="pill">
                  Каталог: {permissions.directoryScope === 'all' ? 'все' : permissions.directoryScope === 'shared' ? 'общие команды' : 'скрыт'}
                </span>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                Видимых пользователей: <span className="font-semibold text-white">{visibleDirectoryCount}</span>
              </div>

              {user.pushNotifications && browserPushPermission !== 'granted' && (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                  <p>
                    Для нативных push браузеру нужно отдельное разрешение. Если доступ уже запрещен, включите уведомления в настройках страницы и повторите проверку.
                  </p>
                  <button type="button" className="btn-secondary mt-4 w-full" onClick={handleEnablePush}>
                    Включить push в браузере
                  </button>
                </div>
              )}
            </section>

            <section className="panel space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Presence
                </p>
                <h2 className="section-title">Кто в сети</h2>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <span className={socketStatus === 'online' ? 'text-emerald-300' : 'text-amber-200'}>
                  {socketStatus === 'online' ? 'Realtime подключен' : 'Realtime переподключается'}
                </span>
              </div>

              <div className="space-y-3">
                {onlineUsers.length === 0 ? (
                  <p className="text-sm text-slate-300">Пока нет активных пользователей в сети.</p>
                ) : (
                  onlineUsers.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-slate-950/25 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {entry.firstName} {entry.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{entry.email}</p>
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Teams
                </p>
                <h2 className="section-title">Ваши команды</h2>
              </div>

              <div className="space-y-3">
                {teams.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    Вы пока не добавлены ни в одну команду.
                  </p>
                ) : (
                  teams.map((team) => (
                    <div key={team.id} className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{team.name}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{team.description}</p>
                        </div>
                        <span className="pill text-slate-200">{getTeamAccessLabel(team)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                        <Users className="h-3.5 w-3.5" />
                        <span>{team.membersCount ?? '—'} участников</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  )
}

export default DashboardPage
