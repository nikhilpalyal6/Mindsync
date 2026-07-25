import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export const ReportTable = React.memo(({
  rows,
  columns,
  sortBy,
  sortOrder,
  onSortChange
}) => {
  const handleSortClick = (key) => {
    if (onSortChange) {
      onSortChange(key);
    }
  };

  const renderSortIcon = (key) => {
    if (sortBy !== key) return null;
    return sortOrder === 'asc' 
      ? <ArrowUp size={12} style={{ marginLeft: '4px', display: 'inline-block' }} />
      : <ArrowDown size={12} style={{ marginLeft: '4px', display: 'inline-block' }} />;
  };

  const formatCellVal = (val) => {
    if (val === undefined || val === null) return 'N/A';
    if (typeof val === 'string' && val.endsWith('Z') && !isNaN(Date.parse(val))) {
      return new Date(val).toLocaleString();
    }
    return val.toString();
  };

  return (
    <div className="admin-table-wrapper" style={{ margin: 0 }}>
      <div className="admin-table-container">
        <table className="admin-table" aria-label="Report Data Preview">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="admin-th admin-th-sortable"
                  onClick={() => handleSortClick(col.key)}
                >
                  {col.label} {renderSortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows && rows.length > 0 ? (
              rows.map((row, rIdx) => (
                <tr key={row._id || rIdx} className="admin-tr">
                  {columns.map((col) => (
                    <td key={col.key} className="admin-td" style={{ whiteSpace: 'nowrap' }}>
                      {formatCellVal(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--admin-text-disabled)' }}>
                  No preview records available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ReportTable.displayName = 'ReportTable';
export default ReportTable;
