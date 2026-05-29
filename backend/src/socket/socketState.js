const connectedUsers = new Map();
let ioInstance = null;

const setIO = (io) => {
  ioInstance = io;
};

const addConnection = (userId, socketId) => {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }

  connectedUsers.get(userId).add(socketId);
};

const removeConnection = (userId, socketId) => {
  const userSockets = connectedUsers.get(userId);
  if (!userSockets) {
    return;
  }

  userSockets.delete(socketId);

  if (userSockets.size === 0) {
    connectedUsers.delete(userId);
  }
};

const emitToUser = (userId, event, payload) => {
  if (!ioInstance) {
    return false;
  }

  ioInstance.to(`user:${userId}`).emit(event, payload);
  return connectedUsers.has(userId);
};

const emitToTeam = (teamId, event, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`team:${teamId}`).emit(event, payload);
};

const isUserOnline = (userId) => connectedUsers.has(userId);

const getOnlineUserIds = () => Array.from(connectedUsers.keys());

const getOnlineUserCount = () => connectedUsers.size;

module.exports = {
  setIO,
  addConnection,
  removeConnection,
  emitToUser,
  emitToTeam,
  isUserOnline,
  getOnlineUserIds,
  getOnlineUserCount
};
