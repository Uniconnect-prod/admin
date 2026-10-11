import React, { useState, useEffect, useCallback } from 'react';
import { 
  UserPlus, Edit2, KeyRound, ShieldAlert, Trash2, CheckCircle, XCircle, 
  Calendar, Shield, Clock, AlertTriangle, AlertCircle, Check
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import './UsersPage.scss';

export const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allPlatforms, setAllPlatforms] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedUserPlatforms, setExpandedUserPlatforms] = useState({});

  const toggleExpandUserPlatforms = (userId) => {
    setExpandedUserPlatforms(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const getDefaultStartDate = () => new Date().toISOString().split('T')[0];
  const getDefaultEndDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  // Add User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    country: 'Ghana',
    status: 'ACTIVE',
    platform_assignments: [] // [{ platform_id, role_id, start_date, end_date, status }]
  });

  // Edit User Form State
  const [editUser, setEditUser] = useState({
    id: null,
    name: '',
    email: '',
    username: '',
    country: 'Ghana',
    status: 'ACTIVE',
    platform_assignments: []
  });

  const [newPassword, setNewPassword] = useState('');

  const fetchUsersAndMeta = useCallback(async () => {
    try {
      setLoading(true);
      const [uRes, rRes, pRes, cRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/platforms'),
        api.get('/countries?status=ACTIVE')
      ]);

      if (uRes.data?.success) setUsers(uRes.data.data);
      if (rRes.data?.success) setRoles(rRes.data.data);
      if (pRes.data?.success) setAllPlatforms(pRes.data.data);
      if (cRes.data?.success) setCountries(cRes.data.data);
    } catch (err) {
      console.error('Failed to load user management data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndMeta();
  }, [fetchUsersAndMeta]);

  // ==================== ADD USER HANDLERS ====================
  const handleTogglePlatformAssignment = (platformId, roleId = 4) => {
    setFormError('');
    setNewUser(prev => {
      const exists = prev.platform_assignments.some(a => a.platform_id === platformId);
      let updated;
      if (exists) {
        updated = prev.platform_assignments.filter(a => a.platform_id !== platformId);
      } else {
        updated = [
          ...prev.platform_assignments,
          {
            platform_id: platformId,
            role_id: roleId,
            start_date: getDefaultStartDate(),
            end_date: getDefaultEndDate(),
            status: 'ACTIVE'
          }
        ];
      }
      return { ...prev, platform_assignments: updated };
    });
  };

  const handleUpdatePlatformAssignmentField = (platformId, field, value) => {
    setFormError('');
    setNewUser(prev => ({
      ...prev,
      platform_assignments: prev.platform_assignments.map(a =>
        a.platform_id === platformId ? { ...a, [field]: value } : a
      )
    }));
  };

  const validateAssignments = (assignments) => {
    for (const a of assignments) {
      if (a.start_date && a.end_date) {
        const start = new Date(a.start_date).getTime();
        const end = new Date(a.end_date).getTime();
        if (start > end) {
          const plat = allPlatforms.find(p => p.id === a.platform_id);
          return `Start Date (${a.start_date}) cannot be after End Date (${a.end_date}) for ${plat?.name || 'selected platform'}.`;
        }
      }
    }
    return null;
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (newUser.password !== newUser.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    const dateErr = validateAssignments(newUser.platform_assignments);
    if (dateErr) {
      setFormError(dateErr);
      return;
    }

    try {
      const res = await api.post('/users', newUser);
      if (res.data?.success) {
        setCreateModalOpen(false);
        setNewUser({
          name: '',
          email: '',
          username: '',
          password: '',
          confirmPassword: '',
          country: 'Ghana',
          status: 'ACTIVE',
          platform_assignments: []
        });
        fetchUsersAndMeta();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create user.');
    }
  };

  // ==================== EDIT USER HANDLERS ====================
  const handleOpenEditModal = (userRow) => {
    setSelectedUser(userRow);
    setFormError('');
    const assignments = (userRow.platforms || []).map(p => ({
      platform_id: p.platform_id,
      role_id: p.role_id,
      start_date: p.start_date ? p.start_date.split('T')[0].split(' ')[0] : getDefaultStartDate(),
      end_date: p.end_date ? p.end_date.split('T')[0].split(' ')[0] : getDefaultEndDate(),
      status: p.configured_status || (p.computed_status === 'REVOKED' ? 'REVOKED' : 'ACTIVE')
    }));

    setEditUser({
      id: userRow.id,
      name: userRow.name || '',
      email: userRow.email || '',
      username: userRow.username || '',
      country: userRow.country || 'Ghana',
      status: userRow.status || 'ACTIVE',
      platform_assignments: assignments
    });
    setEditModalOpen(true);
  };

  const handleToggleEditPlatformAssignment = (platformId, roleId = 4) => {
    setFormError('');
    setEditUser(prev => {
      const exists = prev.platform_assignments.some(a => a.platform_id === platformId);
      let updated;
      if (exists) {
        updated = prev.platform_assignments.filter(a => a.platform_id !== platformId);
      } else {
        updated = [
          ...prev.platform_assignments,
          {
            platform_id: platformId,
            role_id: roleId,
            start_date: getDefaultStartDate(),
            end_date: getDefaultEndDate(),
            status: 'ACTIVE'
          }
        ];
      }
      return { ...prev, platform_assignments: updated };
    });
  };

  const handleUpdateEditPlatformAssignmentField = (platformId, field, value) => {
    setFormError('');
    setEditUser(prev => ({
      ...prev,
      platform_assignments: prev.platform_assignments.map(a =>
        a.platform_id === platformId ? { ...a, [field]: value } : a
      )
    }));
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const dateErr = validateAssignments(editUser.platform_assignments);
    if (dateErr) {
      setFormError(dateErr);
      return;
    }

    try {
      const res = await api.put(`/users/${editUser.id}`, editUser);
      if (res.data?.success) {
        setEditModalOpen(false);
        fetchUsersAndMeta();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update user.');
    }
  };

  // ==================== RESET PASSWORD & DELETE ====================
  const handleResetPasswordSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    try {
      await api.put(`/users/${selectedUser.id}/reset-password`, { newPassword });
      alert('Password updated successfully.');
      setResetModalOpen(false);
      setNewPassword('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate and remove this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchUsersAndMeta();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const columns = [
    {
      header: 'Full Name',
      key: 'name',
      render: (row) => (
        <div className="user-name-cell">
          <strong>{row.name}</strong>
          <span className="user-username">@{row.username}</span>
        </div>
      )
    },
    {
      header: 'Email',
      key: 'email',
      render: (row) => <span className="text-secondary">{row.email}</span>
    },
    {
      header: 'Assigned Country',
      key: 'country',
      render: (row) => (
        <span
          style={{
            background: '#f1f5f9',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'inline-block'
          }}
        >
          {row.country || 'Ghana'}
        </span>
      )
    },
    {
      header: 'Platform Access & Validity Window',
      key: 'platforms',
      render: (row) => {
        const plats = row.platforms || [];
        if (plats.length === 0) {
          return (
            <div className="platforms-pills-list">
              <span className="text-muted no-access-tag">No platform authorizations</span>
            </div>
          );
        }
        const isExpanded = !!expandedUserPlatforms[row.id];
        const visiblePlats = isExpanded ? plats : [plats[0]];

        return (
          <div className="platforms-pills-list">
            {visiblePlats.map((p) => {
              const startDateStr = p.start_date ? p.start_date.split('T')[0].split(' ')[0] : '—';
              const endDateStr = p.end_date ? p.end_date.split('T')[0].split(' ')[0] : '—';
              return (
                <div key={p.platform_id} className={`platform-access-badge-card status-${(p.computed_status || 'active').toLowerCase()}`}>
                  <div className="badge-platform-line">
                    <span className="badge-p-name">{p.platform_name}</span>
                    <span className="badge-p-role">({p.role_name})</span>
                    <StatusBadge status={p.computed_status} />
                  </div>
                  <div className="badge-date-window">
                    <Calendar size={11} className="date-icon" />
                    <span>{startDateStr} to {endDateStr}</span>
                    {p.isExpiringSoon && (
                      <span className="expiring-tag" title={`Expires in ${p.daysUntilExpiry} days`}>
                        ⏳ {p.daysUntilExpiry}d left
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {plats.length > 1 && (
              <button
                type="button"
                className={`expand-plat-btn ${isExpanded ? 'collapse' : ''}`}
                onClick={() => toggleExpandUserPlatforms(row.id)}
              >
                {isExpanded ? 'Show less ▲' : `+${plats.length - 1} more`}
              </button>
            )}
          </div>
        );
      }
    },
    {
      header: 'Account Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Last Login',
      key: 'last_login_at',
      render: (row) => (row.last_login_at ? new Date(row.last_login_at).toLocaleString() : 'Never')
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (row) => (
        <div className="table-actions-group">
          {user?.isSuperAdmin && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => handleOpenEditModal(row)}
              title="Edit User & Platform Access"
            >
              <Edit2 size={15} />
            </button>
          )}
          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              setSelectedUser(row);
              setResetModalOpen(true);
            }}
            title="Reset Password"
          >
            <KeyRound size={15} />
          </button>
          {user?.isSuperAdmin && (
            <button
              type="button"
              className="btn-icon text-danger"
              onClick={() => handleDeleteUser(row.id)}
              title="Delete User"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="users-page">
      <PageHeader
        title="User Management & Date-Wise Access Control"
        subtitle="Provision enterprise operators, enforce platform-specific authorizations and validity date windows"
        breadcrumbs={['Home', 'User Management', 'All Users']}
        actions={
          user?.isSuperAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => { setFormError(''); setCreateModalOpen(true); }}>
              <UserPlus size={15} />
              Add New User
            </button>
          ) : (
            <span className="read-only-badge">
              <ShieldAlert size={14} /> Read-Only Mode (Super Admin Required)
            </span>
          )
        }
      />

      {!user?.isSuperAdmin && (
        <div className="admin-notice-banner">
          <ShieldAlert size={18} />
          <div>
            <strong>Restricted Permissions:</strong> User creation, editing, and platform authorization modifications are restricted to Super Administrators.
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="No users registered in system."
      />

      {/* ==================== CREATE USER MODAL ==================== */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Provision New Enterprise User"
        maxWidth="740px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCreateUserSubmit}>
              Create User & Assign Access
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateUserSubmit} className="user-form-modal">
          {formError && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Kwame Boateng"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="user@enterprise.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={newUser.confirmPassword}
                onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-divider" />

          <div className="form-group mb-3">
            <label style={{ fontWeight: 600, color: '#1e293b' }}>Assigned Operating Country / Market</label>
            <select
              className="form-control"
              value={newUser.country}
              onChange={(e) => setNewUser({ ...newUser, country: e.target.value })}
            >
              {countries.map(c => (
                <option key={c.id} value={c.name}>{c.name} ({c.code}) - {c.currency}</option>
              ))}
              <option value="ALL">All Countries / Universal</option>
            </select>
            <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Assigning a country dynamically filters the platform selection below to platforms active in this market.
            </span>
          </div>

          <h4 className="platform-rbac-title">Platform Access & Validity Date Windows</h4>
          <p className="platform-rbac-sub">
            Select platform(s), assign specific roles, and define Start and End dates. Access is evaluated in real-time.
          </p>

          {(() => {
            const countryFilter = newUser.country;
            const displayedPlatforms = (countryFilter && countryFilter !== 'ALL')
              ? allPlatforms.filter(p => (p.country || 'Ghana').toLowerCase() === countryFilter.toLowerCase())
              : allPlatforms;

            return (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>
                    Available Platforms in {countryFilter === 'ALL' ? 'All Countries' : countryFilter} ({displayedPlatforms.length}):
                  </span>
                  {allPlatforms.length > displayedPlatforms.length && (
                    <button
                      type="button"
                      className="btn-link"
                      style={{ fontSize: '0.75rem', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer' }}
                      onClick={() => setNewUser({ ...newUser, country: 'ALL' })}
                    >
                      Show platforms from all countries
                    </button>
                  )}
                </div>

                <div className="platform-assign-rows">
                  {displayedPlatforms.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
                      No platforms found operating in {countryFilter}. Please add platforms for this country in Platforms Config or switch country.
                    </div>
                  ) : (
                    displayedPlatforms.map((p) => {
                      const assigned = newUser.platform_assignments.find(a => a.platform_id === p.id);
                      return (
                        <div key={p.id} className={`platform-assign-item ${assigned ? 'assigned' : ''}`}>
                          <div className="platform-top-row">
                            <label className="platform-checkbox-label">
                              <input
                                type="checkbox"
                                checked={!!assigned}
                                onChange={() => handleTogglePlatformAssignment(p.id)}
                              />
                              <span className="p-name">
                                <strong>{p.name}</strong> ({p.code})
                                <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', background: '#e2e8f0', color: '#475569', fontWeight: 500 }}>
                                  {p.country || 'Ghana'}
                                </span>
                              </span>
                            </label>

                            {assigned && (
                              <div className="role-and-status">
                                <select
                                  className="form-control role-select"
                                  value={assigned.role_id}
                                  onChange={(e) => handleUpdatePlatformAssignmentField(p.id, 'role_id', parseInt(e.target.value, 10))}
                                >
                                  {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {assigned && (
                            <div className="platform-dates-row">
                              <div className="date-input-group">
                                <label>Start Date</label>
                                <input
                                  type="date"
                                  className="form-control date-input"
                                  value={assigned.start_date || ''}
                                  onChange={(e) => handleUpdatePlatformAssignmentField(p.id, 'start_date', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="date-input-group">
                                <label>End Date</label>
                                <input
                                  type="date"
                                  className="form-control date-input"
                                  value={assigned.end_date || ''}
                                  onChange={(e) => handleUpdatePlatformAssignmentField(p.id, 'end_date', e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            );
          })()}
        </form>
      </Modal>

      {/* ==================== EDIT USER MODAL ==================== */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit User Access: ${editUser.name || editUser.username}`}
        maxWidth="740px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleEditUserSubmit}>
              Save Changes
            </button>
          </>
        }
      >
        <form onSubmit={handleEditUserSubmit} className="user-form-modal">
          {formError && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-grid-3">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="form-control"
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Account Status</label>
              <select
                className="form-control"
                value={editUser.status}
                onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          <div className="form-group mt-3">
            <label style={{ fontWeight: 600, color: '#1e293b' }}>Assigned Operating Country / Market</label>
            <select
              className="form-control"
              value={editUser.country}
              onChange={(e) => setEditUser({ ...editUser, country: e.target.value })}
            >
              {countries.map(c => (
                <option key={c.id} value={c.name}>{c.name} ({c.code}) - {c.currency}</option>
              ))}
              <option value="ALL">All Countries / Universal</option>
            </select>
            <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Assigning a country dynamically filters the platform selection below to platforms active in this market.
            </span>
          </div>

          <div className="form-divider" />

          <h4 className="platform-rbac-title">Manage Platform Authorizations & Date Windows</h4>
          <p className="platform-rbac-sub">
            Grant or revoke access, modify roles, and change the active date window per platform:
          </p>

          {(() => {
            const countryFilter = editUser.country;
            const displayedPlatforms = (countryFilter && countryFilter !== 'ALL')
              ? allPlatforms.filter(p => (p.country || 'Ghana').toLowerCase() === countryFilter.toLowerCase())
              : allPlatforms;

            return (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>
                    Available Platforms in {countryFilter === 'ALL' ? 'All Countries' : countryFilter} ({displayedPlatforms.length}):
                  </span>
                  {allPlatforms.length > displayedPlatforms.length && (
                    <button
                      type="button"
                      className="btn-link"
                      style={{ fontSize: '0.75rem', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer' }}
                      onClick={() => setEditUser({ ...editUser, country: 'ALL' })}
                    >
                      Show platforms from all countries
                    </button>
                  )}
                </div>

                <div className="platform-assign-rows">
                  {displayedPlatforms.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
                      No platforms found operating in {countryFilter}. Please add platforms for this country in Platforms Config or switch country.
                    </div>
                  ) : (
                    displayedPlatforms.map((p) => {
                      const assigned = editUser.platform_assignments.find(a => a.platform_id === p.id);
                      return (
                        <div key={p.id} className={`platform-assign-item ${assigned ? 'assigned' : ''}`}>
                          <div className="platform-top-row">
                            <label className="platform-checkbox-label">
                              <input
                                type="checkbox"
                                checked={!!assigned}
                                onChange={() => handleToggleEditPlatformAssignment(p.id)}
                              />
                              <span className="p-name">
                                <strong>{p.name}</strong> ({p.code})
                                <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', background: '#e2e8f0', color: '#475569', fontWeight: 500 }}>
                                  {p.country || 'Ghana'}
                                </span>
                              </span>
                            </label>

                            {assigned && (
                              <div className="role-and-status">
                                <select
                                  className="form-control role-select"
                                  value={assigned.role_id}
                                  onChange={(e) => handleUpdateEditPlatformAssignmentField(p.id, 'role_id', parseInt(e.target.value, 10))}
                                >
                                  {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                                <select
                                  className="form-control status-select"
                                  value={assigned.status || 'ACTIVE'}
                                  onChange={(e) => handleUpdateEditPlatformAssignmentField(p.id, 'status', e.target.value)}
                                >
                                  <option value="ACTIVE">Access: ACTIVE</option>
                                  <option value="REVOKED">Access: REVOKED</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {assigned && (
                            <div className="platform-dates-row">
                              <div className="date-input-group">
                                <label>Start Date</label>
                                <input
                                  type="date"
                                  className="form-control date-input"
                                  value={assigned.start_date || ''}
                                  onChange={(e) => handleUpdateEditPlatformAssignmentField(p.id, 'start_date', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="date-input-group">
                                <label>End Date</label>
                                <input
                                  type="date"
                                  className="form-control date-input"
                                  value={assigned.end_date || ''}
                                  onChange={(e) => handleUpdateEditPlatformAssignmentField(p.id, 'end_date', e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            );
          })()}
        </form>
      </Modal>

      {/* ==================== RESET PASSWORD MODAL ==================== */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Reset Password for ${selectedUser?.name}`}
        maxWidth="440px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setResetModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleResetPasswordSubmit}>
              Update Password
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>New Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
