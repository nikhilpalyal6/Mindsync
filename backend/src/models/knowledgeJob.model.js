import mongoose from 'mongoose';

const knowledgeJobSchema = new mongoose.Schema(
  {
    resourceId: {
      type: String,
      required: true,
      index: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'NORMALIZING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'READY', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    progress: {
      type: Number,
      default: 0
    },
    errorCode: {
      type: String,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    lastAttemptAt: {
      type: Date
    },
    lockedAt: {
      type: Date,
      default: null
    },
    lockedBy: {
      type: String,
      default: null
    },
    heartbeatAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index to guarantee one job per resource
knowledgeJobSchema.index({ userId: 1, workspaceId: 1, resourceId: 1 }, { unique: true });

const KnowledgeJob = mongoose.model('KnowledgeJob', knowledgeJobSchema);
export default KnowledgeJob;
