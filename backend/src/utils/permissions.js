const roleCapabilities = {
  admin: {
    broadcastAll: true,
    messageIndividuals: true,
    messageTeams: true,
    createNotifications: true,
    manageUsers: true,
    viewGlobalNotifications: true,
    viewSystemStats: true,
    directoryScope: 'all',
    label: 'Administrator'
  },
  manager: {
    broadcastAll: false,
    messageIndividuals: true,
    messageTeams: true,
    createNotifications: true,
    manageUsers: false,
    viewGlobalNotifications: true,
    viewSystemStats: true,
    directoryScope: 'shared',
    label: 'Manager'
  },
  developer: {
    broadcastAll: false,
    messageIndividuals: false,
    messageTeams: true,
    createNotifications: true,
    manageUsers: false,
    viewGlobalNotifications: false,
    viewSystemStats: false,
    directoryScope: 'none',
    label: 'Developer'
  },
  tester: {
    broadcastAll: false,
    messageIndividuals: false,
    messageTeams: false,
    createNotifications: false,
    manageUsers: false,
    viewGlobalNotifications: false,
    viewSystemStats: false,
    directoryScope: 'none',
    label: 'Tester'
  }
};

const getRoleCapabilities = (role) => {
  return roleCapabilities[role] || roleCapabilities.developer;
};

module.exports = {
  getRoleCapabilities
};
