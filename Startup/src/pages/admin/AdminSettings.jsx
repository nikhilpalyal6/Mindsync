import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sliders, Settings, ShieldCheck, Cpu, Globe, 
  Database, Image, Mail, RefreshCw 
} from 'lucide-react';
import { getAdminSettingsConfig } from '../../services/api';
import SettingsCard from '../../components/admin/SettingsCard';
import SettingsItem from '../../components/admin/SettingsItem';
import StatusBadge from '../../components/admin/StatusBadge';
import IntegrationCard from '../../components/admin/IntegrationCard';
import ReadOnlyField from '../../components/admin/ReadOnlyField';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';
import EmptyState from '../../components/admin/EmptyState';

export const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [configData, setConfigData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch settings configurations
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminSettingsConfig();
      setConfigData(data);
    } catch (err) {
      setError(err.message || 'Failed to load settings configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Format server uptime helper
  const formatUptime = (seconds) => {
    if (seconds === undefined || seconds === null) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const tabs = [
    { id: 'general', label: 'General & Register', icon: Settings },
    { id: 'auth', label: 'Authentication', icon: ShieldCheck },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'system', label: 'System Info', icon: Cpu }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Platform Settings</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
            Inspect application environmental constants, authentication scopes, integration links, and security properties.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          className="admin-btn admin-btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Reload</span>
        </button>
      </div>

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
              onClick={() => setActiveTab(tab.id)}
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

      {/* Settings Sections Container */}
      {loading && !configData ? (
        <LoadingSkeleton type="stats" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSettings} />
      ) : !configData ? (
        <EmptyState
          title="Configuration unavailable"
          description="Could not load server variables or connection status metadata."
          icon={Sliders}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0 }}>
          {/* General & Registration Tab */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <SettingsCard title="Application Metadata" description="Basic identification properties and execution targets.">
                <div className="admin-settings-grid">
                  <ReadOnlyField label="Application Name" value={configData.general?.appName} />
                  <ReadOnlyField label="App Version" value={configData.general?.version} copyable />
                  <ReadOnlyField label="Execution Environment" value={configData.general?.environment} />
                  <ReadOnlyField label="Target API Version" value={configData.general?.apiVersion} />
                  <ReadOnlyField label="Time Zone" value={configData.general?.timeZone} />
                  <ReadOnlyField label="Default Language" value={configData.general?.defaultLanguage} />
                </div>
              </SettingsCard>

              <SettingsCard title="Registration Policies" description="Access parameters and verification requirements.">
                <SettingsItem label="New User Registration" description="Enables or disables sign-ups on the home portal.">
                  <StatusBadge status={configData.registration?.registrationEnabled} />
                </SettingsItem>
                <SettingsItem label="Email Verification Check" description="Force users to verify their accounts via mail before getting dashboard credentials.">
                  <StatusBadge status={configData.registration?.emailVerificationRequired} />
                </SettingsItem>
                <SettingsItem 
                  label="Default User Role" 
                  description="Initial system authorization role assigned to new registrations."
                  noBorder
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb', fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
                    {configData.registration?.defaultUserRole}
                  </span>
                </SettingsItem>
              </SettingsCard>
            </div>
          )}

          {/* Authentication Statuses Tab */}
          {activeTab === 'auth' && (
            <SettingsCard title="Authentication Framework" description="Active login provider scopes and identity check services.">
              <SettingsItem label="JWT Session Validation" description="Validates access payloads on every incoming request.">
                <StatusBadge status={configData.authentication?.jwtStatus} />
              </SettingsItem>
              <SettingsItem label="Google OAuth login" description="Allows users to log in securely using third-party Google profiles.">
                <StatusBadge status={configData.authentication?.googleLoginStatus} />
              </SettingsItem>
              <SettingsItem label="Email SMTP Verification" description="Dispatches activation codes and credentials validations.">
                <StatusBadge status={configData.authentication?.emailVerificationStatus} />
              </SettingsItem>
              <SettingsItem label="Forgot Password flow" description="Transmits tokens to users for automated resets.">
                <StatusBadge status={configData.authentication?.passwordResetStatus} />
              </SettingsItem>
              <SettingsItem 
                label="Persistent Session Remember Me" 
                description="Keeps user sessions active via long-lived refresh cookies."
                noBorder
              >
                <StatusBadge status={configData.authentication?.rememberMeStatus} />
              </SettingsItem>
            </SettingsCard>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <SettingsCard title="Safety & Middleware Configurations" description="Express host headers protection and security rules.">
              <SettingsItem label="Helmet protection headers" description="Prevents standard cross-site scripting and request exploits.">
                <StatusBadge status={configData.security?.helmetEnabled} />
              </SettingsItem>
              <SettingsItem label="Request Rate Limiting" description="Blocks brute-force traffic spikes and credential stuffing attacks.">
                <StatusBadge status={configData.security?.rateLimiterEnabled} />
              </SettingsItem>
              <SettingsItem label="Secure cookies transport" description="Restricts cookie visibility to HTTPS links only (Active in production).">
                <StatusBadge status={configData.security?.secureCookies} />
              </SettingsItem>
              <SettingsItem label="JSON Web Token check" description="Requires cryptographic token encryption signatures.">
                <StatusBadge status={configData.security?.jwtEnabled} />
              </SettingsItem>
              <SettingsItem 
                label="MongoDB injection filter" 
                description="Sanitizes input structures to prevent query payloads injection."
                noBorder
              >
                <StatusBadge status={configData.security?.mongoProtection} />
              </SettingsItem>
            </SettingsCard>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid var(--admin-border)', paddingBottom: '8px' }}>
                <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Connected Integrations</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                  Third-party services linked to the MindSync system. Changes require updating system environment constants.
                </p>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
                gap: '20px', 
                width: '100%' 
              }}>
                <IntegrationCard 
                  name="Google OAuth Client" 
                  status={configData.integrations?.googleOAuth} 
                  description="Handles user logins and SSO registrations."
                  icon={ShieldCheck}
                />
                <IntegrationCard 
                  name="Cloudinary Storage" 
                  status={configData.integrations?.cloudinary} 
                  description="Stores profile pictures and learning documents."
                  icon={Image}
                />
                <IntegrationCard 
                  name="Nodemailer SMTP host" 
                  status={configData.integrations?.nodemailer} 
                  description="Dispatches email confirmation codes."
                  icon={Mail}
                />
                <IntegrationCard 
                  name="MongoDB Atlas database" 
                  status={configData.integrations?.mongodbAtlas} 
                  description="Primary document database storing user profiles."
                  icon={Database}
                />
              </div>
            </div>
          )}

          {/* System Info Tab */}
          {activeTab === 'system' && (
            <SettingsCard title="System Performance Metadata" description="Server runtime properties and process telemetry.">
              <div className="admin-settings-grid">
                <ReadOnlyField label="Server Build Version" value={configData.system?.serverVersion} copyable />
                <ReadOnlyField label="Node Environment Mode" value={configData.system?.nodeEnvironment} />
                <ReadOnlyField label="Current Server Time" value={configData.system?.currentServerTime} copyable />
                <ReadOnlyField label="Server Process Uptime" value={formatUptime(configData.system?.serverUptime)} />
                <ReadOnlyField label="API Spec Version" value={configData.system?.apiVersion} />
              </div>
            </SettingsCard>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
