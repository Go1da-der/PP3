const {
  users,
  teams,
  notifications,
  notificationRecipients,
  clone,
  now,
  createId
} = require('../data/store');
const Team = require('./Team');

const hydrateNotification = (notification) => {
  const creator = users.find((entry) => entry.id === notification.created_by);

  return {
    ...clone(notification),
    creator_first_name: creator?.first_name || null,
    creator_last_name: creator?.last_name || null,
    creator_email: creator?.email || null
  };
};

const uniqueRecipientKey = (recipient) => `${recipient.user_id}:${recipient.team_id || 'none'}`;

class Notification {
  static async create(notificationData) {
    const timestamp = now();
    const notification = {
      id: createId(),
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'info',
      priority: notificationData.priority || 'medium',
      channels: Array.isArray(notificationData.channels) && notificationData.channels.length > 0
        ? [...new Set(notificationData.channels)]
        : ['web'],
      created_by: notificationData.created_by,
      scheduled_for: notificationData.scheduled_for || null,
      expires_at: notificationData.expires_at || null,
      metadata: notificationData.metadata || {},
      is_active: notificationData.is_active ?? true,
      created_at: timestamp,
      updated_at: timestamp
    };

    notifications.push(notification);
    return hydrateNotification(notification);
  }

  static async findById(id) {
    const notification = notifications.find((entry) => entry.id === id);
    if (!notification) {
      return null;
    }

    const payload = hydrateNotification(notification);
    payload.recipients = await this.getRecipients(id);
    return payload;
  }

  static async findAll(filters = {}) {
    let result = notifications.filter((entry) => entry.is_active);

    if (filters.type) {
      result = result.filter((entry) => entry.type === filters.type);
    }

    if (filters.priority) {
      result = result.filter((entry) => entry.priority === filters.priority);
    }

    if (filters.created_by) {
      result = result.filter((entry) => entry.created_by === filters.created_by);
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter((entry) => {
        return [entry.title, entry.message].some((value) => value.toLowerCase().includes(term));
      });
    }

    if (filters.date_from) {
      result = result.filter((entry) => new Date(entry.created_at) >= new Date(filters.date_from));
    }

    if (filters.date_to) {
      result = result.filter((entry) => new Date(entry.created_at) <= new Date(filters.date_to));
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    return result
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(offset, offset + limit)
      .map((notification) => hydrateNotification(notification));
  }

  static async update(id, updateData) {
    const notification = notifications.find((entry) => entry.id === id);
    if (!notification) {
      return null;
    }

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        notification[key] = clone(value);
      }
    });
    notification.updated_at = now();

    return hydrateNotification(notification);
  }

  static async delete(id) {
    const notification = notifications.find((entry) => entry.id === id);
    if (!notification) {
      return 0;
    }

    notification.is_active = false;
    notification.updated_at = now();
    return 1;
  }

  static async addRecipients(notificationId, recipients) {
    const normalizedRecipients = [];

    for (const recipient of recipients) {
      const userId = recipient.user_id || recipient.userId || null;
      const teamId = recipient.team_id || recipient.teamId || null;

      if (userId) {
        normalizedRecipients.push({
          user_id: userId,
          team_id: teamId
        });
        continue;
      }

      if (teamId) {
        const members = await Team.getMembers(teamId);
        members.forEach((member) => {
          normalizedRecipients.push({
            user_id: member.id,
            team_id: teamId
          });
        });
      }
    }

    const uniqueRecipients = Array.from(
      new Map(normalizedRecipients.map((recipient) => [uniqueRecipientKey(recipient), recipient])).values()
    );

    const createdRecipients = uniqueRecipients.map((recipient) => {
      const item = {
        id: createId(),
        notification_id: notificationId,
        user_id: recipient.user_id,
        team_id: recipient.team_id || null,
        status: 'pending',
        read_at: null,
        delivered_at: null,
        failed_at: null,
        failure_reason: null,
        delivery_results: {}
      };

      notificationRecipients.push(item);
      return clone(item);
    });

    return createdRecipients;
  }

  static async getRecipients(notificationId) {
    return notificationRecipients
      .filter((recipient) => recipient.notification_id === notificationId)
      .map((recipient) => {
        const user = users.find((entry) => entry.id === recipient.user_id);
        const team = recipient.team_id
          ? teams.find((entry) => entry.id === recipient.team_id)
          : null;

        return {
          ...clone(recipient),
          first_name: user?.first_name || null,
          last_name: user?.last_name || null,
          email: user?.email || null,
          team_name: team?.name || null
        };
      });
  }

  static async updateRecipientStatus(notificationId, userId, status, additionalData = {}) {
    const recipient = notificationRecipients.find((entry) => {
      return entry.notification_id === notificationId && entry.user_id === userId;
    });

    if (!recipient) {
      return null;
    }

    recipient.status = status;
    Object.entries(additionalData).forEach(([key, value]) => {
      if (value !== undefined) {
        recipient[key] = clone(value);
      }
    });

    if (status === 'read' && !recipient.read_at) {
      recipient.read_at = now();
    }

    if (status === 'delivered' && !recipient.delivered_at) {
      recipient.delivered_at = now();
    }

    if (status === 'failed' && !recipient.failed_at) {
      recipient.failed_at = now();
    }

    return clone(recipient);
  }

  static async getUserNotifications(userId, filters = {}) {
    let result = notificationRecipients
      .filter((recipient) => recipient.user_id === userId)
      .map((recipient) => {
        const notification = notifications.find((entry) => entry.id === recipient.notification_id && entry.is_active);
        if (!notification) {
          return null;
        }

        return {
          ...hydrateNotification(notification),
          recipient_status: recipient.status,
          read_at: recipient.read_at,
          delivered_at: recipient.delivered_at,
          failed_at: recipient.failed_at,
          failure_reason: recipient.failure_reason
        };
      })
      .filter(Boolean);

    if (filters.status) {
      result = result.filter((entry) => entry.recipient_status === filters.status);
    }

    if (filters.type) {
      result = result.filter((entry) => entry.type === filters.type);
    }

    if (filters.unread_only) {
      result = result.filter((entry) => entry.recipient_status !== 'read');
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    return result
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(offset, offset + limit);
  }

  static async markAsRead(notificationId, userId) {
    return this.updateRecipientStatus(notificationId, userId, 'read');
  }

  static async markAllAsRead(userId) {
    let count = 0;

    notificationRecipients.forEach((recipient) => {
      if (recipient.user_id === userId && recipient.status !== 'read') {
        recipient.status = 'read';
        recipient.read_at = now();
        count += 1;
      }
    });

    return count;
  }

  static async getUnreadCount(userId) {
    return notificationRecipients.filter((recipient) => {
      const notification = notifications.find((entry) => entry.id === recipient.notification_id && entry.is_active);
      return notification && recipient.user_id === userId && recipient.status !== 'read';
    }).length;
  }

  static async getDeliveryStats(notificationId) {
    return notificationRecipients
      .filter((recipient) => recipient.notification_id === notificationId)
      .reduce((accumulator, recipient) => {
        accumulator[recipient.status] = (accumulator[recipient.status] || 0) + 1;
        return accumulator;
      }, {});
  }

  static async getGlobalStats(filters = {}) {
    let result = notifications.filter((entry) => entry.is_active);

    if (filters.date_from) {
      result = result.filter((entry) => new Date(entry.created_at) >= new Date(filters.date_from));
    }

    if (filters.date_to) {
      result = result.filter((entry) => new Date(entry.created_at) <= new Date(filters.date_to));
    }

    const byType = {};
    const byPriority = {};

    result.forEach((notification) => {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
    });

    return {
      total: result.length,
      by_type: byType,
      by_priority: byPriority
    };
  }
}

module.exports = Notification;
