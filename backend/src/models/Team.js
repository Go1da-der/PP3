const {
  users,
  teams,
  teamMembers,
  clone,
  now,
  createId
} = require('../data/store');

class Team {
  static async create(teamData) {
    const timestamp = now();
    const team = {
      id: createId(),
      name: teamData.name,
      description: teamData.description || '',
      avatar_url: teamData.avatar_url || null,
      created_by: teamData.created_by,
      is_active: teamData.is_active ?? true,
      created_at: timestamp,
      updated_at: timestamp
    };

    teams.push(team);
    return clone(team);
  }

  static async findById(id) {
    const team = teams.find((entry) => entry.id === id);
    if (!team) {
      return null;
    }

    const payload = clone(team);
    payload.members = await this.getMembers(id);
    return payload;
  }

  static async findAll(filters = {}) {
    let result = teams.filter((entry) => entry.is_active);

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter((team) => {
        return [team.name, team.description || ''].some((value) => value.toLowerCase().includes(term));
      });
    }

    if (filters.created_by) {
      result = result.filter((team) => team.created_by === filters.created_by);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const sliced = result
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(offset, offset + limit);

    return Promise.all(sliced.map(async (team) => {
      const creator = users.find((entry) => entry.id === team.created_by);
      return {
        ...clone(team),
        creator_first_name: creator?.first_name || null,
        creator_last_name: creator?.last_name || null,
        creator_email: creator?.email || null,
        members_count: await this.getMembersCount(team.id)
      };
    }));
  }

  static async update(id, updateData) {
    const team = teams.find((entry) => entry.id === id);
    if (!team) {
      return null;
    }

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        team[key] = clone(value);
      }
    });
    team.updated_at = now();

    return clone(team);
  }

  static async delete(id) {
    const team = teams.find((entry) => entry.id === id);
    if (!team) {
      return 0;
    }

    team.is_active = false;
    team.updated_at = now();
    return 1;
  }

  static async addMember(teamId, userId, role = 'member') {
    const timestamp = now();
    const member = {
      id: createId(),
      team_id: teamId,
      user_id: userId,
      role,
      joined_at: timestamp
    };

    teamMembers.push(member);
    return clone(member);
  }

  static async removeMember(teamId, userId) {
    const index = teamMembers.findIndex((entry) => entry.team_id === teamId && entry.user_id === userId);
    if (index === -1) {
      return 0;
    }

    teamMembers.splice(index, 1);
    return 1;
  }

  static async updateMemberRole(teamId, userId, role) {
    const member = teamMembers.find((entry) => entry.team_id === teamId && entry.user_id === userId);
    if (!member) {
      return null;
    }

    member.role = role;
    return clone(member);
  }

  static async getMembers(teamId) {
    return teamMembers
      .filter((member) => member.team_id === teamId)
      .map((member) => {
        const user = users.find((entry) => entry.id === member.user_id && entry.status === 'active');
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          user_role: user.role,
          status: user.status,
          team_role: member.role,
          joined_at: member.joined_at
        };
      })
      .filter(Boolean)
      .sort((left, right) => new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime());
  }

  static async getMembersCount(teamId) {
    const members = await this.getMembers(teamId);
    return members.length;
  }

  static async getUserTeams(userId) {
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
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }

  static async isMember(teamId, userId) {
    return teamMembers.some((entry) => entry.team_id === teamId && entry.user_id === userId);
  }

  static async getMemberRole(teamId, userId) {
    const member = teamMembers.find((entry) => entry.team_id === teamId && entry.user_id === userId);
    return member ? member.role : null;
  }

  static async getStats() {
    const total = teams.length;
    const active = teams.filter((entry) => entry.is_active).length;
    const membersByRole = teamMembers.reduce((accumulator, member) => {
      accumulator[member.role] = (accumulator[member.role] || 0) + 1;
      return accumulator;
    }, {});

    return {
      total,
      active,
      members_by_role: membersByRole
    };
  }
}

module.exports = Team;
