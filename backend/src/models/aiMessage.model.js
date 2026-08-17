import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      min: 1
    },
    chunkId: {
      type: String,
      required: true
    },
    documentId: {
      type: String,
      required: true
    },
    resourceId: {
      type: String,
      required: true
    },
    workspaceId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['pdf', 'youtube', 'notes']
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0
    },
    pageStart: {
      type: Number,
      required: false
    },
    pageEnd: {
      type: Number,
      required: false
    },
    timestampStart: {
      type: Number,
      required: false
    },
    timestampEnd: {
      type: Number,
      required: false
    }
  },
  {
    _id: false
  }
);

const aiMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['system', 'user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    attachments: {
      type: Array,
      default: [],
    },
    citations: {
      type: [citationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

aiMessageSchema.index({ conversation: 1, createdAt: 1 });

const AIMessage = mongoose.model('AIMessage', aiMessageSchema);
export default AIMessage;
