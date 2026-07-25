import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, ShieldAlert, Cpu, RefreshCw, Download, 
  Search, Calendar 
} from 'lucide-react';
import { 
  getAdminActivityLogs, 
  getAdminLoginLogs, 
  getAdminActiveSessions,
  getAdminLogsExportUrl
} from '../../services/api';
import LogTable from '../../components/admin/LogTable';
import AuditTimeline from '../../components/admin/AuditTimeline';
import SessionTable from '../../components/admin/SessionTable';
import SecurityEventCard from '../../components/admin/SecurityEventCard';
import FilterBar from '../../components/admin/FilterBar';
import SearchBar from '../../components/admin/SearchBar';
import LogDetailsModal from '../../components/admin/LogDetailsModal';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';
import EmptyState from '../../components/admin/EmptyState';
import Pagination from '../../components/admin/Pagination';

export const AdminSystemLogs = () => {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'login' | 'sessions'
  const [logsData, setLogsData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // 'all' | 'today' | '7days' | '30days' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Security counts from login/reset query logs
  const [failedLoginsCount, setFailedLoginsCount] = useState(0);
  const [resetRequestsCount, setResetRequestsCount] = useState(0);

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Exporter states
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportMessage, setExportMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load audit, logins, or sessions
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'audit') {
        const res = await getAdminActivityLogs({
          page,
          limit,
          search,
          category: filterValue,
          dateRange,
          startDate,
          endDate
        });
        setLogsData(res.data?.logs || []);
        setPagination(res.pagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 });

        // Count password resets (category security/authentication or user resets)
        const resAllResets = await getAdminActivityLogs({ page: 1, limit: 1, category: 'Security' });
        setResetRequestsCount(resAllResets.pagination?.totalItems || 0);

      } else if (activeTab === 'login') {
        const res = await getAdminLoginLogs({
          page,
          limit,
          search,
          status: filterValue
        });
        setLogsData(res.data?.logs || []);
        setPagination(res.pagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 });

        // Query total failed logins
        const failedRes = await getAdminLoginLogs({ page: 1, limit: 1, status: 'failed' });
        setFailedLoginsCount(failedRes.pagination?.totalItems || 0);

      } else if (activeTab === 'sessions') {
        const res = await getAdminActiveSessions({
          page,
          limit,
          search
        });
        setLogsData(res.data?.sessions || []);
        setPagination(res.pagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 });
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch logs from server.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, limit, search, filterValue, dateRange, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page index on tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
    setSearch('');
    setFilterValue('all');
    setDateRange('all');
    setStartDate('');
    setEndDate('');
  };

  // Secure File Export downloader
  const handleExport = async () => {
    setExporting(true);
    setExportMessage('');
    try {
      const url = getAdminLogsExportUrl({
        search,
        category: filterValue,
        dateRange,
        startDate,
        endDate,
        format: exportFormat
      });

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export download request failed.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `mindsync-audit-logs-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExportMessage(`Logs exported successfully in ${exportFormat.toUpperCase()} format.`);
      setTimeout(() => setExportMessage(''), 4000);
    } catch (err) {
      setExportMessage('Failed to download log exports.');
      setTimeout(() => setExportMessage(''), 4000);
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'audit', label: 'Audit Trail Logs', icon: FileText },
    { id: 'login', label: 'Login History', icon: ShieldAlert },
    { id: 'sessions', label: 'Active Sessions', icon: Cpu }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', minWidth: 0 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>System Logs & Audit Trail</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
            Monitor admin console actions, login histories, user sessions, and security warnings.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="admin-btn admin-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Reload</span>
          </button>

          {activeTab === 'audit' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--admin-border)', padding: '3px 8px', borderRadius: '8px' }}>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="admin-select"
                style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', backgroundColor: 'transparent', outline: 'none', cursor: 'pointer' }}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="admin-btn admin-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: 'none' }}
              >
                <Download size={12} />
                <span>Export</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export notification alert */}
      {exportMessage && (
        <div style={{
          backgroundColor: exportMessage.includes('failed') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: exportMessage.includes('failed') ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
          color: exportMessage.includes('failed') ? '#f87171' : '#34d399',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          {exportMessage}
        </div>
      )}

      {/* Underlined Vercel-style Tab Bar */}
      <div 
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: '24px',
          borderBottom: '1px solid var(--admin-border)',
          overflowX: 'auto',
          width: '100%',
          whiteSpace: 'nowrap',
          marginBottom: '4px'
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 4px',
                fontSize: '0.875rem',
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: isActive ? '#fff' : 'var(--admin-text-muted)',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--admin-primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
                position: 'relative',
                top: '1px'
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter, Search, and Date row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
        <div style={{ flex: '1 1 320px' }}>
          <SearchBar 
            value={search} 
            onChange={(val) => { setSearch(val); setPage(1); }} 
            placeholder={activeTab === 'sessions' ? "Search sessions by user/email/IP..." : "Search logs by user, email, action, IP, browser..."} 
          />
        </div>
        
        {activeTab === 'audit' && (
          <>
            <div style={{ flex: '0 1 200px' }}>
              <FilterBar 
                filterValue={filterValue} 
                onFilterChange={(val) => { setFilterValue(val); setPage(1); }} 
                filterType={activeTab} 
              />
            </div>
            
            {/* Date Preset Filter */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--admin-card-bg)',
              border: '1px solid var(--admin-border)',
              padding: '12px 16px',
              borderRadius: '10px',
              alignItems: 'center',
              gap: '12px',
              flex: '0 1 200px'
            }}>
              <Calendar size={14} style={{ color: 'var(--admin-text-muted)' }} />
              <select
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
                className="admin-select"
                style={{ border: 'none', backgroundColor: 'transparent', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none', cursor: 'pointer' }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Dates Inputs */}
            {dateRange === 'custom' && (
              <div style={{
                display: 'flex',
                backgroundColor: 'var(--admin-card-bg)',
                border: '1px solid var(--admin-border)',
                padding: '10px 14px',
                borderRadius: '10px',
                alignItems: 'center',
                gap: '8px'
              }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="admin-select"
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="admin-select"
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'login' && (
          <div style={{ flex: '0 1 200px' }}>
            <FilterBar 
              filterValue={filterValue} 
              onFilterChange={(val) => { setFilterValue(val); setPage(1); }} 
              filterType={activeTab} 
            />
          </div>
        )}
      </div>

      {/* Main Grid View */}
      {loading && logsData.length === 0 ? (
        <LoadingSkeleton type="table" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLogs} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0 }}>
          
          {/* Tab 1: Audit Log Layout */}
          {activeTab === 'audit' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 60%' }}>
                <LogTable 
                  logs={logsData} 
                  type="activity" 
                  onViewDetails={setSelectedLog} 
                />
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={setPage}
                  totalItems={pagination.totalItems}
                  itemsPerPage={limit}
                  onItemsPerPageChange={(val) => { setLimit(val); setPage(1); }}
                />
              </div>

              <div style={{ flex: '1 1 30%' }}>
                <AuditTimeline 
                  logs={logsData} 
                  onViewDetails={setSelectedLog} 
                />
              </div>
            </div>
          )}

          {/* Tab 2: Login History Layout */}
          {activeTab === 'login' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0 }}>
              <SecurityEventCard 
                failedLoginsCount={failedLoginsCount} 
                resetRequestsCount={resetRequestsCount} 
              />
              
              <LogTable 
                logs={logsData} 
                type="login" 
                onViewDetails={setSelectedLog} 
              />

              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                totalItems={pagination.totalItems}
                itemsPerPage={limit}
                onItemsPerPageChange={(val) => { setLimit(val); setPage(1); }}
              />
            </div>
          )}

          {/* Tab 3: Active Sessions Layout */}
          {activeTab === 'sessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0 }}>
              <SessionTable sessions={logsData} />
              
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                totalItems={pagination.totalItems}
                itemsPerPage={limit}
                onItemsPerPageChange={(val) => { setLimit(val); setPage(1); }}
              />
            </div>
          )}

        </div>
      )}

      {/* Log Details Slide Modal */}
      {selectedLog && (
        <LogDetailsModal 
          log={selectedLog} 
          onClose={() => setSelectedLog(null)} 
        />
      )}
    </div>
  );
};

export default AdminSystemLogs;
