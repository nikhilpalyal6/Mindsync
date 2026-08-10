import mongoose from 'mongoose';

const mindMapNodeSchema = new mongoose.Schema(
  {
    mindMapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MindMap',
      required: true,
      index: true
    },
    nodeId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['ROOT', 'MAIN_TOPIC', 'SUB_TOPIC', 'FORMULA', 'PROCESS', 'DEFINITION', 'EXAMPLE'],
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    importance: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM'
    },
    color: {
      type: String,
      default: '#3b82f6'
    },
    sourceReference: {
      pageNumber: {
        type: Number,
        default: null
      },
      timestamp: {
        type: String,
        default: null
      },
      sectionTitle: {
        type: String,
        default: null
      }
    },
    position: {
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      }
    }
  }
);

// Compound index to speed up lookup by mindmap ID
mindMapNodeSchema.index({ mindMapId: 1, nodeId: 1 });

const MindMapNode = mongoose.model('MindMapNode', mindMapNodeSchema);
export default MindMapNode;
