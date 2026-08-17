import mongoose from 'mongoose';

const knowledgeDocumentSchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: ['PDF', 'YOUTUBE'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      url: { type: String, default: '' },
      filename: { type: String, default: '' },
      platform: { type: String, default: '' }
    },
    youtubeData: {
      videoId: { type: String },
      videoUrl: { type: String },
      authorName: { type: String },
      authorUrl: { type: String },
      thumbnailUrl: { type: String },
      duration: { type: String },
      publishedDate: { type: String },
      chapters: [{
        time: { type: String },
        title: { type: String }
      }]
    },
    metadata: {
      language: { type: String, default: 'en' },
      wordCount: { type: Number, default: 0 },
      pageCount: { type: Number, default: 0 },
      duration: { type: Number, default: 0 },
      extractedAt: { type: Date, default: Date.now },
      chapters: [{
        time: { type: String },
        title: { type: String }
      }]
    },
    contentHash: {
      type: String,
      required: true,
      index: true
    },
    documentVersion: {
      type: Number,
      default: 1
    },
    processingVersion: {
      type: Number,
      default: 1
    },
    chunkingVersion: {
      type: Number,
      default: 1
    },
    embeddingModel: {
      type: String,
      required: true
    },
    embeddingStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    embeddingError: {
      type: String,
      default: null
    },
    processingStatus: {
      type: String,
      enum: ['PENDING', 'NORMALIZING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'READY', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    chunkCount: {
      type: Number,
      default: 0
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index to quickly retrieve documents for a user workspace/resource
knowledgeDocumentSchema.index({ userId: 1, workspaceId: 1, resourceId: 1 });

const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
export default KnowledgeDocument;
