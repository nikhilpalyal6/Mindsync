import mongoose from 'mongoose';

const pdfChatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const pdfChatSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      required: true,
      index: true
    },
    resourceId: {
      type: String,
      required: true,
      index: true
    },
    messages: [pdfChatMessageSchema]
  },
  {
    timestamps: true
  }
);

// Index for fast resource lookups
pdfChatSchema.index({ workspaceId: 1, resourceId: 1 });

const PDFChat = mongoose.model('PDFChat', pdfChatSchema);
export default PDFChat;
