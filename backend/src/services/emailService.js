const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  static transporter = null;

  static async initializeTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection
      await this.transporter.verify();
      logger.info('Email service initialized successfully');
      
      return this.transporter;
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  static async sendNotification(notification, user) {
    try {
      await this.initializeTransporter();

      const subject = this.formatSubject(notification);
      const html = this.formatHtmlMessage(notification, user);
      const text = this.formatTextMessage(notification, user);

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: user.email,
        subject,
        text,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent to ${user.email}: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        channel: 'email'
      };
    } catch (error) {
      logger.error(`Failed to send email to ${user.email}:`, error);
      throw error;
    }
  }

  static formatSubject(notification) {
    const priorityPrefix = {
      low: '[INFO]',
      medium: '[NOTIFICATION]',
      high: '[IMPORTANT]',
      critical: '[URGENT]'
    };

    const prefix = priorityPrefix[notification.priority] || '[NOTIFICATION]';
    return `${prefix} ${notification.title}`;
  }

  static formatHtmlMessage(notification, user) {
    const typeColors = {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      success: '#10b981'
    };

    const priorityIcons = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const color = typeColors[notification.type] || typeColors.info;
    const icon = priorityIcons[notification.priority] || priorityIcons.medium;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${notification.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .header {
            background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
            padding: 30px;
            border-radius: 12px 12px 0 0;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .priority {
            font-size: 48px;
            margin: 10px 0;
        }
        .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .message {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 25px;
            white-space: pre-wrap;
        }
        .metadata {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .metadata-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .metadata-label {
            font-weight: 600;
            color: #64748b;
        }
        .metadata-value {
            color: #334155;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding: 20px;
            color: #64748b;
            font-size: 14px;
        }
        .type-badge {
            display: inline-block;
            padding: 4px 12px;
            background: ${color}20;
            color: ${color};
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="priority">${icon}</div>
        <h1>${notification.title}</h1>
    </div>
    
    <div class="content">
        <div class="type-badge">${notification.type}</div>
        
        <div class="message">
            ${notification.message}
        </div>
        
        ${Object.keys(notification.metadata || {}).length > 0 ? `
        <div class="metadata">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #334155;">Additional Information</h3>
            ${Object.entries(notification.metadata).map(([key, value]) => `
                <div class="metadata-item">
                    <span class="metadata-label">${this.formatMetadataKey(key)}:</span>
                    <span class="metadata-value">${this.formatMetadataValue(value)}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="metadata">
            <div class="metadata-item">
                <span class="metadata-label">Priority:</span>
                <span class="metadata-value">${notification.priority}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Sent to:</span>
                <span class="metadata-value">${user.first_name} ${user.last_name}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Date:</span>
                <span class="metadata-value">${new Date(notification.created_at).toLocaleString()}</span>
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p>This notification was sent by the IT Team Notification System.</p>
        <p>If you didn't expect to receive this email, please contact your system administrator.</p>
    </div>
</body>
</html>`;
  }

  static formatTextMessage(notification, user) {
    const priorityPrefix = {
      low: '[INFO]',
      medium: '[NOTIFICATION]',
      high: '[IMPORTANT]',
      critical: '[URGENT]'
    };

    const prefix = priorityPrefix[notification.priority] || '[NOTIFICATION]';
    
    let message = `${prefix} ${notification.title}\n\n`;
    message += `${notification.message}\n\n`;
    message += `---\n`;
    message += `Priority: ${notification.priority}\n`;
    message += `Type: ${notification.type}\n`;
    message += `Sent to: ${user.first_name} ${user.last_name}\n`;
    message += `Date: ${new Date(notification.created_at).toLocaleString()}\n`;
    
    if (Object.keys(notification.metadata || {}).length > 0) {
      message += `\nAdditional Information:\n`;
      Object.entries(notification.metadata).forEach(([key, value]) => {
        message += `${this.formatMetadataKey(key)}: ${this.formatMetadataValue(value)}\n`;
      });
    }
    
    message += `\n---\n`;
    message += `This notification was sent by the IT Team Notification System.`;
    
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

  static async testConnection() {
    try {
      await this.initializeTransporter();
      return { success: true, message: 'Email service is working correctly' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;
