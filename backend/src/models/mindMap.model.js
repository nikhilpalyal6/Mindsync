import mongoose from 'mongoose';

const mindMapSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['GENERATING', 'COMPLETED', 'FAILED'],
      default: 'GENERATING',
      required: true,
      index: true
    },
    error: {
      type: String,
      default: null
    },
    contentHash: {
      type: String,
      default: ''
    },
    nodes: [
      {
        nodeId: { type: String, required: true },
        label: { type: String, required: true },
        type: { 
          type: String, 
          enum: ['ROOT', 'RESOURCE', 'TOPIC', 'SUBTOPIC', 'CONCEPT', 'PROCESS', 'FORMULA', 'EXAMPLE', 'DEFINITION', 'IMPORTANT'],
          default: 'CONCEPT'
        },
        description: { type: String, default: '' },
        importance: { type: String, default: 'MEDIUM' },
        color: { type: String, default: '#3b82f6' },
        sources: [
          {
            resourceId: { type: String, default: null },
            resourceName: { type: String, default: null },
            pageNumber: { type: Number, default: null },
            timestamp: { type: String, default: null },
            sectionTitle: { type: String, default: null }
          }
        ],
        position: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 }
        }
      }
    ],
    edges: [
      {
        sourceNode: { type: String, required: true },
        targetNode: { type: String, required: true },
        relationship: { 
          type: String, 
          enum: ['CONTAINS', 'RELATED_TO', 'DEPENDS_ON', 'EXPLAINS', 'EXAMPLE_OF', 'PART_OF', 'COMPARES_WITH', 'CAUSES', 'USED_IN'],
          default: 'RELATED_TO'
        }
      }
    ],
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index for user + workspace lookup
mindMapSchema.index({ user: 1, workspaceId: 1 }, { unique: true });

const MindMap = mongoose.model('MindMap', mindMapSchema);
export default MindMap;
