const serverUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'IT Team Notification System API',
    version: '2.0.0',
    description: 'API for the IT team notification system with role-based access, realtime delivery, browser push, and automatic read tracking.'
  },
  servers: [
    {
      url: serverUrl,
      description: 'Application server'
    }
  ],
  tags: [
    { name: 'Health', description: 'Service health checks' },
    { name: 'Auth', description: 'Authentication and session endpoints' },
    { name: 'Users', description: 'User directory and profile management' },
    { name: 'Teams', description: 'Teams and membership management' },
    { name: 'Notifications', description: 'Notification delivery and feed endpoints' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      RolePermissions: {
        type: 'object',
        properties: {
          broadcastAll: { type: 'boolean' },
          messageIndividuals: { type: 'boolean' },
          messageTeams: { type: 'boolean' },
          createNotifications: { type: 'boolean' },
          manageUsers: { type: 'boolean' },
          viewGlobalNotifications: { type: 'boolean' },
          viewSystemStats: { type: 'boolean' },
          directoryScope: { type: 'string', enum: ['all', 'shared', 'none'] },
          label: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'manager', 'developer', 'tester'] },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          phone: { type: 'string', nullable: true },
          emailNotifications: { type: 'boolean' },
          pushNotifications: { type: 'boolean' },
          telegramNotifications: { type: 'boolean' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          permissions: {
            $ref: '#/components/schemas/RolePermissions'
          }
        }
      },
      Team: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          is_active: { type: 'boolean' },
          member_role: { type: 'string', enum: ['owner', 'admin', 'member'] },
          members_count: { type: 'integer' }
        }
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['web', 'email', 'telegram', 'slack', 'push']
            }
          },
          created_by: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          recipient_status: { type: 'string', enum: ['pending', 'delivered', 'read', 'failed'] },
          read_at: { type: 'string', format: 'date-time', nullable: true },
          delivered_at: { type: 'string', format: 'date-time', nullable: true },
          metadata: {
            type: 'object',
            additionalProperties: true
          }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string' },
          refreshToken: { type: 'string' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' }
        }
      },
      CreateNotificationRequest: {
        type: 'object',
        required: ['title', 'message', 'recipients'],
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['web', 'email', 'telegram', 'slack', 'push']
            }
          },
          recipients: {
            oneOf: [
              { type: 'string', enum: ['all'] },
              {
                type: 'array',
                items: {
                  oneOf: [
                    { type: 'string', format: 'uuid' },
                    {
                      type: 'object',
                      properties: {
                        userId: { type: 'string', format: 'uuid' },
                        teamId: { type: 'string', format: 'uuid' }
                      }
                    }
                  ]
                }
              }
            ]
          },
          scheduledFor: { type: 'string', format: 'date-time' }
        }
      },
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            additionalProperties: true
          }
        }
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          error: { type: 'string' }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Get service health',
        security: [],
        responses: {
          200: {
            description: 'Service is healthy'
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterRequest'
              }
            }
          }
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SuccessEnvelope'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive JWT tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Authenticated session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SuccessEnvelope'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh an access token',
        security: [],
        responses: {
          200: {
            description: 'Tokens refreshed'
          }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
        responses: {
          200: {
            description: 'Current user'
          }
        }
      }
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'Get visible users for the current role',
        parameters: [
          { in: 'query', name: 'role', schema: { type: 'string' } },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'search', schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'User directory slice'
          }
        }
      }
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get a user profile',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          200: {
            description: 'User profile'
          }
        }
      },
      put: {
        tags: ['Users'],
        summary: 'Update a user profile',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          200: {
            description: 'User updated'
          }
        }
      }
    },
    '/api/teams': {
      get: {
        tags: ['Teams'],
        summary: 'Get teams visible to the current user',
        responses: {
          200: {
            description: 'Teams list'
          }
        }
      },
      post: {
        tags: ['Teams'],
        summary: 'Create a new team',
        responses: {
          201: {
            description: 'Team created'
          }
        }
      }
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get global notification list for admins and managers',
        responses: {
          200: {
            description: 'Notifications list'
          }
        }
      },
      post: {
        tags: ['Notifications'],
        summary: 'Create and deliver a notification',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateNotificationRequest'
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Notification created'
          }
        }
      }
    },
    '/api/notifications/me': {
      get: {
        tags: ['Notifications'],
        summary: 'Get current user feed and auto-mark it as read',
        responses: {
          200: {
            description: 'Notification feed'
          }
        }
      }
    },
    '/api/notifications/me/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'Get unread count after auto-read processing',
        responses: {
          200: {
            description: 'Unread counter'
          }
        }
      }
    }
  }
};
