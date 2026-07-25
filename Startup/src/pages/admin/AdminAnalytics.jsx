import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { getAdminAnalytics } from '../../services/api';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import RefreshButton from '../../components/admin/RefreshButton';
import ExportButtons from '../../components/admin/ExportButtons';
import StatisticsGrid from '../../components/admin/StatisticsGrid';
import AnalyticsChart from '../../components/admin/AnalyticsChart';
import PieChartCard from '../../components/admin/PieChartCard';
import AnalyticsSummary from '../../components/admin/AnalyticsSummary';
import RecentRegistrations from '../../components/admin/RecentRegistrations';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';
import EmptyState from '../../components/admin/EmptyState';

export const AdminAnalytics = () => {
  const [range, setRange] = useState('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState('');

  // Fetch callback
  const fetchAnalytics = useCallback(async () => {
    // Only query custom date range if both fields are populated
    if (range === 'custom' && (!startDate || !endDate)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAnalytics({
        range,
        startDate,
        endDate
      });
      setAnalytics(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to retrieve analytics data streams.');
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate]);

  // Fetch when filters update
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRangeChange = (val) => {
    setRange(val);
    if (val !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Platform Analytics</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
            Review registration growth, login frequencies, active user ratios, and client user-agent metrics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <ExportButtons />
          <RefreshButton 
            onRefresh={fetchAnalytics} 
            lastRefreshed={lastRefreshed} 
            loading={loading} 
          />
        </div>
      </div>

      {/* Date Filter Bar */}
      <DateRangeFilter
        range={range}
        onRangeChange={handleRangeChange}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
      />

      {/* Main Body */}
      {loading && !analytics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <LoadingSkeleton type="stats" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAnalytics} />
      ) : !analytics ? (
        <EmptyState
          title="No analytics available"
          description="We could not aggregate data for the selected date range. Ensure the database contains active user accounts."
          icon={BarChart3}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Overview numbers */}
          <StatisticsGrid stats={analytics.stats} />

          {/* Interactive Trends Charts */}
          <AnalyticsChart
            userGrowthData={analytics.userGrowthData || []}
            loginTrendData={analytics.loginTrendData || []}
            activeUsersTrend={analytics.activeUsersTrend || []}
          />

          {/* Doughnut / Pie Charts Split Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            <PieChartCard
              title="Device Distribution"
              data={analytics.deviceData}
              innerRadius={55}
            />
            <PieChartCard
              title="Authentication Provider Split"
              data={analytics.providerData}
              innerRadius={55}
            />
            <PieChartCard
              title="Verification Status"
              data={analytics.verificationData}
              innerRadius={0}
            />
          </div>

          {/* OS, Browser lists and device progress bars */}
          <AnalyticsSummary
            browserData={analytics.browserData}
            osData={analytics.osData}
            deviceData={analytics.deviceData}
          />

          {/* Latest 10 registered accounts list */}
          <RecentRegistrations registrations={analytics.recentRegistrations} />
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
