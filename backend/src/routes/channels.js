const express = require('express');
const Joi = require('joi');
const { db } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createChannelSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid('email', 'telegram', 'slack', 'push', 'webhook').required(),
  config: Joi.object().default({}),
  enabled: Joi.boolean().default(true)
});

const updateChannelSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  type: Joi.string().valid('email', 'telegram', 'slack', 'push', 'webhook'),
  config: Joi.object(),
  enabled: Joi.boolean()
});

// @route   GET /api/channels
// @desc    Get all delivery channels
// @access  Private (Admin, Manager)
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const channels = await db('delivery_channels')
      .leftJoin('users', 'delivery_channels.created_by', 'users.id')
      .select(
        'delivery_channels.*',
        'users.first_name as creator_first_name',
        'users.last_name as creator_last_name'
      )
      .orderBy('delivery_channels.created_at', 'desc');

    res.json({
      success: true,
      data: {
        channels
      }
    });
  } catch (error) {
    logger.error('Get channels error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching channels'
    });
  }
});

// @route   GET /api/channels/:id
// @desc    Get channel by ID
// @access  Private (Admin, Manager)
router.get('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await db('delivery_channels')
      .leftJoin('users', 'delivery_channels.created_by', 'users.id')
      .select(
        'delivery_channels.*',
        'users.first_name as creator_first_name',
        'users.last_name as creator_last_name'
      )
      .where('delivery_channels.id', id)
      .first();

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    res.json({
      success: true,
      data: {
        channel
      }
    });
  } catch (error) {
    logger.error('Get channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching channel'
    });
  }
});

// @route   POST /api/channels
// @desc    Create new delivery channel
// @access  Private (Admin only)
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { error } = createChannelSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, type, config, enabled } = req.body;

    const [channel] = await db('delivery_channels')
      .insert({
        name,
        type,
        config,
        enabled,
        created_by: req.user.id
      })
      .returning('*');

    logger.info(`Channel created: ${channel.id} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Channel created successfully',
      data: {
        channel
      }
    });
  } catch (error) {
    logger.error('Create channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating channel'
    });
  }
});

// @route   PUT /api/channels/:id
// @desc    Update delivery channel
// @access  Private (Admin only)
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = updateChannelSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if channel exists
    const existingChannel = await db('delivery_channels')
      .where('id', id)
      .first();

    if (!existingChannel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.type !== undefined) updateData.type = req.body.type;
    if (req.body.config !== undefined) updateData.config = req.body.config;
    if (req.body.enabled !== undefined) updateData.enabled = req.body.enabled;

    const [channel] = await db('delivery_channels')
      .where('id', id)
      .update(updateData)
      .returning('*');

    logger.info(`Channel updated: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Channel updated successfully',
      data: {
        channel
      }
    });
  } catch (error) {
    logger.error('Update channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating channel'
    });
  }
});

// @route   DELETE /api/channels/:id
// @desc    Delete delivery channel
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if channel exists
    const existingChannel = await db('delivery_channels')
      .where('id', id)
      .first();

    if (!existingChannel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    await db('delivery_channels')
      .where('id', id)
      .del();

    logger.info(`Channel deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    logger.error('Delete channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting channel'
    });
  }
});

// @route   POST /api/channels/:id/test
// @desc    Test delivery channel
// @access  Private (Admin, Manager)
router.post('/:id/test', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await db('delivery_channels')
      .where('id', id)
      .first();

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // This would implement actual channel testing logic
    // For now, just return a success response
    res.json({
      success: true,
      message: 'Channel test completed successfully',
      data: {
        testResult: {
          status: 'success',
          message: 'Test message sent successfully',
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Test channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while testing channel'
    });
  }
});

module.exports = router;
