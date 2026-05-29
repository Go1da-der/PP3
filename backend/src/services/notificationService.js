const Notification = require('../models/Notification');
const User = require('../models/User');
const {
  pushPendingNotification,
  pullPendingNotifications,
  peekPendingNotifications
} = require('../data/store');
const {
  emitToUser,
  isUserOnline
} = require('../socket/socketState');
const logger = require('../utils/logger');

const scheduledJobs = new Map();

const mapLiveNotification = (notification, options = {}) => ({
  id: notification.id,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  priority: notification.priority,
  channels: notification.channels,
  metadata: notification.metadata,
  created_at: notification.created_at,
  created_by: notification.created_by,
  creator_first_name: notification.creator_first_name || null,
  creator_last_name: notification.creator_last_name || null,
  creator_email: notification.creator_email || null,
  recipient_status: options.status || 'delivered',
  read_at: options.readAt || null,
  delivered_at: options.deliveredAt || notification.created_at
});

class NotificationService {
  static shouldAutoRead(notification) {
    return notification.metadata?.autoRead !== false;
  }

  static async deliverRealtimeNotification(notification, user, options = {}) {
    const deliveredAt = new Date().toISOString();
    const readAt = options.autoRead ? deliveredAt : null;
    const livePayload = mapLiveNotification(notification, {
      status: options.autoRead ? 'read' : 'delivered',
      deliveredAt,
      readAt
    });

    const wasDeliveredLive = emitToUser(user.id, 'new_notification', livePayload);

    if (!wasDeliveredLive || !isUserOnline(user.id)) {
      pushPendingNotification(user.id, livePayload);
    }

    return {
      success: true,
      delivery: wasDeliveredLive ? 'live' : 'queued',
      deliveredAt,
      readAt
    };
  }

  static async sendNotification(notificationId) {
    try {
      const notification = await Notification.findById(notificationId);
      if (!notification || !notification.is_active) {
        throw new Error('Notification not found or inactive');
      }

      if (notification.expires_at && new Date(notification.expires_at) < new Date()) {
        throw new Error('Notification has expired');
      }

      const recipients = await Notification.getRecipients(notificationId);
      const results = [];
      const autoRead = this.shouldAutoRead(notification);

      for (const recipient of recipients) {
        try {
          const user = await User.findById(recipient.user_id);
          if (!user || user.status !== 'active') {
            await Notification.updateRecipientStatus(notificationId, recipient.user_id, 'failed', {
              failure_reason: 'Recipient is not active'
            });
            continue;
          }

          const deliveryResults = {};
          let realtimeDelivery = null;

          const wantsRealtimeChannel = notification.channels.includes('web');
          const wantsPushChannel = notification.channels.includes('push') && user.push_notifications;

          if (wantsRealtimeChannel || wantsPushChannel) {
            realtimeDelivery = await this.deliverRealtimeNotification(notification, user, { autoRead });

            if (wantsRealtimeChannel) {
              deliveryResults.web = {
                success: true,
                channel: 'web',
                delivery: realtimeDelivery.delivery
              };
            }

            if (notification.channels.includes('push')) {
              deliveryResults.push = wantsPushChannel
                ? {
                    success: true,
                    channel: 'push',
                    delivery: realtimeDelivery.delivery,
                    mode: 'browser-native'
                  }
                : {
                    success: false,
                    error: 'Push notifications disabled in the user profile'
                  };
            }
          }

          for (const channel of notification.channels.filter((entry) => !['web', 'push'].includes(entry))) {
            try {
              deliveryResults[channel] = await this.sendThroughChannel(channel, notification, user);
            } catch (channelError) {
              logger.error(`Failed to send via ${channel}:`, channelError);
              deliveryResults[channel] = {
                success: false,
                error: channelError.message
              };
            }
          }

          const delivered = Object.values(deliveryResults).some((result) => result.success);
          const status = delivered ? (autoRead ? 'read' : 'delivered') : 'failed';

          await Notification.updateRecipientStatus(notificationId, recipient.user_id, status, {
            delivery_results: deliveryResults,
            delivered_at: delivered ? (realtimeDelivery?.deliveredAt || new Date().toISOString()) : null,
            read_at: delivered && autoRead ? (realtimeDelivery?.readAt || new Date().toISOString()) : null,
            failure_reason: delivered ? null : 'All selected channels failed'
          });

          results.push({
            userId: recipient.user_id,
            status,
            deliveryResults
          });
        } catch (recipientError) {
          logger.error(`Failed to process recipient ${recipient.user_id}:`, recipientError);
          await Notification.updateRecipientStatus(notificationId, recipient.user_id, 'failed', {
            failure_reason: recipientError.message
          });
        }
      }

      return {
        success: true,
        totalRecipients: recipients.length,
        successfulDeliveries: results.filter((result) => result.status !== 'failed').length,
        results
      };
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  static async sendThroughChannel(channel, notification, user) {
    switch (channel) {
      case 'email':
        return user.email_notifications
          ? { success: true, channel, mode: 'simulated' }
          : { success: false, error: 'Email notifications disabled' };

      case 'telegram':
        return user.telegram_notifications
          ? { success: true, channel, mode: 'simulated' }
          : { success: false, error: 'Telegram notifications disabled' };

      case 'slack':
        return { success: true, channel, mode: 'simulated' };

      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  static async scheduleNotification(notificationId, scheduledFor) {
    const delay = new Date(scheduledFor).getTime() - Date.now();

    if (delay <= 0) {
      return this.sendNotification(notificationId);
    }

    if (scheduledJobs.has(notificationId)) {
      clearTimeout(scheduledJobs.get(notificationId));
    }

    const timeoutId = setTimeout(async () => {
      scheduledJobs.delete(notificationId);

      try {
        await this.sendNotification(notificationId);
      } catch (error) {
        logger.error('Scheduled notification delivery failed:', error);
      }
    }, delay);

    scheduledJobs.set(notificationId, timeoutId);

    return {
      success: true,
      scheduledFor
    };
  }

  static async processScheduledNotifications() {
    return {
      success: true,
      scheduledCount: scheduledJobs.size
    };
  }

  static async getUserWebNotifications(userId) {
    return peekPendingNotifications(userId);
  }

  static async clearUserWebNotifications(userId) {
    pullPendingNotifications(userId);
  }

  static async consumeUserWebNotifications(userId) {
    return pullPendingNotifications(userId);
  }

  static async getNotificationStats(notificationId) {
    return Notification.getDeliveryStats(notificationId);
  }

  static async retryFailedDeliveries(notificationId) {
    const recipients = await Notification.getRecipients(notificationId);
    const failedRecipients = recipients.filter((recipient) => recipient.status === 'failed');
    const notification = await Notification.findById(notificationId);

    const results = [];

    for (const recipient of failedRecipients) {
      const user = await User.findById(recipient.user_id);
      if (!user) {
        continue;
      }

      const deliveryResults = {};

      for (const channel of notification.channels) {
        deliveryResults[channel] = await this.sendThroughChannel(channel, notification, user);
      }

      const delivered = Object.values(deliveryResults).some((result) => result.success);
      const status = delivered ? 'delivered' : 'failed';

      await Notification.updateRecipientStatus(notificationId, recipient.user_id, status, {
        delivery_results: deliveryResults,
        delivered_at: delivered ? new Date().toISOString() : null,
        failure_reason: delivered ? null : 'Retry failed'
      });

      results.push({
        userId: recipient.user_id,
        status,
        deliveryResults
      });
    }

    return {
      success: true,
      totalAttempted: failedRecipients.length,
      successfulDeliveries: results.filter((result) => result.status !== 'failed').length,
      results
    };
  }
}

module.exports = NotificationService;
