const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const NotificationService = require('../services/notificationService');
const {
  setIO,
  addConnection,
  removeConnection,
  emitToTeam,
  getOnlineUserIds,
  getOnlineUserCount,
  isUserOnline
} = require('./socketState');
const logger = require('../utils/logger');

const jwtSecret = process.env.JWT_SECRET || 'notification-system-dev-secret';

const authenticateSocket = async (socket, token) => {
  const payload = jwt.verify(token, jwtSecret);
  const user = await User.findById(payload.id);

  if (!user || user.status !== 'active') {
    throw new Error('Invalid user');
  }

  socket.userId = user.id;
  socket.userEmail = user.email;
  addConnection(user.id, socket.id);

  socket.join(`user:${user.id}`);

  const userTeams = await User.getTeams(user.id);
  userTeams.forEach((team) => {
    socket.join(`team:${team.id}`);
  });

  const pendingNotifications = await NotificationService.consumeUserWebNotifications(user.id);
  pendingNotifications.forEach((notification) => {
    socket.emit('new_notification', notification);
  });

  socket.emit('authenticated', { user });
  logger.info(`User ${user.email} authenticated and connected`);
};

const socketHandler = (io, socket) => {
  setIO(io);

  const handshakeToken = socket.handshake.auth?.token;

  if (handshakeToken) {
    authenticateSocket(socket, handshakeToken).catch((error) => {
      logger.error('Socket handshake authentication error:', error);
      socket.emit('authentication_error', { message: 'Authentication failed' });
      socket.disconnect();
    });
  }

  socket.on('authenticate', async (token) => {
    try {
      await authenticateSocket(socket, token);
    } catch (error) {
      logger.error('Socket authentication error:', error);
      socket.emit('authentication_error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      removeConnection(socket.userId, socket.id);
      logger.info(`User ${socket.userEmail} disconnected`);
    }
  });

  socket.on('mark_notification_read', async (notificationId) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      await Notification.markAsRead(notificationId, socket.userId);
      const unreadCount = await Notification.getUnreadCount(socket.userId);

      io.to(`user:${socket.userId}`).emit('notification_read', {
        notificationId,
        unreadCount
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  });

  socket.on('mark_all_read', async () => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      await Notification.markAllAsRead(socket.userId);
      io.to(`user:${socket.userId}`).emit('all_marked_read', { unreadCount: 0 });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      socket.emit('error', { message: 'Failed to mark all notifications as read' });
    }
  });

  socket.on('typing_start', (data) => {
    if (!socket.userId || !data?.teamId) {
      return;
    }

    socket.to(`team:${data.teamId}`).emit('user_typing', {
      userId: socket.userId,
      userEmail: socket.userEmail,
      teamId: data.teamId
    });
  });

  socket.on('typing_stop', (data) => {
    if (!socket.userId || !data?.teamId) {
      return;
    }

    socket.to(`team:${data.teamId}`).emit('user_stop_typing', {
      userId: socket.userId,
      teamId: data.teamId
    });
  });

  socket.on('send_notification', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const notification = await Notification.create({
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        priority: data.priority || 'medium',
        channels: data.channels || ['web'],
        created_by: socket.userId,
        metadata: data.metadata || {}
      });

      if (Array.isArray(data.recipients) && data.recipients.length > 0) {
        await Notification.addRecipients(notification.id, data.recipients);
      }

      await NotificationService.sendNotification(notification.id);
      socket.emit('notification_sent', { notification });
    } catch (error) {
      logger.error('Error sending notification:', error);
      socket.emit('error', { message: 'Failed to send notification' });
    }
  });

  socket.on('get_online_users', async (data = {}) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      let onlineUsers = [];

      if (data.teamId) {
        const members = await Team.getMembers(data.teamId);
        onlineUsers = members.filter((member) => isUserOnline(member.id));
      } else {
        const allIds = getOnlineUserIds();
        const allUsers = await Promise.all(allIds.map((userId) => User.findById(userId)));
        onlineUsers = allUsers
          .filter(Boolean)
          .map((user) => ({
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url
          }));
      }

      socket.emit('online_users', {
        onlineUsers,
        total: getOnlineUserCount()
      });
    } catch (error) {
      logger.error('Error getting online users:', error);
      socket.emit('error', { message: 'Failed to get online users' });
    }
  });

  socket.on('team_broadcast', async (data) => {
    if (!socket.userId || !data?.teamId || !data?.event) {
      return;
    }

    emitToTeam(data.teamId, data.event, data.payload || {});
  });
};

module.exports = socketHandler;
