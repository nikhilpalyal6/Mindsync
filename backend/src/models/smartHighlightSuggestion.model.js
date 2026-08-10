import mongoose from 'mongoose';

const smartHighlightSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    required: true,
    index: true
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1
  },
  text: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  importance: {
    type: Number,
    required: false,
    min: 0,
    max: 1,
    default: 0.75
  },
  importanceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 75
  },
  importanceLevel: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 75
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['suggested', 'accepted', 'rejected'],
    default: 'suggested',
    required: true
  }
}, {
  timestamps: true
});

smartHighlightSuggestionSchema.index({ userId: 1, resourceId: 1, status: 1 });
smartHighlightSuggestionSchema.index({ userId: 1, resourceId: 1, pageNumber: 1, status: 1 });

const SmartHighlightSuggestion = mongoose.model('SmartHighlightSuggestion', smartHighlightSuggestionSchema);
export default SmartHighlightSuggestion;
