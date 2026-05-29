const express = require('express');
const Joi = require('joi');
const Team = require('../models/Team');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createTeamSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  avatarUrl: Joi.string().uri().optional()
});

const updateTeamSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().max(500),
  avatarUrl: Joi.string().uri(),
  isActive: Joi.boolean()
});

const addMemberSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  role: Joi.string().valid('owner', 'admin', 'member').default('member')
});

const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member').required()
});

// Helper function to check team access
async function checkTeamAccess(teamId, userId, requiredRole = 'member') {
  const isMember = await Team.isMember(teamId, userId);
  if (!isMember) {
    return { hasAccess: false, reason: 'Not a team member' };
  }

  const userRole = await Team.getMemberRole(teamId, userId);
  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  
  if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
    return { hasAccess: false, reason: 'Insufficient permissions' };
  }

  return { hasAccess: true, userRole };
}

// @route   GET /api/teams
// @desc    Get all teams
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      created_by: req.query.created_by,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    // Non-admin users can only see teams they are members of
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const userTeams = await Team.getUserTeams(req.user.id);
      return res.json({
        success: true,
        data: {
          teams: userTeams,
          filters
        }
      });
    }

    const teams = await Team.findAll(filters);

    res.json({
      success: true,
      data: {
        teams,
        filters
      }
    });
  } catch (error) {
    logger.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teams'
    });
  }
});

// @route   GET /api/teams/stats
// @desc    Get team statistics
// @access  Private (Admin, Manager)
router.get('/stats', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const stats = await Team.getStats();

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.error('Get team stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching team statistics'
    });
  }
});

// @route   GET /api/teams/:id
// @desc    Get team by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is member of the team or admin/manager
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const accessCheck = await checkTeamAccess(id, req.user.id);
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this team.'
        });
      }
    }

    const team = await Team.findById(id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      data: {
        team
      }
    });
  } catch (error) {
    logger.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching team'
    });
  }
});

// @route   POST /api/teams
// @desc    Create new team
// @access  Private (Admin, Manager, Developer)
router.post('/', auth, authorize('admin', 'manager', 'developer'), async (req, res) => {
  try {
    const { error } = createTeamSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, description, avatarUrl } = req.body;

    const teamData = {
      name,
      description,
      avatar_url: avatarUrl,
      created_by: req.user.id
    };

    const team = await Team.create(teamData);

    // Add creator as owner
    await Team.addMember(team.id, req.user.id, 'owner');

    logger.info(`Team created: ${team.id} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: {
        team
      }
    });
  } catch (error) {
    logger.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating team'
    });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team
// @access  Private (Team owner/admin or Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = updateTeamSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if team exists
    const existingTeam = await Team.findById(id);
    if (!existingTeam) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else {
      const accessCheck = await checkTeamAccess(id, req.user.id, 'admin');
      hasAccess = accessCheck.hasAccess;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team owners/admins can update teams.'
      });
    }

    // Prepare update data
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.avatarUrl !== undefined) updateData.avatar_url = req.body.avatarUrl;
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;

    const team = await Team.update(id, updateData);

    logger.info(`Team updated: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: {
        team
      }
    });
  } catch (error) {
    logger.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating team'
    });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team (soft delete)
// @access  Private (Team owner or Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if team exists
    const existingTeam = await Team.findById(id);
    if (!existingTeam) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else {
      const accessCheck = await checkTeamAccess(id, req.user.id, 'owner');
      hasAccess = accessCheck.hasAccess;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team owners can delete teams.'
      });
    }

    await Team.delete(id);

    logger.info(`Team deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    logger.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting team'
    });
  }
});

// @route   GET /api/teams/:id/members
// @desc    Get team members
// @access  Private
router.get('/:id/members', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is member of the team or admin/manager
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const accessCheck = await checkTeamAccess(id, req.user.id);
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this team.'
        });
      }
    }

    const members = await Team.getMembers(id);

    res.json({
      success: true,
      data: {
        members
      }
    });
  } catch (error) {
    logger.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching team members'
    });
  }
});

// @route   POST /api/teams/:id/members
// @desc    Add member to team
// @access  Private (Team owner/admin or Admin)
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = addMemberSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { userId, role } = req.body;

    // Check if team exists
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else {
      const accessCheck = await checkTeamAccess(id, req.user.id, 'admin');
      hasAccess = accessCheck.hasAccess;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team owners/admins can add members.'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a member
    const isAlreadyMember = await Team.isMember(id, userId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this team'
      });
    }

    // Prevent adding owner role to others (only admin can assign owner)
    if (role === 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can assign owner role.'
      });
    }

    const member = await Team.addMember(id, userId, role);

    logger.info(`User ${userId} added to team ${id} with role ${role} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: {
        member
      }
    });
  } catch (error) {
    logger.error('Add team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding team member'
    });
  }
});

// @route   PUT /api/teams/:id/members/:userId
// @desc    Update member role
// @access  Private (Team owner or Admin)
router.put('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { error } = updateMemberRoleSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { role } = req.body;

    // Check if team exists
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is member
    const isMember = await Team.isMember(id, userId);
    if (!isMember) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this team'
      });
    }

    // Check permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else {
      const accessCheck = await checkTeamAccess(id, req.user.id, 'owner');
      hasAccess = accessCheck.hasAccess;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team owners can update member roles.'
      });
    }

    // Prevent assigning owner role to others (only admin can assign owner)
    if (role === 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can assign owner role.'
      });
    }

    const member = await Team.updateMemberRole(id, userId, role);

    logger.info(`User ${userId} role updated to ${role} in team ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: {
        member
      }
    });
  } catch (error) {
    logger.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating member role'
    });
  }
});

// @route   DELETE /api/teams/:id/members/:userId
// @desc    Remove member from team
// @access  Private (Team owner/admin or Admin)
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Check if team exists
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else {
      const accessCheck = await checkTeamAccess(id, req.user.id, 'admin');
      hasAccess = accessCheck.hasAccess;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team owners/admins can remove members.'
      });
    }

    // Check if user is member
    const isMember = await Team.isMember(id, userId);
    if (!isMember) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this team'
      });
    }

    // Prevent removing the last owner
    const members = await Team.getMembers(id);
    const owners = members.filter(m => m.team_role === 'owner');
    if (owners.length === 1 && owners[0].id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the last owner of the team'
      });
    }

    await Team.removeMember(id, userId);

    logger.info(`User ${userId} removed from team ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    logger.error('Remove team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing team member'
    });
  }
});

// @route   GET /api/users/me/teams
// @desc    Get current user teams
// @access  Private
router.get('/me/teams', auth, async (req, res) => {
  try {
    const teams = await Team.getUserTeams(req.user.id);

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
