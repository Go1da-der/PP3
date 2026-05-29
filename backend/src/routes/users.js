const express = require('express');
const Joi = require('joi');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const canAccessUser = async (actor, targetUserId) => {
  if (!actor) {
    return false;
  }

  if (actor.role === 'admin' || actor.id === targetUserId) {
    return true;
  }

  if (actor.role !== 'manager') {
    return false;
  }

  const visibleUsers = await User.findVisibleTo(actor, {
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0
  });

  return visibleUsers.some((user) => user.id === targetUserId);
};

// Validation schemas
const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2),
  lastName: Joi.string().min(2),
  phone: Joi.string().optional(),
  role: Joi.string().valid('admin', 'manager', 'developer', 'tester'),
  status: Joi.string().valid('active', 'inactive', 'suspended'),
  preferences: Joi.object(),
  emailNotifications: Joi.boolean(),
  pushNotifications: Joi.boolean(),
  telegramNotifications: Joi.boolean()
});

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin, Manager)
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const filters = {
      role: req.query.role,
      status: req.query.status,
      search: req.query.search,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const users = req.user.role === 'admin'
      ? await User.findAll(filters)
      : await User.findVisibleTo(req.user, filters);

    res.json({
      success: true,
      data: {
        users,
        filters
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private (Admin, Manager)
router.get('/stats', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const stats = await User.getStats();

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user statistics'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin, Manager, or own user)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await canAccessUser(req.user, id))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This profile is outside your role scope.'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add teams information
    user.teams = await User.getTeams(id);

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin, Manager, or own user with limited fields)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = updateUserSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isOwnProfile = req.user.id === id;
    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'manager';

    if (!isOwnProfile && !(await canAccessUser(req.user, id))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This profile is outside your role scope.'
      });
    }

    // Prepare update data based on permissions
    const updateData = {};
    const allowedFieldsForSelf = ['firstName', 'lastName', 'phone', 'preferences', 'emailNotifications', 'pushNotifications', 'telegramNotifications'];
    const allowedFieldsForManager = [...allowedFieldsForSelf, 'status'];
    const allowedFieldsForAdmin = ['firstName', 'lastName', 'phone', 'role', 'status', 'preferences', 'emailNotifications', 'pushNotifications', 'telegramNotifications'];

    let allowedFields;
    if (isOwnProfile) {
      allowedFields = allowedFieldsForSelf;
    } else if (isManager) {
      allowedFields = allowedFieldsForManager;
      // Managers can't change admin users
      if (existingUser.role === 'admin' && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Cannot modify admin users.'
        });
      }
    } else if (isAdmin) {
      allowedFields = allowedFieldsForAdmin;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Filter allowed fields
    for (const field of allowedFields) {
      const fieldKey = field === 'firstName' ? 'first_name' : 
                      field === 'lastName' ? 'last_name' : 
                      field === 'emailNotifications' ? 'email_notifications' :
                      field === 'pushNotifications' ? 'push_notifications' :
                      field === 'telegramNotifications' ? 'telegram_notifications' :
                      field;
      
      if (req.body[field] !== undefined) {
        updateData[fieldKey] = req.body[field];
      }
    }

    const user = await User.update(id, updateData);

    logger.info(`User updated: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete - set status to inactive)
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    // Soft delete (set status to inactive)
    await User.update(id, { status: 'inactive' });

    logger.info(`User deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
});

// @route   GET /api/users/:id/teams
// @desc    Get user teams
// @access  Private (Admin, Manager, or own user)
router.get('/:id/teams', auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await canAccessUser(req.user, id))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This profile is outside your role scope.'
      });
    }

    const teams = await User.getTeams(id);

    res.json({
      success: true,
      data: {
        teams
      }
    });
  } catch (error) {
    logger.error('Get user teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user teams'
    });
  }
});

module.exports = router;
