import mongoose from 'mongoose';

const studyRoomGoalSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: [true, 'Goal title is required'],
      trim: true,
      minlength: [1, 'Goal title cannot be empty'],
      maxlength: [255, 'Goal title cannot exceed 255 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    studyTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyTask',
      default: null,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['ACTIVE', 'COMPLETED', 'ABANDONED'],
        message: '{VALUE} is not a valid goal status'
      },
      default: 'ACTIVE',
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
studyRoomGoalSchema.index({ room: 1, user: 1, status: 1 });

// Goal state completedAt update middleware
studyRoomGoalSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'COMPLETED') {
      this.completedAt = new Date();
    } else {
      this.completedAt = null;
    }
  }
  next();
});

const StudyRoomGoal = mongoose.model('StudyRoomGoal', studyRoomGoalSchema);
export default StudyRoomGoal;
