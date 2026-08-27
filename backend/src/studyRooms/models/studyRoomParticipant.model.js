import mongoose from 'mongoose';
import ApiError from '../../utils/ApiError.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const studyRoomParticipantSchema = new mongoose.Schema(
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
      required: [true, 'User reference is required'],
      index: true
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: ['HOST', 'STUDENT'],
        message: '{VALUE} is not a valid participant role'
      },
      default: 'STUDENT'
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['invited', 'joined', 'active', 'left', 'removed'],
        message: '{VALUE} is not a valid participant status'
      },
      default: 'joined',
      index: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date,
      default: null
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now
    },
    cameraState: {
      isCameraOn: {
        type: Boolean,
        default: false
      },
      isMicOn: {
        type: Boolean,
        default: false
      },
      isScreenSharing: {
        type: Boolean,
        default: false
      }
    },
    presenceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Enforce unique compound index so a user has at most one record per room
studyRoomParticipantSchema.index({ room: 1, user: 1 }, { unique: true });

// Index for query: active rooms a user is currently in
studyRoomParticipantSchema.index({ user: 1, status: 1 });

studyRoomParticipantSchema.pre('save', async function (next) {
  // Only check capacity on new record or when transitioning to an active status ('joined' or 'active')
  const statusTransitionToActive = (this.isNew || this.isModified('status')) && ['joined', 'active'].includes(this.status);
  
  if (statusTransitionToActive) {
    const StudyRoom = mongoose.model('StudyRoom');
    const room = await StudyRoom.findById(this.room);
    if (!room) {
      return next(ApiError.notFound('Study room not found'));
    }

    // If host, capacity check is bypassed, or we can count active members
    // Count active participants (excluding current participant to be idempotent on updates)
    const activeCount = await this.constructor.countDocuments({
      room: this.room,
      _id: { $ne: this._id },
      status: { $in: ['joined', 'active'] }
    });

    if (activeCount >= room.capacity) {
      return next(new ApiError(HTTP_STATUS.CONFLICT, 'Cannot join room: capacity exceeded'));
    }
  }

  // Set joinedAt/leftAt timestamps based on status
  if (this.isModified('status')) {
    if (['joined', 'active'].includes(this.status)) {
      this.joinedAt = new Date();
      this.leftAt = null;
    } else if (['left', 'removed'].includes(this.status)) {
      this.leftAt = new Date();
    }
  }

  next();
});

const StudyRoomParticipant = mongoose.model('StudyRoomParticipant', studyRoomParticipantSchema);
export default StudyRoomParticipant;
