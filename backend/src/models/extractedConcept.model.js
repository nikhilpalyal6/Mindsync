import mongoose from 'mongoose';

const sourceReferenceSchema = new mongoose.Schema(
  {
    chunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeChunk',
      required: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeDocument',
      required: true
    },
    resourceId: {
      type: String,
      required: true
    },
    pageStart: { type: Number, default: null },
    pageEnd: { type: Number, default: null },
    timestampStart: { type: Number, default: null },
    timestampEnd: { type: Number, default: null }
  },
  { _id: false }
);

const extractedConceptSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      default: ''
    },
    importance: {
      type: Number,
      required: true,
      default: 0.5
    },
    sources: [sourceReferenceSchema]
  },
  {
    timestamps: true
  }
);

// Virtual property conceptId mapping to _id
extractedConceptSchema.virtual('conceptId').get(function() {
  return this._id;
});

extractedConceptSchema.set('toJSON', { virtuals: true });
extractedConceptSchema.set('toObject', { virtuals: true });

// Compound indexes for tenant isolation and uniqueness in deduplication
extractedConceptSchema.index({ user: 1, workspaceId: 1 });
extractedConceptSchema.index({ workspaceId: 1, normalizedName: 1 });

const ExtractedConcept = mongoose.model('ExtractedConcept', extractedConceptSchema);
export default ExtractedConcept;
