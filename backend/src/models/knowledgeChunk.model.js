import mongoose from 'mongoose';

const knowledgeChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeDocument',
      required: true,
      index: true
    },
    resourceId: {
      type: String,
      required: true,
      index: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    text: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      required: true
    },
    metadata: {
      pageStart: { type: Number, default: null },
      pageEnd: { type: Number, default: null },
      timestampStart: { type: Number, default: null },
      timestampEnd: { type: Number, default: null },
      section: { type: String, default: '' },
      heading: { type: String, default: '' }
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    documentVersion: {
      type: Number,
      default: 1
    },
    contentHash: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for strict scoping & authorization
knowledgeChunkSchema.index({ userId: 1, workspaceId: 1, resourceId: 1 });

// Text index for keyword retrieval
knowledgeChunkSchema.index({ text: 'text' });

const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);
export default KnowledgeChunk;
