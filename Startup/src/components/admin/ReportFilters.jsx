import React from 'react';

export const ReportFilters = React.memo(({
  range,
  onRangeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  role,
  onRoleChange,
  isVerified,
  onIsVerifiedChange,
  provider,
  onProviderChange,
  isActive,
  onIsActiveChange,
  showExtraFilters = true
}) => {
  const presets = [
    { value: 'today', label: 'Today' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: 'var(--admin-card-bg)',
      border: '1px solid var(--admin-border)',
      padding: '16px',
      borderRadius: '12px',
      width: '100%'
    }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Date presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label htmlFor="report-date-range" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
            Date Range
          </label>
          <select
            id="report-date-range"
            value={range}
            onChange={(e) => onRangeChange(e.target.value)}
            className="admin-select"
            style={{ minWidth: '180px' }}
          >
            {presets.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Custom Calendar Inputs */}
        {range === 'custom' && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="report-start-date" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Start Date</label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="admin-select"
                style={{ padding: '7px 12px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="report-end-date" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>End Date</label>
              <input
                id="report-end-date"
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

      {/* Extra Filters Row */}
      {showExtraFilters && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--admin-border)', paddingTop: '16px' }}>
          {/* User Role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="report-role-filter" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>User Role</label>
            <select
              id="report-role-filter"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              className="admin-select"
              style={{ minWidth: '140px' }}
            >
              <option value="all">All Roles</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          {/* Verification Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="report-verify-filter" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Verification Status</label>
            <select
              id="report-verify-filter"
              value={isVerified}
              onChange={(e) => onIsVerifiedChange(e.target.value)}
              className="admin-select"
              style={{ minWidth: '140px' }}
            >
              <option value="all">All Statuses</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </div>

          {/* Login Provider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="report-provider-filter" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Login Provider</label>
            <select
              id="report-provider-filter"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value)}
              className="admin-select"
              style={{ minWidth: '140px' }}
            >
              <option value="all">All Providers</option>
              <option value="local">Local</option>
              <option value="google">Google</option>
            </select>
          </div>

          {/* Account Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="report-status-filter" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Account Status</label>
            <select
              id="report-status-filter"
              value={isActive}
              onChange={(e) => onIsActiveChange(e.target.value)}
              className="admin-select"
              style={{ minWidth: '140px' }}
            >
              <option value="all">All States</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
});

ReportFilters.displayName = 'ReportFilters';
export default ReportFilters;
