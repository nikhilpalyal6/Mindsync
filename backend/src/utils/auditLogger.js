import AuditLog from '../models/auditLog.model.js';
import { parseUserAgent } from './userAgent.utils.js';

export const logEvent = async ({
  userId = null,
  userName = null,
  email = null,
  role = 'GUEST',
  category,
  action,
  description,
  status = 'success',
  metadata = {},
  req = null
}) => {
  try {
    let finalUserId = userId;
    let finalUserName = userName;
    let finalEmail = email;
    let finalRole = role;
    let ipAddress = null;
    let userAgent = null;
    let browser = null;
    let os = null;
    let device = null;

    if (req) {
      // Extract IP address safely
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
      if (Array.isArray(ipAddress)) {
        ipAddress = ipAddress[0];
      }
      if (ipAddress && ipAddress.includes('::ffff:')) {
        ipAddress = ipAddress.replace('::ffff:', '');
      }

      // Parse user agent using existing utility
      userAgent = req.headers['user-agent'] || null;
      if (userAgent) {
        const uaResult = parseUserAgent(userAgent);
        browser = uaResult.browser;
        os = uaResult.os;
        device = uaResult.device || 'Desktop';
      }

      // If user is authenticated in request context
      if (req.user) {
        finalUserId = req.user._id || finalUserId;
        finalUserName = req.user.name || finalUserName;
        finalEmail = req.user.email || finalEmail;
        finalRole = req.user.role || finalRole;
      }
    }

    const logEntry = new AuditLog({
      userId: finalUserId,
      userName: finalUserName,
      email: finalEmail,
      role: finalRole,
      category,
      action,
      description,
      ipAddress,
      userAgent,
      browser,
      os,
      device,
      status,
      metadata
    });

    await logEntry.save();
  } catch (error) {
    console.error('AuditLogger error:', error.message);
  }
};

export default { logEvent };
