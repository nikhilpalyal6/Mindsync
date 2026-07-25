import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    userName: {
      type: String,
      default: null
    },
    email: {
      type: String,
      default: null
    },
    role: {
      type: String,
      default: 'GUEST'
    },
    category: {
      type: String,
      required: true,
      enum: ['authentication', 'user_action', 'admin_action', 'security_event', 'system_event'],
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    description: {
      type: String,
      required: true
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    browser: {
      type: String,
      default: null
    },
    os: {
      type: String,
      default: null
    },
    device: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['success', 'failure', 'warning', 'info'],
      default: 'success',
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Optimize query indexes
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
