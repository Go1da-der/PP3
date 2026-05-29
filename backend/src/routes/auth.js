const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { getRoleCapabilities } = require('../utils/permissions');

const router = express.Router();

const jwtSecret = process.env.JWT_SECRET || 'notification-system-dev-secret';
const accessExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).required(),
  lastName: Joi.string().min(2).required(),
  phone: Joi.string().allow('', null)
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const buildAuthPayload = (user) => ({
  id: user.id,
  role: user.role,
  email: user.email
});

const issueTokens = (user) => ({
  token: jwt.sign(buildAuthPayload(user), jwtSecret, { expiresIn: accessExpiresIn }),
  refreshToken: jwt.sign(buildAuthPayload(user), jwtSecret, { expiresIn: refreshExpiresIn })
});

const presentUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  role: user.role,
  status: user.status,
  phone: user.phone,
  preferences: user.preferences,
  emailNotifications: user.email_notifications,
  pushNotifications: user.push_notifications,
  telegramNotifications: user.telegram_notifications,
  lastLoginAt: user.last_login_at,
  createdAt: user.created_at,
  permissions: getRoleCapabilities(user.role)
});

router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const existingUser = await User.findByEmail(value.email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    const user = await User.create({
      email: value.email,
      password: value.password,
      first_name: value.firstName,
      last_name: value.lastName,
      phone: value.phone || null,
      role: 'developer'
    });

    await User.updateLastLogin(user.id);
    const freshUser = await User.findById(user.id);
    const tokens = issueTokens(freshUser);

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully.',
      data: {
        user: presentUser(freshUser),
        ...tokens
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during registration.'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const user = await User.findByEmail(value.email);
    if (!user || !(await User.verifyPassword(value.password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'This account is not active.'
      });
    }

    await User.updateLastLogin(user.id);
    const freshUser = await User.findById(user.id);
    const tokens = issueTokens(freshUser);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: presentUser(freshUser),
        ...tokens
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const payload = jwt.verify(value.refreshToken, jwtSecret);
    const user = await User.findById(payload.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is no longer valid.'
      });
    }

    const tokens = issueTokens(user);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Refresh token is invalid or expired.'
    });
  }
});

router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout completed.'
  });
});

router.get('/me', auth, async (req, res) => {
  res.json({
    success: true,
    data: {
      user: presentUser(req.user)
    }
  });
});

module.exports = router;
