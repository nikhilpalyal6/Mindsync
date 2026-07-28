import mongoose from 'mongoose';

const studySessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    pinned: {
      type: Boolean,
      default: false,
      index: true
    },
    lastOpened: {
      type: Date,
      default: Date.now,
      index: true
    },
    pdfCount: {
      type: Number,
      default: 0
    },
    youtubeCount: {
      type: Number,
      default: 0
    },
    notesCount: {
      type: Number,
      default: 0
    },
    flashcardsCount: {
      type: Number,
      default: 0
    },
    quizCount: {
      type: Number,
      default: 0
    },
    chatCount: {
      type: Number,
      default: 0
    },
    resources: {
      type: Array,
      default: []
    },
    resourceCount: {
      type: Number,
      default: 0
    },
    videoCount: {
      type: Number,
      default: 0
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

// Indexes for fast querying
studySessionSchema.index({ user: 1, pinned: -1, lastOpened: -1 });
studySessionSchema.index({ user: 1, title: 1 });

const StudySession = mongoose.model('StudySession', studySessionSchema);
export default StudySession;
