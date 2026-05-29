const webpush = require('web-push');
const logger = require('../utils/logger');

class PushService {
  static async initialize() {
    try {
      const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
      const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
      const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

      if (!publicVapidKey || !privateVapidKey) {
        logger.warn('VAPID keys not configured. Push notifications will be disabled.');
        return false;
      }

      webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
      logger.info('Push service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize push service:', error);
      return false;
    }
  }

  static async sendNotification(notification, user) {
    try {
      const isInitialized = await this.initialize();
      if (!isInitialized) {
        throw new Error('Push service is not properly configured');
      }

      // Get user's push subscriptions from database
      const subscriptions = await this.getUserSubscriptions(user.id);
      
      if (subscriptions.length === 0) {
        throw new Error('User has no active push subscriptions');
      }

      const payload = this.formatPayload(notification);
      const results = [];

      for (const subscription of subscriptions) {
        try {
          const result = await webpush.sendNotification(
            subscription.subscription_data,
            JSON.stringify(payload),
            {
              TTL: notification.priority === 'critical' ? 0 : 3600,
              urgency: this.getUrgency(notification.priority)
            }
          );

          results.push({
            subscriptionId: subscription.id,
            success: true,
            result
          });

          logger.info(`Push notification sent to user ${user.id}, subscription ${subscription.id}`);
        } catch (pushError) {
          logger.error(`Failed to send push notification to subscription ${subscription.id}:`, pushError);
          
          // If subscription is no longer valid, remove it
          if (pushError.statusCode === 410) {
            await this.removeSubscription(subscription.id);
          }

          results.push({
            subscriptionId: subscription.id,
            success: false,
            error: pushError.message
          });
        }
      }

      const successfulDeliveries = results.filter(r => r.success).length;
      
      if (successfulDeliveries === 0) {
        throw new Error('All push subscriptions failed');
      }

      return {
        success: true,
        channel: 'push',
        totalSubscriptions: subscriptions.length,
        successfulDeliveries,
        results
      };
    } catch (error) {
      logger.error(`Failed to send push notification to ${user.email}:`, error);
      throw error;
    }
  }

  static formatPayload(notification) {
    const priorityIcons = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const icon = priorityIcons[notification.priority] || priorityIcons.medium;

    return {
      title: `${icon} ${notification.title}`,
      body: notification.message,
      data: {
        notificationId: notification.id,
        type: notification.type,
        priority: notification.priority,
        createdAt: notification.created_at,
        metadata: notification.metadata || {}
      },
      actions: this.getActions(notification),
      badge: '/badge.png',
      icon: '/icon.png',
      image: notification.metadata?.image || null,
      tag: notification.id,
      requireInteraction: notification.priority === 'critical',
      silent: notification.priority === 'low',
      timestamp: new Date(notification.created_at).getTime()
    };
  }

  static getActions(notification) {
    const actions = [
      {
        action: 'mark-as-read',
        title: 'Mark as Read'
      }
    ];

    if (notification.metadata?.actionUrl) {
      actions.push({
        action: 'open',
        title: 'Open'
      });
    }

    return actions;
  }

  static getUrgency(priority) {
    const urgencyMap = {
      low: 'very-low',
      medium: 'normal',
      high: 'high',
      critical: 'critical'
    };

    return urgencyMap[priority] || 'normal';
  }

  static async getUserSubscriptions(userId) {
    try {
      const { db } = require('../config/database');
      
      const subscriptions = await db('push_subscriptions')
        .where('user_id', userId)
        .where('is_active', true)
        .orderBy('created_at', 'desc');

      return subscriptions;
    } catch (error) {
      logger.error('Error getting user push subscriptions:', error);
      return [];
    }
  }

  static async addSubscription(userId, subscriptionData) {
    try {
      const { db } = require('../config/database');
      
      const [subscription] = await db('push_subscriptions')
        .insert({
          user_id: userId,
          subscription_data: JSON.stringify(subscriptionData),
          user_agent: subscriptionData.userAgent || null,
          is_active: true
        })
        .returning('*');

      logger.info(`Push subscription added for user ${userId}: ${subscription.id}`);
      
      return subscription;
    } catch (error) {
      logger.error('Error adding push subscription:', error);
      throw error;
    }
  }

  static async removeSubscription(subscriptionId) {
    try {
      const { db } = require('../config/database');
      
      await db('push_subscriptions')
        .where('id', subscriptionId)
        .update({ is_active: false });

      logger.info(`Push subscription removed: ${subscriptionId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error removing push subscription:', error);
      throw error;
    }
  }

  static async removeAllUserSubscriptions(userId) {
    try {
      const { db } = require('../config/database');
      
      await db('push_subscriptions')
        .where('user_id', userId)
        .update({ is_active: false });

      logger.info(`All push subscriptions removed for user ${userId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error removing all user push subscriptions:', error);
      throw error;
    }
  }

  static generateVapidKeys() {
    try {
      const keys = webpush.generateVAPIDKeys();
      
      logger.info('VAPID keys generated successfully');
      
      return {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey
      };
    } catch (error) {
      logger.error('Error generating VAPID keys:', error);
      throw error;
    }
  }

  static getPublicKey() {
    return process.env.VAPID_PUBLIC_KEY;
  }

  static async testConnection() {
    try {
      const isInitialized = await this.initialize();
      
      if (!isInitialized) {
        return { 
          success: false, 
          error: 'Push service is not configured. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.' 
        };
      }

      return { 
        success: true, 
        message: 'Push service is working correctly',
        publicKey: this.getPublicKey()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async cleanupExpiredSubscriptions() {
    try {
      const { db } = require('../config/database');
      
      // Remove subscriptions older than 30 days that haven't been used
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await db('push_subscriptions')
        .where('last_used_at', '<', thirtyDaysAgo)
        .where('is_active', true)
        .update({ is_active: false });

      logger.info('Expired push subscriptions cleaned up');
      
      return { success: true };
    } catch (error) {
      logger.error('Error cleaning up expired push subscriptions:', error);
      throw error;
    }
  }

  static async updateSubscriptionLastUsed(subscriptionId) {
    try {
      const { db } = require('../config/database');
      
      await db('push_subscriptions')
        .where('id', subscriptionId)
        .update({ last_used_at: new Date() });
    } catch (error) {
      logger.error('Error updating subscription last used:', error);
    }
  }
}

module.exports = PushService;
