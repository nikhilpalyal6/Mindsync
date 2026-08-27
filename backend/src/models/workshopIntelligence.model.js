import mongoose from 'mongoose';

const workshopIntelligenceSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'],
      default: 'NOT_STARTED',
      required: true,
      index: true
    },
    version: {
      type: Number,
      default: 1,
      required: true
    },
    resourceCount: {
      type: Number,
      default: 0,
      required: true
    },
    processedResourceCount: {
      type: Number,
      default: 0,
      required: true
    },
    error: {
      type: String,
      default: null
    },
    resources: [
      {
        resourceId: { type: String, required: true },
        title: { type: String },
        provider: { type: String },
        status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
        error: { type: String, default: null },
        conceptCount: { type: Number, default: 0 }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Compound unique index for user + workspace lookup to enforce idempotency
workshopIntelligenceSchema.index({ user: 1, workspaceId: 1 }, { unique: true });

const WorkshopIntelligence = mongoose.model('WorkshopIntelligence', workshopIntelligenceSchema);
export default WorkshopIntelligence;
