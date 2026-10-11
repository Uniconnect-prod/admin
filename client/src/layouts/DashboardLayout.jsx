import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserX,
  HelpCircle,
  Upload,
  UserCheck,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  Bell,
  Search,
  Check,
  Globe,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PlatformLogo, PLATFORM_META } from '../components/common/PlatformBadge';
import './DashboardLayout.scss';

export const DashboardLayout = () => {
  const { user, activePlatform, availablePlatforms, switchPlatform, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const [activeCountry, setActiveCountry] = useState('All Countries');

  // Close menus on route change or outside click
  useEffect(() => {
    setMobileMenuOpen(false);
    setPlatformDropdownOpen(false);
    setCountryDropdownOpen(false);
    setUserMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const availableCountries = ['All Countries', ...new Set(availablePlatforms.map(p => p.country).filter(Boolean))];

  const filteredPlatforms = availablePlatforms.filter(
    p => activeCountry === 'All Countries' || p.country === activeCountry
  );

  // Check if a module is enabled on the active platform
  const isModuleEnabled = (moduleName) => {
    if (!activePlatform) return true;
    if (activePlatform.isAll) return true;
    const modules = activePlatform.enabled_modules || ['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports'];
    return modules.includes(moduleName);
  };

  const handlePlatformSelect = (p) => {
    const ok = switchPlatform(p);
    setPlatformDropdownOpen(false);
    if (ok) {
      // Re-trigger current route or redirect to dashboard
      navigate('/dashboard');
    }
  };

  const isSuperAdmin = user?.isSuperAdmin;
  const isPlatformAdmin = user?.activeRole === 'Platform Admin' || isSuperAdmin;
  const isAuthor = user?.activeRole === 'Author' || isPlatformAdmin;
  const isAnalyst = user?.activeRole === 'Analyst' || isPlatformAdmin;

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <PlatformLogo platformCode={activePlatform?.code || 'ALL'} size="md" />
          {!sidebarCollapsed && (
            <div className="brand-text">
              <span className="brand-title">{activePlatform?.name || 'Reporting System'}</span>
              <span className="brand-subtitle">
                {activePlatform?.isAll ? 'Consolidated Portal' : 'Enterprise Report Portal'}
              </span>
            </div>
          )}
        </div>

        {/* Active Platform Pill in Sidebar */}
        {!sidebarCollapsed && activePlatform && (
          <div className="sidebar-platform-badge">
            <div className="platform-indicator-dot" />
            <div className="platform-name-text">
              <span className="platform-label">ACTIVE PLATFORM</span>
              <span className="platform-title">{activePlatform.name}</span>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {/* DASHBOARD */}
          <div className="nav-group">
            <Link
              to="/dashboard"
              className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
              title="Dashboard"
            >
              <LayoutDashboard size={18} className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-label">Dashboard</span>}
            </Link>
          </div>

          {/* SUBSCRIBER MANAGEMENT */}
          {isModuleEnabled('Subscribers') && (
            <div className="nav-group">
              {!sidebarCollapsed && <span className="group-title">SUBSCRIBER MANAGEMENT</span>}
              <Link
                to="/subscribers"
                className={`nav-item ${location.pathname === '/subscribers' ? 'active' : ''}`}
                title="All Subscribers"
              >
                <Users size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">All Subscribers</span>}
              </Link>
              {isModuleEnabled('Churn') && (
                <Link
                  to="/churn"
                  className={`nav-item ${location.pathname === '/churn' ? 'active' : ''}`}
                  title="Churn Subscribers"
                >
                  <UserX size={18} className="nav-icon" />
                  {!sidebarCollapsed && <span className="nav-label">Churn Subscribers</span>}
                </Link>
              )}
            </div>
          )}

          {/* REPORTS */}
          {isModuleEnabled('Reports') && isSuperAdmin && (
            <div className="nav-group">
              {!sidebarCollapsed && <span className="group-title">REPORTS</span>}
              <Link
                to="/reports/platform-comparison"
                className={`nav-item ${location.pathname === '/reports/platform-comparison' ? 'active' : ''}`}
                title="Platform Comparison"
              >
                <Globe size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">Platform Comparison</span>}
              </Link>
            </div>
          )}

          {/* CONTENT MANAGEMENT (Quiz) */}
          {isModuleEnabled('Quiz') && (isAuthor || isPlatformAdmin) && (
            <div className="nav-group">
              {!sidebarCollapsed && <span className="group-title">CONTENT MANAGEMENT</span>}
              <Link
                to="/quizzes"
                className={`nav-item ${location.pathname === '/quizzes' ? 'active' : ''}`}
                title="Quizzes"
              >
                <HelpCircle size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">Quizzes</span>}
              </Link>
              <Link
                to="/quizzes/upload"
                className={`nav-item ${location.pathname === '/quizzes/upload' ? 'active' : ''}`}
                title="Quiz Upload"
              >
                <Upload size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">Quiz Upload</span>}
              </Link>
            </div>
          )}

          {/* USER & PLATFORM MANAGEMENT */}
          {(isSuperAdmin || isPlatformAdmin) && (
            <div className="nav-group">
              {!sidebarCollapsed && <span className="group-title">USER MANAGEMENT</span>}
              <Link
                to="/users"
                className={`nav-item ${location.pathname === '/users' ? 'active' : ''}`}
                title="All Users"
              >
                <UserCheck size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">All Users</span>}
              </Link>
              {isSuperAdmin && (
                <Link
                  to="/platforms"
                  className={`nav-item ${location.pathname === '/platforms' ? 'active' : ''}`}
                  title="Platforms Config"
                >
                  <Layers size={18} className="nav-icon" />
                  {!sidebarCollapsed && <span className="nav-label">Platforms Config</span>}
                </Link>
              )}
            </div>
          )}

          {/* SYSTEM */}
          <div className="nav-group">
            {!sidebarCollapsed && <span className="group-title">SYSTEM</span>}
            {(isSuperAdmin || isPlatformAdmin) && (
              <Link
                to="/activity-logs"
                className={`nav-item ${location.pathname === '/activity-logs' ? 'active' : ''}`}
                title="Activity Logs"
              >
                <Activity size={18} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-label">Activity Logs</span>}
              </Link>
            )}
            <Link
              to="/settings"
              className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
              title="Settings"
            >
              <Settings size={18} className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-label">Settings</span>}
            </Link>
          </div>
        </nav>

        {/* Sidebar Footer with Logout */}
        <div className="sidebar-footer">
          <button type="button" className="nav-item logout-btn" onClick={logout} title="Sign Out">
            <LogOut size={18} className="nav-icon" />
            {!sidebarCollapsed && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="main-wrapper">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="navbar-left">
            <button
              type="button"
              className="navbar-toggle-btn"
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              aria-label="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb path */}
            <div className="nav-breadcrumb-path">
              <span className="crumb-root">Reporting</span>
              <ChevronRight size={13} />
              <span className="crumb-active-page">
                {location.pathname === '/dashboard' ? 'Dashboard' :
                 location.pathname.replace('/', '').replace(/-/g, ' ').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="navbar-right">
            {/* Global Search Bar */}
            <div className="global-search-bar">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Global search MSISDN, reports, users..."
                className="search-input"
              />
            </div>

            {/* Country Switcher Dropdown */}
            <div className="platform-switcher-dropdown">
              <button
                type="button"
                className="platform-select-btn"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
              >
                <Globe size={14} className="text-muted" />
                <span className="current-platform-name">
                  {activeCountry}
                </span>
                <ChevronDown size={14} className="dropdown-arrow" />
              </button>

              {countryDropdownOpen && (
                <div className="dropdown-panel platform-menu">
                  <div className="dropdown-header">
                    <span>Select Region</span>
                  </div>

                  {availableCountries.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`platform-option ${activeCountry === c ? 'active' : ''}`}
                      onClick={() => {
                        setActiveCountry(c);
                        setCountryDropdownOpen(false);
                      }}
                    >
                      <Globe size={14} className="text-muted" />
                      <div className="option-info">
                        <span className="name">{c}</span>
                      </div>
                      {activeCountry === c && <Check size={16} className="active-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Platform Switcher Dropdown */}
            <div className="platform-switcher-dropdown">
              <button
                type="button"
                className="platform-select-btn"
                onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
              >
                <PlatformLogo platformCode={activePlatform?.code || 'ALL'} size="sm" />
                <span className="current-platform-name">
                  {activePlatform?.name || 'Select Platform'}
                </span>
                <ChevronDown size={14} className="dropdown-arrow" />
              </button>

              {platformDropdownOpen && (
                <div className="dropdown-panel platform-menu">
                  <div className="dropdown-header">
                    <span>Select Active Platform</span>
                    <span className="sub-tag">Strict Data Isolation</span>
                  </div>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      className={`platform-option ${activePlatform?.isAll ? 'active' : ''}`}
                      onClick={() => handlePlatformSelect({ id: 'ALL', code: 'ALL', name: 'All Platforms', isAll: true })}
                    >
                      <PlatformLogo platformCode="ALL" size="sm" />
                      <div className="option-info">
                        <span className="name">All Platforms (Consolidated)</span>
                        <span className="role-tag">Super Admin Only</span>
                      </div>
                      {activePlatform?.isAll && <Check size={16} className="active-check" />}
                    </button>
                  )}

                  {filteredPlatforms.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`platform-option ${activePlatform?.code === p.code ? 'active' : ''}`}
                      onClick={() => handlePlatformSelect(p)}
                    >
                      <PlatformLogo platformCode={p.code} size="sm" />
                      <div className="option-info">
                        <span className="name">{p.name}</span>
                        <span className="role-tag">{p.role || user?.activeRole}</span>
                      </div>
                      {activePlatform?.code === p.code && <Check size={16} className="active-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications Button & Popover */}
            <div className="notifications-wrapper">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                title="Notifications"
              >
                <Bell size={18} />
                <span className="notification-dot" />
              </button>

              {notificationsOpen && (
                <div className="dropdown-panel notification-menu">
                  <div className="dropdown-header">
                    <span>Platform Alerts</span>
                    <span className="count-tag">3 New</span>
                  </div>
                  <div className="notification-list">
                    <div className="notif-item">
                      <span className="notif-title">High Renewal Success</span>
                      <p className="notif-desc">GHSnapflix 24hr renewal rate reached 91.8%.</p>
                      <span className="notif-time">10 mins ago</span>
                    </div>
                    <div className="notif-item">
                      <span className="notif-title">Subscriber Sync Completed</span>
                      <p className="notif-desc">Batch synchronization for GHGameZone finished.</p>
                      <span className="notif-time">1 hour ago</span>
                    </div>
                    <div className="notif-item">
                      <span className="notif-title">Security Alert</span>
                      <p className="notif-desc">Unauthorized platform access attempt logged & blocked.</p>
                      <span className="notif-time">3 hours ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="user-profile-menu">
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="user-avatar">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="user-info">
                  <span className="user-name">{user?.name}</span>
                  <span className="user-role">{user?.activeRole || (isSuperAdmin ? 'Super Admin' : 'User')}</span>
                </div>
                <ChevronDown size={14} className="user-dropdown-arrow" />
              </button>

              {userMenuOpen && (
                <div className="dropdown-panel user-dropdown">
                  <div className="user-dropdown-header">
                    <span className="signed-as">Signed in as</span>
                    <span className="user-email">{user?.email}</span>
                  </div>
                  <div className="dropdown-divider" />
                  <Link to="/settings" className="dropdown-link" onClick={() => setUserMenuOpen(false)}>
                    <Settings size={15} />
                    Account Settings
                  </Link>
                  <div className="dropdown-divider" />
                  <button type="button" className="dropdown-link logout-link" onClick={logout}>
                    <LogOut size={15} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

