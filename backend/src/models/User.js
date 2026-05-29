const bcrypt = require('bcryptjs');
const {
  users,
  teams,
  teamMembers,
  clone,
  now,
  createId
} = require('../data/store');

const sortByCreatedDesc = (left, right) => {
  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const safeUser = clone(user);
  delete safeUser.password_hash;
  return safeUser;
};

class User {
  static async create(userData) {
    const timestamp = now();
    const user = {
      id: createId(),
      email: userData.email.toLowerCase(),
      password_hash: await bcrypt.hash(userData.password, 10),
      first_name: userData.first_name,
      last_name: userData.last_name,
      avatar_url: userData.avatar_url || null,
      role: userData.role || 'developer',
      status: userData.status || 'active',
      phone: userData.phone || null,
      preferences: userData.preferences || {
        digest: 'instant',
        timezone: 'Europe/Moscow'
      },
      email_notifications: userData.email_notifications ?? true,
      push_notifications: userData.push_notifications ?? true,
      telegram_notifications: userData.telegram_notifications ?? false,
      telegram_chat_id: userData.telegram_chat_id || null,
      last_login_at: null,
      email_verified_at: null,
      created_at: timestamp,
      updated_at: timestamp
    };

    users.push(user);
    return sanitizeUser(user);
  }

  static async findByEmail(email) {
    const user = users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    return user ? clone(user) : null;
  }

  static async findById(id) {
    const user = users.find((entry) => entry.id === id);
    return sanitizeUser(user);
  }

  static async findAll(filters = {}) {
    let result = users.slice();

    if (filters.role) {
      result = result.filter((user) => user.role === filters.role);
    }

    if (filters.status) {
      result = result.filter((user) => user.status === filters.status);
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter((user) => {
        return [
          user.first_name,
          user.last_name,
          user.email
        ].some((value) => value.toLowerCase().includes(term));
      });
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    return result
      .sort(sortByCreatedDesc)
      .slice(offset, offset + limit)
      .map((user) => sanitizeUser(user));
  }

  static async findVisibleTo(actor, filters = {}) {
    if (!actor) {
      return [];
    }

    if (actor.role === 'admin') {
      return this.findAll(filters);
    }

    if (actor.role !== 'manager') {
      return [];
    }

    const actorTeamIds = new Set(
      teamMembers
        .filter((member) => member.user_id === actor.id)
        .map((member) => member.team_id)
    );

    const visibleUserIds = new Set(
      teamMembers
        .filter((member) => actorTeamIds.has(member.team_id))
        .map((member) => member.user_id)
    );

    const users = await this.findAll(filters);
    return users.filter((user) => visibleUserIds.has(user.id));
  }

  static async update(id, updateData) {
    const user = users.find((entry) => entry.id === id);

    if (!user) {
      return null;
    }

    if (updateData.password) {
      user.password_hash = await bcrypt.hash(updateData.password, 10);
    }

    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'password' && value !== undefined) {
        user[key] = clone(value);
      }
    });

    user.updated_at = now();

    return sanitizeUser(user);
  }

  static async delete(id) {
    const index = users.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return 0;
    }

    users.splice(index, 1);
    return 1;
  }

  static async updateLastLogin(id) {
    const user = users.find((entry) => entry.id === id);
    if (!user) {
      return null;
    }

    user.last_login_at = now();
    user.updated_at = now();
    return sanitizeUser(user);
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async getTeams(userId) {
    return teamMembers
      .filter((member) => member.user_id === userId)
      .map((member) => {
        const team = teams.find((entry) => entry.id === member.team_id && entry.is_active);
        if (!team) {
          return null;
        }

        const creator = users.find((entry) => entry.id === team.created_by);

        return {
          id: team.id,
          name: team.name,
          description: team.description,
          avatar_url: team.avatar_url,
          is_active: team.is_active,
          created_at: team.created_at,
          member_role: member.role,
          joined_at: member.joined_at,
          creator_first_name: creator?.first_name || null,
          creator_last_name: creator?.last_name || null
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }

  static async getStats() {
    const byRole = users.reduce((accumulator, user) => {
      accumulator[user.role] = (accumulator[user.role] || 0) + 1;
      return accumulator;
    }, {});

    return {
      by_role: byRole,
      total: users.length
    };
  }
}

module.exports = User;
