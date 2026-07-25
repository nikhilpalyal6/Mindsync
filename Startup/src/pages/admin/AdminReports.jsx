import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Globe, UserCheck, Shield, HardDrive, 
  Activity, FileText, Heart, Search, Calendar, Mail, BellRing 
} from 'lucide-react';
import { getAdminReportData } from '../../services/api';
import ReportCard from '../../components/admin/ReportCard';
import ReportFilters from '../../components/admin/ReportFilters';
import ReportSummary from '../../components/admin/ReportSummary';
import ReportTable from '../../components/admin/ReportTable';
import ReportHistory from '../../components/admin/ReportHistory';
import ExportButtons from '../../components/admin/ExportButtons';
import Pagination from '../../components/admin/Pagination';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';
import EmptyState from '../../components/admin/EmptyState';

export const AdminReports = () => {
  const [reportType, setReportType] = useState('user');
  const [range, setRange] = useState('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Dropdown filters
  const [role, setRole] = useState('all');
  const [isVerified, setIsVerified] = useState('all');
  const [provider, setProvider] = useState('all');
  const [isActive, setIsActive] = useState('all');
  
  // Search, Pagination, Sort states
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Report data states
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Ready'); // Ready | Processing | Failed

  // Fetch report data
  const fetchReport = useCallback(async () => {
    if (range === 'custom' && (!startDate || !endDate)) {
      return;
    }

    setLoading(true);
    setStatus('Processing');
    setError(null);
    try {
      const response = await getAdminReportData({
        type: reportType,
        range,
        startDate,
        endDate,
        role,
        isVerified,
        provider,
        isActive,
        search,
        page,
        limit,
        sortBy,
        sortOrder
      });
      setReportData(response);
      setStatus('Ready');
    } catch (err) {
      setError(err.message || 'Failed to generate report.');
      setStatus('Failed');
    } finally {
      setLoading(false);
    }
  }, [reportType, range, startDate, endDate, role, isVerified, provider, isActive, search, page, limit, sortBy, sortOrder]);

  // Trigger refetch when filters change
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Sync search input debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const handleRangeChange = (val) => {
    setRange(val);
    setPage(1);
    if (val !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleSelectReport = (type) => {
    setReportType(type);
    setPage(1);
    setSearch('');
    setLocalSearch('');
    // Default sorting based on type
    if (type === 'login') {
      setSortBy('loginTime');
    } else {
      setSortBy('createdAt');
    }
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const categories = [
    { type: 'user', label: 'User Directory', description: 'Lists details of all registered users', icon: Users },
    { type: 'registration', label: 'Registrations Report', description: 'Tracks user registration dates', icon: UserPlus },
    { type: 'login', label: 'Login Activity', description: 'Logs success logins, IP, and OS devices', icon: Globe },
    { type: 'verification', label: 'Account Verifications', description: 'Filters verified vs unverified users', icon: UserCheck },
    { type: 'role', label: 'Administrative Roles', description: 'Lists users by permissions and access levels', icon: Shield },
    { type: 'session', label: 'Active Devices', description: 'Tracks currently active user sessions', icon: HardDrive },
    { type: 'activity', label: 'Activity Logs', description: 'Tracks profile updates, password resets, etc.', icon: Activity },
    { type: 'summary', label: 'Analytics Summary', description: 'Overview counts and database statistics', icon: FileText },
    { type: 'health', label: 'System Health Log', description: 'Logs cluster status, mail configurations, etc.', icon: Heart }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Enterprise Reports</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
            Generate, filter, and audit data reports from platform user profiles and session access logs.
          </p>
        </div>

        {/* Status indicator & Exports */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Status:</span>
            <span className={`admin-badge ${status === 'Ready' ? 'green' : (status === 'Processing' ? 'blue' : 'red')}`} style={{ textTransform: 'capitalize' }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: status === 'Ready' ? '#10b981' : (status === 'Processing' ? '#3b82f6' : '#ef4444'),
                marginRight: '6px',
                display: 'inline-block'
              }}></span>
              {status}
            </span>
          </div>

          <ExportButtons />
        </div>
      </div>

      {/* Main Multi-Column Workspace */}
      <div style={{ display: 'flex', gap: '24px', flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
        {/* Left Column (70%) - Filters, Summary, Preview Table */}
        <div style={{ flex: '1 1 640px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {/* Filters component */}
          <ReportFilters
            range={range}
            onRangeChange={handleRangeChange}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            role={role}
            onRoleChange={(v) => { setRole(v); setPage(1); }}
            isVerified={isVerified}
            onIsVerifiedChange={(v) => { setIsVerified(v); setPage(1); }}
            provider={provider}
            onProviderChange={(v) => { setProvider(v); setPage(1); }}
            isActive={isActive}
            onIsActiveChange={(v) => { setIsActive(v); setPage(1); }}
            showExtraFilters={['user', 'registration', 'verification', 'role'].includes(reportType)}
          />

          {/* Search bar for table */}
          {['user', 'registration', 'login', 'verification', 'role', 'session', 'activity'].includes(reportType) && (
            <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
              <Search size={16} style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search rows in generated preview..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              />
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && !reportData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <LoadingSkeleton type="stats" />
              <LoadingSkeleton type="table" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={fetchReport} />
          ) : !reportData ? (
            <EmptyState
              title="Report is empty"
              description="No data records match the active criteria. Try adjusting the date range filters."
              icon={FileText}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary metadata cards */}
              <ReportSummary summary={reportData.summary} />

              {/* Data Table */}
              <ReportTable
                rows={reportData.rows}
                columns={reportData.columns}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
              />

              {/* Server pagination */}
              {reportData.rows?.length > 0 && (
                <Pagination
                  page={page}
                  limit={limit}
                  totalPages={reportData.pagination?.totalPages || 1}
                  totalCount={reportData.pagination?.total || 0}
                  hasNextPage={reportData.pagination?.hasNextPage || false}
                  hasPrevPage={reportData.pagination?.hasPrevPage || false}
                  onPageChange={setPage}
                  onLimitChange={(l) => { setLimit(l); setPage(1); }}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column (30%) - Report Categories, Scheduling, History */}
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Category Selectors */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Report Category</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((c) => (
                <ReportCard
                  key={c.type}
                  type={c.type}
                  label={c.label}
                  description={c.description}
                  icon={c.icon}
                  selectedType={reportType}
                  onSelect={handleSelectReport}
                />
              ))}
            </div>
          </div>

          {/* Scheduling UI preview */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Report Scheduling</h3>
              <span className="admin-badge blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>UI Preview</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>FREQUENCY</span>
                <select disabled className="admin-select" style={{ fontSize: '0.8rem', padding: '6px 10px', cursor: 'not-allowed' }}>
                  <option>Weekly Reports (Mondays)</option>
                  <option>Daily Reports (00:00 UTC)</option>
                  <option>Monthly Reports (1st of month)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>DELIVERY EMAILS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid var(--admin-border)', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <Mail size={14} style={{ color: 'var(--admin-text-disabled)' }} />
                  <span style={{ fontSize: '0.8rem', color: '#fff' }}>admins@mindsync.com</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" disabled checked className="admin-checkbox" style={{ cursor: 'not-allowed' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Send email notifications</span>
              </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-disabled)', fontStyle: 'italic', borderTop: '1px solid var(--admin-border)', paddingTop: '10px' }}>
              Note: Automated scheduling pipelines require SMTP background workers.
            </div>
          </div>

          {/* Download history */}
          <ReportHistory />
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
