const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

class TelegramService {
  static bot = null;

  static async initializeBot() {
    if (this.bot) {
      return this.bot;
    }

    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not configured');
      }

      this.bot = new TelegramBot(token, { polling: false });
      
      // Test the bot
      await this.bot.getMe();
      logger.info('Telegram bot initialized successfully');
      
      return this.bot;
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  static async sendNotification(notification, user) {
    try {
      await this.initializeBot();

      if (!user.telegram_chat_id) {
        throw new Error('User does not have Telegram chat ID configured');
      }

      const message = this.formatMessage(notification, user);
      
      const result = await this.bot.sendMessage(user.telegram_chat_id, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      logger.info(`Telegram notification sent to ${user.email}: ${result.message_id}`);
      
      return {
        success: true,
        messageId: result.message_id,
        channel: 'telegram'
      };
    } catch (error) {
      logger.error(`Failed to send Telegram notification to ${user.email}:`, error);
      throw error;
    }
  }

  static formatMessage(notification, user) {
    const priorityIcons = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const typeIcons = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };

    const priorityIcon = priorityIcons[notification.priority] || priorityIcons.medium;
    const typeIcon = typeIcons[notification.type] || typeIcons.info;

    let message = `${priorityIcon} <b>${notification.title}</b>\n\n`;
    message += `${typeIcon} ${notification.message}\n\n`;
    
    message += `<b>Details:</b>\n`;
    message += `🔹 Priority: ${notification.priority}\n`;
    message += `🔹 Type: ${notification.type}\n`;
    message += `🔹 Date: ${new Date(notification.created_at).toLocaleString()}\n`;
    
    if (Object.keys(notification.metadata || {}).length > 0) {
      message += `\n<b>Additional Information:</b>\n`;
      Object.entries(notification.metadata).forEach(([key, value]) => {
        const formattedKey = this.formatMetadataKey(key);
        const formattedValue = this.formatMetadataValue(value);
        message += `🔹 ${formattedKey}: ${formattedValue}\n`;
      });
    }
    
    message += `\n<i>Sent to: ${user.first_name} ${user.last_name}</i>`;
    
    return message;
  }

  static formatMetadataKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  static formatMetadataValue(value) {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  static async getChatLink(user) {
    try {
      await this.initializeBot();
      
      // Generate a deep link for the bot
      const botInfo = await this.bot.getMe();
      const deepLink = `https://t.me/${botInfo.username}?start=${user.id}`;
      
      return {
        success: true,
        deepLink,
        instructions: `1. Click on the link: ${deepLink}\n2. Start the bot by sending /start\n3. Your Telegram will be automatically linked to your account`
      };
    } catch (error) {
      logger.error('Error generating Telegram chat link:', error);
      throw error;
    }
  }

  static async handleWebhook(req, res) {
    try {
      await this.initializeBot();
      
      // Process the webhook update
      this.bot.processUpdate(req.body);
      
      res.status(200).send('OK');
    } catch (error) {
      logger.error('Error processing Telegram webhook:', error);
      res.status(500).send('Error processing webhook');
    }
  }

  static async setupWebhook(webhookUrl) {
    try {
      await this.initializeBot();
      
      await this.bot.setWebHook(webhookUrl);
      logger.info(`Telegram webhook set to: ${webhookUrl}`);
      
      return { success: true, webhookUrl };
    } catch (error) {
      logger.error('Error setting Telegram webhook:', error);
      throw error;
    }
  }

  static async removeWebhook() {
    try {
      await this.initializeBot();
      
      await this.bot.deleteWebHook();
      logger.info('Telegram webhook removed');
      
      return { success: true };
    } catch (error) {
      logger.error('Error removing Telegram webhook:', error);
      throw error;
    }
  }

  static async testConnection() {
    try {
      await this.initializeBot();
      const botInfo = await this.bot.getMe();
      
      return { 
        success: true, 
        message: 'Telegram bot is working correctly',
        botInfo: {
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.first_name
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async linkUserChat(userId, chatId) {
    try {
      const User = require('../models/User');
      
      await User.update(userId, {
        telegram_chat_id: chatId,
        telegram_notifications: true
      });

      logger.info(`User ${userId} linked to Telegram chat ${chatId}`);
      
      return { success: true, message: 'Telegram account linked successfully' };
    } catch (error) {
      logger.error('Error linking user Telegram chat:', error);
      throw error;
    }
  }

  static async unlinkUserChat(userId) {
    try {
      const User = require('../models/User');
      
      await User.update(userId, {
        telegram_chat_id: null,
        telegram_notifications: false
      });

      logger.info(`User ${userId} unlinked from Telegram`);
      
      return { success: true, message: 'Telegram account unlinked successfully' };
    } catch (error) {
      logger.error('Error unlinking user Telegram chat:', error);
      throw error;
    }
  }
}

module.exports = TelegramService;
