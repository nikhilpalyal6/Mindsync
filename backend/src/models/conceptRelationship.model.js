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

const conceptRelationshipSchema = new mongoose.Schema(
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
    sourceConceptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExtractedConcept',
      required: true
    },
    targetConceptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExtractedConcept',
      required: true
    },
    relationshipType: {
      type: String,
      enum: ['PREREQUISITE_OF', 'RELATED_TO', 'PART_OF', 'EXPLAINS', 'LEADS_TO', 'CONTRASTS_WITH'],
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    sources: [sourceReferenceSchema]
  },
  {
    timestamps: true
  }
);

// Compound index for user/workspace tenant lookup
conceptRelationshipSchema.index({ user: 1, workspaceId: 1 });

// Compound unique index to prevent duplicate relationships within a workspace
conceptRelationshipSchema.index(
  { workspaceId: 1, sourceConceptId: 1, targetConceptId: 1, relationshipType: 1 },
  { unique: true }
);

const ConceptRelationship = mongoose.model('ConceptRelationship', conceptRelationshipSchema);
export default ConceptRelationship;
