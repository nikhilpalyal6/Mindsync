import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = React.memo(({ 
  page, 
  limit, 
  totalPages, 
  totalCount, 
  hasNextPage, 
  hasPrevPage, 
  onPageChange, 
  onLimitChange 
}) => {
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalCount);

  return (
    <div className="admin-pagination">
      <div className="admin-pagination-info">
        {totalCount > 0 ? (
          <span>
            Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalCount}</strong> users
          </span>
        ) : (
          <span>No users to show</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="admin-page-size" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
            Rows per page:
          </label>
          <select
            id="admin-page-size"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="admin-select"
            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="admin-pagination-controls">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrevPage}
            className="admin-pagination-btn"
            aria-label="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>
          
          <span className="admin-pagination-number">
            Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong>
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNextPage}
            className="admin-pagination-btn"
            aria-label="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';
export default Pagination;
