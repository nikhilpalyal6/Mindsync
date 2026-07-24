
import mongoose from 'mongoose';

const userPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    language: {
      type: String,
      default: 'en',
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    studyReminder: {
      type: Boolean,
      default: true,
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY',
    },
    timeFormat: {
      type: String,
      enum: ['12', '24'],
      default: '12',
    },
    landingPage: {
      type: String,
      default: '/study-mode',
    },
    animations: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

export default UserPreferences;
