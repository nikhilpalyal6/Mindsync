import Highlight from '../models/highlight.model.js';
import StudySession from '../models/studySession.model.js';
import ApiError from '../utils/ApiError.js';

class HighlightService {
  async createHighlight(userId, data) {
    const {
      resourceId,
      pageNumber,
      text,
      type,
      rects
    } = data;

    // 1. Validate inputs
    if (!resourceId) throw ApiError.badRequest('resourceId is required');
    if (!pageNumber || pageNumber < 1) throw ApiError.badRequest('pageNumber must be greater than or equal to 1');
    if (!text || !text.trim()) throw ApiError.badRequest('text content is required');
    if (!['important', 'concept', 'definition', 'formula', 'personal'].includes(type)) {
      throw ApiError.badRequest('Invalid highlight type');
    }
    if (!rects || !Array.isArray(rects) || rects.length === 0) {
      throw ApiError.badRequest('rects coordinate array is required');
    }
    for (const rect of rects) {
      if (
        rect.x === undefined || rect.y === undefined ||
        rect.width === undefined || rect.height === undefined
      ) {
        throw ApiError.badRequest('Each rect must have x, y, width, and height');
      }
    }

    // 2. Validate resource ownership
    const session = await StudySession.findOne({
      user: userId,
      $or: [
        { 'resources._id': resourceId },
        { 'resources.url': resourceId }
      ]
    });
    if (!session) {
      throw ApiError.notFound('Resource not found or access denied');
    }

    // 3. Verify maximum page limits if we can inspect the resource metadata
    const resource = session.resources.find(r => r._id === resourceId || r.url === resourceId);
    if (resource?.data?.pageCount && pageNumber > resource.data.pageCount) {
      throw ApiError.badRequest(`pageNumber exceeds resource pageCount of ${resource.data.pageCount}`);
    }

    // 4. Duplicate protection check
    const existing = await Highlight.findOne({
      userId,
      resourceId,
      pageNumber,
      text: text.trim()
    });
    if (existing) {
      throw ApiError.badRequest('This highlight already exists');
    }

    // 5. Create highlight with optional custom source and user ID from session
    const highlight = await Highlight.create({
      userId,
      resourceId,
      pageNumber,
      text: text.trim(),
      type,
      source: data.source || 'manual',
      rects
    });

    return highlight;
  }

  async getHighlights(userId, resourceId) {
    if (!resourceId) throw ApiError.badRequest('resourceId is required');

    // 1. Validate resource ownership
    const session = await StudySession.findOne({
      user: userId,
      $or: [
        { 'resources._id': resourceId },
        { 'resources.url': resourceId }
      ]
    });
    if (!session) {
      throw ApiError.notFound('Resource not found or access denied');
    }

    // 2. Fetch highlights sorted by pageNumber, then position/offset
    return Highlight.find({ userId, resourceId })
      .sort({ pageNumber: 1, createdAt: 1 });
  }

  async deleteHighlight(userId, highlightId) {
    if (!highlightId) throw ApiError.badRequest('highlightId is required');

    // 1. Find highlight
    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      throw ApiError.notFound('Highlight not found');
    }

    // 2. Verify ownership
    if (highlight.userId.toString() !== userId.toString()) {
      throw ApiError.forbidden('You are not authorized to delete this highlight');
    }

    // 3. Delete
    await Highlight.findByIdAndDelete(highlightId);
    return highlight;
  }
}

export default new HighlightService();
