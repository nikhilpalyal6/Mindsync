import mongoose from 'mongoose';

const studyActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      default: null
    },
    sessionTitle: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      required: true,
      enum: ['created', 'renamed', 'opened', 'deleted', 'pinned', 'unpinned']
    },
    details: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

studyActivitySchema.index({ user: 1, createdAt: -1 });

const StudyActivity = mongoose.model('StudyActivity', studyActivitySchema);
export default StudyActivity;
