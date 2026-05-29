const axios = require('axios');
const logger = require('../utils/logger');

class SlackService {
  static botToken = process.env.SLACK_BOT_TOKEN;
  static signingSecret = process.env.SLACK_SIGNING_SECRET;

  static async sendMessage(channel, message) {
    try {
      if (!this.botToken) {
        throw new Error('SLACK_BOT_TOKEN is not configured');
      }

      const response = await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        ...message
      }, {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Error sending Slack message:', error);
      throw error;
    }
  }

  static async sendNotification(notification, user) {
    try {
      const message = this.formatMessage(notification, user);
      
      // Try to find user by email and send DM
      const userLookup = await this.findUserByEmail(user.email);
      
      if (userLookup.ok && userLookup.user.id) {
        const result = await this.sendMessage(userLookup.user.id, message);
        
        logger.info(`Slack notification sent to ${user.email}: ${result.ts}`);
        
        return {
          success: true,
          messageId: result.ts,
          channel: 'slack'
        };
      } else {
        throw new Error('User not found in Slack or bot does not have permission to send DM');
      }
    } catch (error) {
      logger.error(`Failed to send Slack notification to ${user.email}:`, error);
      throw error;
    }
  }

  static async findUserByEmail(email) {
    try {
      if (!this.botToken) {
        throw new Error('SLACK_BOT_TOKEN is not configured');
      }

      const response = await axios.get('https://slack.com/api/users.lookupByEmail', {
        params: { email },
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error finding Slack user by email:', error);
      throw error;
    }
  }

  static formatMessage(notification, user) {
    const priorityColors = {
      low: '#3b82f6',
      medium: '#f59e0b',
      high: '#f97316',
      critical: '#ef4444'
    };

    const typeIcons = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':x:',
      success: ':white_check_mark:'
    };

    const color = priorityColors[notification.priority] || priorityColors.medium;
    const icon = typeIcons[notification.type] || typeIcons.info;

    const message = {
      text: `${icon} ${notification.title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${icon} ${notification.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n${notification.message}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Priority:* ${notification.priority} | *Type:* ${notification.type} | *Date:* ${new Date(notification.created_at).toLocaleString()}`
            }
          ]
        }
      ],
      attachments: []
    };

    // Add metadata if present
    if (Object.keys(notification.metadata || {}).length > 0) {
      const metadataFields = Object.entries(notification.metadata).map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${this.formatMetadataKey(key)}:*\n${this.formatMetadataValue(value)}`
      }));

      message.attachments.push({
        color,
        fields: metadataFields,
        footer: 'IT Team Notification System',
        ts: Math.floor(new Date(notification.created_at).getTime() / 1000)
      });
    } else {
      message.attachments.push({
        color,
        footer: 'IT Team Notification System',
        ts: Math.floor(new Date(notification.created_at).getTime() / 1000)
      });
    }

    return message;
  }

  static formatMetadataKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  static formatMetadataValue(value) {
    if (typeof value === 'object') {
      return '```' + JSON.stringify(value, null, 2) + '```';
    }
    return String(value);
  }

  static async getChannels() {
    try {
      if (!this.botToken) {
        throw new Error('SLACK_BOT_TOKEN is not configured');
      }

      const response = await axios.get('https://slack.com/api/conversations.list', {
        params: {
          types: 'public_channel,private_channel,im,mpim',
          limit: 100
        },
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }

      return response.data.channels;
    } catch (error) {
      logger.error('Error getting Slack channels:', error);
      throw error;
    }
  }

  static async testConnection() {
    try {
      if (!this.botToken) {
        return { success: false, error: 'SLACK_BOT_TOKEN is not configured' };
      }

      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.ok) {
        return { 
          success: true, 
          message: 'Slack bot is working correctly',
          botInfo: {
            user: response.data.user,
            team: response.data.team,
            url: response.data.url
          }
        };
      } else {
        return { success: false, error: response.data.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async sendToChannel(channelNameOrId, notification, user) {
    try {
      const message = this.formatMessage(notification, user);
      message.text = `${notification.title} (sent to #${channelNameOrId})`;
      
      const result = await this.sendMessage(channelNameOrId, message);
      
      logger.info(`Slack notification sent to channel ${channelNameOrId}: ${result.ts}`);
      
      return {
        success: true,
        messageId: result.ts,
        channel: 'slack',
        channelName: channelNameOrId
      };
    } catch (error) {
      logger.error(`Failed to send Slack notification to channel ${channelNameOrId}:`, error);
      throw error;
    }
  }

  static async verifyRequestSignature(body, signature, timestamp) {
    try {
      const crypto = require('crypto');
      
      if (!this.signingSecret) {
        throw new Error('SLACK_SIGNING_SECRET is not configured');
      }

      const time = Math.floor(new Date().getTime() / 1000);
      if (Math.abs(time - timestamp) > 300) {
        throw new Error('Request timestamp too old');
      }

      const sigBasestring = `v0:${timestamp}:${body}`;
      const mySignature = 'v0=' + crypto
        .createHmac('sha256', this.signingSecret)
        .update(sigBasestring, 'utf8')
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(mySignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (error) {
      logger.error('Error verifying Slack request signature:', error);
      return false;
    }
  }
}

module.exports = SlackService;
