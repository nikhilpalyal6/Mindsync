import mongoose from 'mongoose';

const studyTaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    studyPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyPlan',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    taskType: {
      type: String,
      enum: ['READ', 'WATCH', 'REVIEW', 'FLASHCARDS', 'QUIZ', 'EXPLAIN', 'PRACTICE', 'CUSTOM'],
      default: 'CUSTOM',
      required: true
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
      default: 'PENDING',
      required: true
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM'
    },
    resourceId: {
      type: String,
      default: null
    },
    order: {
      type: Number,
      default: 0
    },
    completedAt: {
      type: Date,
      default: null
    },
    originalScheduledDate: {
      type: Date,
      default: null
    },
    rescheduleCount: {
      type: Number,
      default: 0
    },
    rescheduleReason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexes
studyTaskSchema.index({ user: 1, scheduledDate: 1 });
studyTaskSchema.index({ studyPlanId: 1, scheduledDate: 1 });

const StudyTask = mongoose.model('StudyTask', studyTaskSchema);
export default StudyTask;
