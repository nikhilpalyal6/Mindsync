import React from 'react';
import { Calendar } from 'lucide-react';

export const DateRangeFilter = React.memo(({ 
  range, 
  onRangeChange, 
  startDate, 
  onStartDateChange, 
  endDate, 
  onEndDateChange 
}) => {
  const presets = [
    { value: 'today', label: 'Today' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', backgroundColor: 'var(--admin-card-bg)', border: '1px solid var(--admin-border)', padding: '16px', borderRadius: '12px', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="date-range-preset" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Date range
        </label>
        <select
          id="date-range-preset"
          value={range}
          onChange={(e) => onRangeChange(e.target.value)}
          className="admin-select"
          style={{ minWidth: '180px' }}
        >
          {presets.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {range === 'custom' && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="custom-start-date" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
              Start Date
            </label>
            <input
              id="custom-start-date"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="admin-select"
              style={{ padding: '7px 12px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="custom-end-date" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
              End Date
            </label>
            <input
              id="custom-end-date"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="admin-select"
              style={{ padding: '7px 12px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

DateRangeFilter.displayName = 'DateRangeFilter';
export default DateRangeFilter;
