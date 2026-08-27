import mongoose from 'mongoose';

const pauseIntervalSchema = new mongoose.Schema(
  {
    pausedAt: {
      type: Date,
      required: true
    },
    resumedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const studyRoomFocusSessionSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoom',
      required: [true, 'Room reference is required'],
      index: true
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host is required'],
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
        message: '{VALUE} is not a valid focus session status'
      },
      default: 'PENDING'
    },
    startedAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    plannedDuration: {
      type: Number,
      required: [true, 'Planned duration is required'],
      min: [1, 'Planned duration must be at least 1 minute']
    },
    actualDuration: {
      type: Number,
      default: 0,
      min: [0, 'Actual duration cannot be negative']
    },
    pauseHistory: [pauseIntervalSchema]
  },
  {
    timestamps: true
  }
);

// Indexes
studyRoomFocusSessionSchema.index({ room: 1, status: 1 });

// Validations and state changes
studyRoomFocusSessionSchema.pre('validate', function (next) {
  if (this.status === 'ACTIVE' && !this.startedAt) {
    this.startedAt = new Date();
  }
  if (['COMPLETED', 'CANCELLED'].includes(this.status) && !this.endedAt) {
    this.endedAt = new Date();
  }
  next();
});

const StudyRoomFocusSession = mongoose.model('StudyRoomFocusSession', studyRoomFocusSessionSchema);
export default StudyRoomFocusSession;
