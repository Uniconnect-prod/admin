import React, { useState, useEffect } from 'react';
import { User, Shield, Bell, Sliders, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import './SettingsPage.scss';

export const SettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Profile Form
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || ''
  });

  // Security Form
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    renewalAlerts: true,
    churnWarningThreshold: '10',
    defaultExportFormat: 'csv',
    autoRefreshInterval: '60'
  });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.put('/settings/profile', {
        name: profile.name,
        email: profile.email
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Profile information updated successfully.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSecurity = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      alert('New passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.put('/settings/security', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Password changed successfully.' });
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update security credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <PageHeader
        title="Settings & Platform Preferences"
        subtitle="Manage personal operator profile, credentials, notifications, and dashboard telemetry"
        breadcrumbs={['Home', 'System', 'Settings']}
      />

      {feedback && (
        <div className={`feedback-banner alert-${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="settings-layout">
        {/* Settings Navigation Tabs */}
        <aside className="settings-nav-card card">
          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => { setActiveTab('profile'); setFeedback(null); }}
          >
            <User size={16} />
            Profile Information
          </button>
          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => { setActiveTab('security'); setFeedback(null); }}
          >
            <Shield size={16} />
            Security & Passwords
          </button>
          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => { setActiveTab('notifications'); setFeedback(null); }}
          >
            <Bell size={16} />
            Notifications & Alerts
          </button>
          <button
            type="button"
            className={`settings-nav-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => { setActiveTab('preferences'); setFeedback(null); }}
          >
            <Sliders size={16} />
            Platform Preferences
          </button>

          {user?.isSuperAdmin && (
            <button
              type="button"
              className="settings-nav-btn"
              onClick={() => window.location.href = '/countries'}
              style={{ marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', color: '#0284c7' }}
            >
              <Globe size={16} />
              Country & Market Settings →
            </button>
          )}
        </aside>

        {/* Content Panel */}
        <main className="settings-content-card card">
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="settings-form">
              <h3 className="form-section-title">Profile Information</h3>
              <p className="form-section-sub">Update your account display identity and communication email.</p>

              <div className="form-group">
                <label>Username</label>
                <input type="text" className="form-control" value={profile.username} disabled />
                <span className="field-caption">Usernames are immutable for audit compliance.</span>
              </div>

              <div className="form-group">
                <label>Full Display Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notification Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleUpdateSecurity} className="settings-form">
              <h3 className="form-section-title">Security & Password</h3>
              <p className="form-section-sub">Ensure your account uses a strong, complex password.</p>

              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-form">
              <h3 className="form-section-title">Notifications & Subscriptions</h3>
              <p className="form-section-sub">Configure real-time alerts for platform anomalies and billing events.</p>

              <div className="toggle-setting-row">
                <div>
                  <strong>High Failure Rate Threshold Alerts</strong>
                  <p>Send instant email alert when renewal failure exceeds 15% in a single batch.</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.renewalAlerts}
                  onChange={(e) => setPreferences({ ...preferences, renewalAlerts: e.target.checked })}
                />
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Churn Spike Alert Sensitivity (%)</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ maxWidth: '160px' }}
                  value={preferences.churnWarningThreshold}
                  onChange={(e) => setPreferences({ ...preferences, churnWarningThreshold: e.target.value })}
                />
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-form">
              <h3 className="form-section-title">Telemetry & Preferences</h3>
              <p className="form-section-sub">Customize reporting dashboard behavior and defaults.</p>

              <div className="form-group">
                <label>Default CSV Export Encoding</label>
                <select className="form-control" style={{ maxWidth: '240px' }} defaultValue="utf8">
                  <option value="utf8">UTF-8 with BOM (Excel Compatible)</option>
                  <option value="ascii">Standard ASCII</option>
                </select>
              </div>

              <div className="form-group">
                <label>Dashboard Live Refresh Interval</label>
                <select className="form-control" style={{ maxWidth: '240px' }} defaultValue="60">
                  <option value="30">Every 30 seconds</option>
                  <option value="60">Every 1 minute</option>
                  <option value="300">Every 5 minutes</option>
                  <option value="0">Manual Refresh Only</option>
                </select>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

