import mongoose from 'mongoose';

const studyRoomActivityLogSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoom',
      required: [true, 'Room reference is required'],
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: [
          'ROOM_CREATED',
          'ROOM_STARTED',
          'ROOM_ENDED',
          'ROOM_LOCKED',
          'ROOM_UNLOCKED',
          'PARTICIPANT_JOINED',
          'PARTICIPANT_LEFT',
          'PARTICIPANT_REMOVED',
          'FOCUS_STARTED',
          'FOCUS_PAUSED',
          'FOCUS_RESUMED',
          'FOCUS_ENDED',
          'GOAL_CREATED',
          'GOAL_COMPLETED'
        ],
        message: '{VALUE} is not a valid room event type'
      }
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound index for rendering room timelines
studyRoomActivityLogSchema.index({ room: 1, timestamp: -1 });

const StudyRoomActivityLog = mongoose.model('StudyRoomActivityLog', studyRoomActivityLogSchema);
export default StudyRoomActivityLog;
