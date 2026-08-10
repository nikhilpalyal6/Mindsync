import mongoose from 'mongoose';

const mindMapEdgeSchema = new mongoose.Schema(
  {
    mindMapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MindMap',
      required: true,
      index: true
    },
    sourceNode: {
      type: String,
      required: true
    },
    targetNode: {
      type: String,
      required: true
    },
    relationship: {
      type: String,
      default: 'relates_to'
    }
  }
);

mindMapEdgeSchema.index({ mindMapId: 1 });

const MindMapEdge = mongoose.model('MindMapEdge', mindMapEdgeSchema);
export default MindMapEdge;
