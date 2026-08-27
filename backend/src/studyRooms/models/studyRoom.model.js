import mongoose from 'mongoose';

const studyRoomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Room title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [255, 'Title cannot exceed 255 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
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
        values: ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'],
        message: '{VALUE} is not a valid room status'
      },
      default: 'DRAFT',
      index: true
    },
    scheduledStart: {
      type: Date,
      default: null
    },
    scheduledEnd: {
      type: Date,
      default: null
    },
    actualStart: {
      type: Date,
      default: null
    },
    actualEnd: {
      type: Date,
      default: null
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [1000, 'Capacity cannot exceed 1000']
    },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE'],
      default: 'PUBLIC',
      index: true
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    workshopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
studyRoomSchema.index({ status: 1, scheduledStart: 1 });
studyRoomSchema.index({ scheduledStart: 1 });

// Store original status for transition validation
studyRoomSchema.post('init', function (doc) {
  doc._originalStatus = doc.status;
});
studyRoomSchema.post('save', function (doc) {
  doc._originalStatus = doc.status;
});

// Validations
studyRoomSchema.pre('validate', function (next) {
  // If scheduled, scheduledStart is required
  if (this.status === 'SCHEDULED' && !this.scheduledStart) {
    this.invalidate('scheduledStart', 'Scheduled start time is required for SCHEDULED rooms');
  }

  // Validate scheduled dates
  if (this.scheduledStart && this.scheduledEnd && this.scheduledStart >= this.scheduledEnd) {
    this.invalidate('scheduledEnd', 'Scheduled end must be after scheduled start');
  }

  next();
});

// Status transition guard: ended or cancelled rooms cannot be restarted or rescheduled
studyRoomSchema.pre('save', function (next) {
  if (this.isModified('status') && this._originalStatus) {
    const isTerminalState = this._originalStatus === 'ENDED' || this._originalStatus === 'CANCELLED';
    if (isTerminalState) {
      return next(new Error(`Cannot change status of a room that has already ${this._originalStatus.toLowerCase()}`));
    }
  }
  next();
});

const StudyRoom = mongoose.model('StudyRoom', studyRoomSchema);
export default StudyRoom;
