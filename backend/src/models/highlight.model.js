import mongoose from 'mongoose';

const highlightSchema = new mongoose.Schema({
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
    min: 1,
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['important', 'concept', 'definition', 'formula', 'personal'],
    required: true,
    default: 'important'
  },
  source: {
    type: String,
    enum: ['manual', 'ai'],
    required: true,
    default: 'manual'
  },
  rects: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  }]
}, {
  timestamps: true
});

// Compound index for optimal querying by resource page for a specific user
highlightSchema.index({ userId: 1, resourceId: 1, pageNumber: 1 });

const Highlight = mongoose.model('Highlight', highlightSchema);
export default Highlight;
