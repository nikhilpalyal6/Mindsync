import mongoose from 'mongoose';

const smartHighlightPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    categoryPreferences: {
      type: Map,
      of: Number,
      default: () => new Map()
    },
    acceptedCount: {
      type: Number,
      default: 0
    },
    rejectedCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const SmartHighlightPreference = mongoose.model('SmartHighlightPreference', smartHighlightPreferenceSchema);
export default SmartHighlightPreference;
