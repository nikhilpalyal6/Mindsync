import { PAGINATION } from '../constants/index.js';

export const getPaginationParams = (query) => {
  const page = Math.max(
    Number.parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE,
    1
  );
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT, 1),
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

export const paginateQuery = (query, page, limit) => {
  const skip = (page - 1) * limit;
  return query.skip(skip).limit(limit);
};
