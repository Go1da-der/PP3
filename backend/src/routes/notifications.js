const express = require('express');
const Joi = require('joi');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Team = require('../models/Team');
const { auth, authorize } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { getRoleCapabilities } = require('../utils/permissions');

const router = express.Router();

// Validation schemas
const createNotificationSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  message: Joi.string().min(1).max(2000).required(),
  type: Joi.string().valid('info', 'warning', 'error', 'success').default('info'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  channels: Joi.array().items(Joi.string().valid('web', 'email', 'telegram', 'slack', 'push')).default(['web']),
  scheduledFor: Joi.date().optional(),
  expiresAt: Joi.date().optional(),
  recipients: Joi.alternatives().try(
    Joi.array().items(Joi.string().uuid()),
    Joi.array().items(Joi.object({
      userId: Joi.string().uuid().optional(),
      teamId: Joi.string().uuid().optional()
    }).or('userId', 'teamId')),
    Joi.string().valid('all')
  ).required(),
  metadata: Joi.object().default({})
});

const updateNotificationSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  message: Joi.string().min(1).max(2000),
  type: Joi.string().valid('info', 'warning', 'error', 'success'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  channels: Joi.array().items(Joi.string().valid('web', 'email', 'telegram', 'slack', 'push')),
  scheduledFor: Joi.date(),
  expiresAt: Joi.date(),
  metadata: Joi.object(),
  isActive: Joi.boolean()
});

const extractRecipientObjects = (recipients) => {
  if (!Array.isArray(recipients)) {
    return [];
  }

  if (recipients.length === 0) {
    return [];
  }

  if (typeof recipients[0] === 'string') {
    return recipients.map((userId) => ({ userId }));
  }

  return recipients;
};

const canTargetUser = async (actor, userId) => {
  if (actor.role === 'admin' || actor.id === userId) {
    return true;
  }

  if (actor.role !== 'manager') {
    return false;
  }

  const visibleUsers = await User.findVisibleTo(actor, {
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0
  });

  return visibleUsers.some((user) => user.id === userId);
};

const validateRecipientPermissions = async (actor, recipients) => {
  const permissions = getRoleCapabilities(actor.role);

  if (!permissions.createNotifications) {
    return 'Your role is not allowed to create notifications.';
  }

  if (recipients === 'all' && !permissions.broadcastAll) {
    return 'Only admins can send a notification to every user.';
  }

  const recipientObjects = extractRecipientObjects(recipients);
  const directUserIds = recipientObjects
    .map((recipient) => recipient.userId)
    .filter(Boolean);
  const recipientTeamIds = recipientObjects
    .map((recipient) => recipient.teamId)
    .filter(Boolean);

  if (!permissions.messageIndividuals && directUserIds.length > 0) {
    return 'Your role cannot send direct notifications to individual users.';
  }

  if (!permissions.messageTeams && recipientTeamIds.length > 0) {
    return 'Your role cannot send notifications to teams.';
  }

  for (const userId of directUserIds) {
    const user = await User.findById(userId);
    if (!user || user.status !== 'active') {
      return 'One of the selected users was not found or is inactive.';
    }
  }

  for (const teamId of recipientTeamIds) {
    const team = await Team.findById(teamId);
    if (!team || !team.is_active) {
      return 'One of the selected teams was not found or is inactive.';
    }
  }

  if (actor.role !== 'admin') {
    for (const teamId of recipientTeamIds) {
      const isMember = await Team.isMember(teamId, actor.id);
      if (!isMember) {
        return 'You can notify only teams where you are a member.';
      }
    }
  }

  if (actor.role === 'manager') {
    for (const userId of directUserIds) {
      const isVisible = await canTargetUser(actor, userId);
      if (!isVisible) {
        return 'Managers can send direct notifications only to users from shared teams.';
      }
    }
  }

  return null;
};

// @route   GET /api/notifications
// @desc    Get all notifications
// @access  Private (Admin, Manager)
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      priority: req.query.priority,
      created_by: req.query.created_by,
      search: req.query.search,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const notifications = await Notification.findAll(filters);

    res.json({
      success: true,
      data: {
        notifications,
        filters
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// @route   GET /api/notifications/stats
// @desc    Get notification statistics
// @access  Private (Admin, Manager)
router.get('/stats', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    const stats = await Notification.getGlobalStats(filters);

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification statistics'
    });
  }
});

// @route   GET /api/notifications/me
// @desc    Get current user notifications
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    const filters = {
      status: req.query.status,
      type: req.query.type,
      unread_only: req.query.unread_only === 'true',
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const notifications = await Notification.getUserNotifications(req.user.id, filters);
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    logger.error('Get user notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// @route   GET /api/notifications/me/unread-count
// @desc    Get unread notifications count for current user
// @access  Private
router.get('/me/unread-count', auth, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.json({
      success: true,
      data: {
        unreadCount: 0
      }
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
});

// @route   GET /api/notifications/:id
// @desc    Get notification by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has permission (admin, manager, or recipient)
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      // Check if user is a recipient of this notification
      const userNotifications = await Notification.getUserNotifications(req.user.id);
      const isRecipient = userNotifications.some(n => n.id === id);
      
      if (!isRecipient) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a recipient of this notification.'
        });
      }
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: {
        notification
      }
    });
  } catch (error) {
    logger.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification'
    });
  }
});

// @route   POST /api/notifications
// @desc    Create new notification
// @access  Private (Admin, Manager, Developer)
router.post('/', auth, authorize('admin', 'manager', 'developer'), async (req, res) => {
  try {
    const { error } = createNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const {
      title,
      message,
      type,
      priority,
      channels,
      scheduledFor,
      expiresAt,
      recipients,
      metadata
    } = req.body;

    const permissionError = await validateRecipientPermissions(req.user, recipients);
    if (permissionError) {
      return res.status(403).json({
        success: false,
        message: permissionError
      });
    }

    // Create notification
    const notificationData = {
      title,
      message,
      type,
      priority,
      channels,
      scheduled_for: scheduledFor,
      expires_at: expiresAt,
      metadata: {
        autoRead: metadata?.autoRead ?? true,
        ...metadata
      },
      created_by: req.user.id
    };

    const notification = await Notification.create(notificationData);

    // Process recipients
    let recipientUsers = [];

    if (recipients === 'all') {
      // Send to all active users
      const allUsers = await User.findAll({ status: 'active' });
      recipientUsers = allUsers.map(user => ({ user_id: user.id }));
    } else if (Array.isArray(recipients) && recipients.length > 0) {
      if (typeof recipients[0] === 'string') {
        // Array of user IDs
        recipientUsers = recipients.map(userId => ({ user_id: userId }));
      } else {
        // Array of recipient objects
        recipientUsers = recipients;
      }
    }

    // Add recipients to notification
    if (recipientUsers.length > 0) {
      await Notification.addRecipients(notification.id, recipientUsers);
    }

    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      await NotificationService.scheduleNotification(notification.id, scheduledFor);
    } else {
      try {
        await NotificationService.sendNotification(notification.id);
      } catch (sendError) {
        logger.error('Error sending notification:', sendError);
        // Don't fail the request, just log the error
      }
    }

    logger.info(`Notification created: ${notification.id} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: {
        notification
      }
    });
  } catch (error) {
    logger.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating notification'
    });
  }
});

// @route   PUT /api/notifications/:id
// @desc    Update notification
// @access  Private (Admin, Manager, or creator)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = updateNotificationSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if notification exists
    const existingNotification = await Notification.findById(id);
    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'manager';
    const isCreator = existingNotification.created_by === req.user.id;

    if (!isAdmin && !isManager && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own notifications.'
      });
    }

    // Prepare update data
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.message !== undefined) updateData.message = req.body.message;
    if (req.body.type !== undefined) updateData.type = req.body.type;
    if (req.body.priority !== undefined) updateData.priority = req.body.priority;
    if (req.body.channels !== undefined) updateData.channels = req.body.channels;
    if (req.body.scheduledFor !== undefined) updateData.scheduled_for = req.body.scheduledFor;
    if (req.body.expiresAt !== undefined) updateData.expires_at = req.body.expiresAt;
    if (req.body.metadata !== undefined) updateData.metadata = req.body.metadata;
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;

    const notification = await Notification.update(id, updateData);

    logger.info(`Notification updated: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Notification updated successfully',
      data: {
        notification
      }
    });
  } catch (error) {
    logger.error('Update notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification (soft delete)
// @access  Private (Admin, Manager, or creator)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if notification exists
    const existingNotification = await Notification.findById(id);
    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'manager';
    const isCreator = existingNotification.created_by === req.user.id;

    if (!isAdmin && !isManager && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own notifications.'
      });
    }

    await Notification.delete(id);

    logger.info(`Notification deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification'
    });
  }
});

// @route   POST /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.post('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is a recipient of this notification
    const userNotifications = await Notification.getUserNotifications(req.user.id);
    const notification = userNotifications.find(n => n.id === id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you are not a recipient'
      });
    }

    // Mark as read
    await Notification.markAsRead(id, req.user.id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notification as read'
    });
  }
});

// @route   POST /api/notifications/me/read-all
// @desc    Mark all notifications as read
// @access  Private
router.post('/me/read-all', auth, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notifications as read'
    });
  }
});

// @route   GET /api/notifications/:id/stats
// @desc    Get notification delivery statistics
// @access  Private (Admin, Manager, or creator)
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if notification exists
    const existingNotification = await Notification.findById(id);
    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'manager';
    const isCreator = existingNotification.created_by === req.user.id;

    if (!isAdmin && !isManager && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view statistics for your own notifications.'
      });
    }

    const stats = await Notification.getDeliveryStats(id);

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification statistics'
    });
  }
});

module.exports = router;
