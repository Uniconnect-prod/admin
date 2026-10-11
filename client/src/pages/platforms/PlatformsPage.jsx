import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Edit, ToggleLeft, ToggleRight, Check, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import './PlatformsPage.scss';

export const PlatformsPage = () => {
  const { user } = useAuth();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const availableModuleList = [
    'Subscribers',
    'Churn',
    'Revenue',
    'Quiz',
    'Reports'
  ];

  const [newPlatform, setNewPlatform] = useState({
    name: '',
    code: '',
    description: '',
    country: '',
    mongo_uri: '',
    database_name: '',
    collection_sdp: '',
    collection_callback: '',
    enabled_modules: ['Subscribers', 'Churn', 'Revenue', 'Reports']
  });

  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/platforms');
      if (res.data?.success) {
        setPlatforms(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load platforms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const handleToggleModuleInEdit = (modName) => {
    if (!selectedPlatform) return;
    const current = selectedPlatform.enabled_modules || [];
    const exists = current.includes(modName);
    const updated = exists ? current.filter(m => m !== modName) : [...current, modName];
    setSelectedPlatform({ ...selectedPlatform, enabled_modules: updated });
  };

  const handleToggleModuleInCreate = (modName) => {
    const current = newPlatform.enabled_modules || [];
    const exists = current.includes(modName);
    const updated = exists ? current.filter(m => m !== modName) : [...current, modName];
    setNewPlatform({ ...newPlatform, enabled_modules: updated });
  };

  const handleSaveEditPlatform = async () => {
    try {
      await api.put(`/platforms/${selectedPlatform.id}`, {
        name: selectedPlatform.name,
        description: selectedPlatform.description,
        enabled_modules: selectedPlatform.enabled_modules,
        status: selectedPlatform.status,
        country: selectedPlatform.country,
        mongo_uri: selectedPlatform.mongo_uri,
        database_name: selectedPlatform.database_name,
        collection_sdp: selectedPlatform.collection_sdp,
        collection_callback: selectedPlatform.collection_callback
      });
      alert('Platform configuration saved successfully.');
      setEditModalOpen(false);
      fetchPlatforms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update platform.');
    }
  };

  const handleCreatePlatform = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/platforms', newPlatform);
      if (res.data?.success) {
        alert('Platform registered successfully.');
        setCreateModalOpen(false);
        setNewPlatform({
          name: '',
          code: '',
          description: '',
          country: '',
          mongo_uri: '',
          database_name: '',
          collection_sdp: '',
          collection_callback: '',
          enabled_modules: ['Subscribers', 'Churn', 'Revenue', 'Reports']
        });
        fetchPlatforms();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create platform.');
    }
  };

  const columns = [
    {
      header: 'Platform Name',
      key: 'name',
      render: (row) => (
        <div className="platform-name-col">
          <strong>{row.name}</strong>
          <span className="platform-code-tag">{row.code}</span>
        </div>
      )
    },
    {
      header: 'Country',
      key: 'country',
      render: (row) => <span className="platform-desc-text">{row.country || '—'}</span>
    },
    {
      header: 'Description',
      key: 'description',
      render: (row) => <span className="platform-desc-text">{row.description || '—'}</span>
    },
    {
      header: 'Enabled Modules',
      key: 'enabled_modules',
      render: (row) => (
        <div className="modules-pill-grid">
          {(row.enabled_modules || []).map((m) => (
            <span key={m} className="module-badge">
              <Check size={11} />
              {m}
            </span>
          ))}
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Created At',
      key: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleDateString()
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setSelectedPlatform(row);
            setEditModalOpen(true);
          }}
        >
          <Edit size={13} />
          Configure Modules
        </button>
      )
    }
  ];

  return (
    <div className="platforms-page">
      <PageHeader
        title="Platform & Multi-Tenant Registry"
        subtitle="Manage registered digital service platforms, API tenants and feature module flags (Super Admin)"
        breadcrumbs={['Home', 'Platform Management', 'All Platforms']}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={15} />
            Add New Platform
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={platforms}
        loading={loading}
        emptyMessage="No platforms registered."
      />

      {/* Configure Modules Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={selectedPlatform ? `Configure Modules for ${selectedPlatform.name}` : 'Platform Config'}
        maxWidth="520px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveEditPlatform}>
              Save Configuration
            </button>
          </>
        }
      >
        {selectedPlatform && (
          <div className="platform-config-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
            <p className="config-hint">
              Enable or disable specific reporting and content modules for this platform. Changes dynamically update navigation and dashboard layout for users on this platform.
            </p>

            <div className="form-group mt-3">
              <label>Country</label>
              <input
                type="text"
                className="form-control"
                value={selectedPlatform.country || ''}
                onChange={(e) => setSelectedPlatform({ ...selectedPlatform, country: e.target.value })}
              />
            </div>
            <div className="form-group mt-3">
              <label>MongoDB URI</label>
              <input
                type="text"
                className="form-control"
                value={selectedPlatform.mongo_uri || ''}
                onChange={(e) => setSelectedPlatform({ ...selectedPlatform, mongo_uri: e.target.value })}
              />
            </div>
            <div className="form-group mt-3">
              <label>Database Name</label>
              <input
                type="text"
                className="form-control"
                value={selectedPlatform.database_name || ''}
                onChange={(e) => setSelectedPlatform({ ...selectedPlatform, database_name: e.target.value })}
              />
            </div>
            <div className="form-group mt-3">
              <label>SDP Logs Collection</label>
              <input
                type="text"
                className="form-control"
                value={selectedPlatform.collection_sdp || ''}
                onChange={(e) => setSelectedPlatform({ ...selectedPlatform, collection_sdp: e.target.value })}
              />
            </div>
            <div className="form-group mt-3 mb-4">
              <label>Callback Logs Collection</label>
              <input
                type="text"
                className="form-control"
                value={selectedPlatform.collection_callback || ''}
                onChange={(e) => setSelectedPlatform({ ...selectedPlatform, collection_callback: e.target.value })}
              />
            </div>

            <label className="mod-label mt-2 d-block">Enabled Modules:</label>
            <div className="module-toggle-list">
              {availableModuleList.map((m) => {
                const isEnabled = (selectedPlatform.enabled_modules || []).includes(m);
                return (
                  <div key={m} className={`module-toggle-row ${isEnabled ? 'enabled' : ''}`}>
                    <div className="mod-info">
                      <strong>{m} Module</strong>
                      <span>{m === 'Quiz' ? 'Trivia creation, question banking, and rewards' : `${m} metrics and analytics`}</span>
                    </div>
                    <button
                      type="button"
                      className="mod-toggle-btn"
                      onClick={() => handleToggleModuleInEdit(m)}
                    >
                      {isEnabled ? (
                        <ToggleRight size={28} className="toggle-on text-primary" />
                      ) : (
                        <ToggleLeft size={28} className="toggle-off text-muted" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Create New Platform Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register New Digital Platform"
        maxWidth="540px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCreatePlatform}>
              Register Platform
            </button>
          </>
        }
      >
        <form onSubmit={handleCreatePlatform} className="create-platform-form">
          <div className="form-group">
            <label>Platform Display Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. GHLearn Portal"
              value={newPlatform.name}
              onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Unique Platform Code</label>
            <input
              type="text"
              className="form-control font-mono"
              placeholder="e.g. GHLEARN"
              value={newPlatform.code}
              onChange={(e) => setNewPlatform({ ...newPlatform, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              rows={2}
              className="form-control"
              placeholder="Brief description of service offerings..."
              value={newPlatform.description}
              onChange={(e) => setNewPlatform({ ...newPlatform, description: e.target.value })}
            />
          </div>

          <div className="form-group mt-2">
            <label>Country</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Ghana"
              value={newPlatform.country}
              onChange={(e) => setNewPlatform({ ...newPlatform, country: e.target.value })}
            />
          </div>

          <div className="form-group mt-2">
            <label>MongoDB URI</label>
            <input
              type="text"
              className="form-control"
              placeholder="mongodb://..."
              value={newPlatform.mongo_uri}
              onChange={(e) => setNewPlatform({ ...newPlatform, mongo_uri: e.target.value })}
            />
          </div>

          <div className="form-group mt-2">
            <label>Database Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. ghanagameium"
              value={newPlatform.database_name}
              onChange={(e) => setNewPlatform({ ...newPlatform, database_name: e.target.value })}
            />
          </div>

          <div className="form-group mt-2">
            <label>SDP Logs Collection</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. sdplogs"
              value={newPlatform.collection_sdp}
              onChange={(e) => setNewPlatform({ ...newPlatform, collection_sdp: e.target.value })}
            />
          </div>

          <div className="form-group mt-2">
            <label>Callback Logs Collection</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. ghanacallbacklogs"
              value={newPlatform.collection_callback}
              onChange={(e) => setNewPlatform({ ...newPlatform, collection_callback: e.target.value })}
            />
          </div>

          <div className="form-divider" />
          <label className="mod-label">Initial Enabled Modules:</label>
          <div className="modules-checkbox-grid">
            {availableModuleList.map((m) => {
              const checked = (newPlatform.enabled_modules || []).includes(m);
              return (
                <label key={m} className="mod-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleModuleInCreate(m)}
                  />
                  <span>{m}</span>
                </label>
              );
            })}
          </div>
        </form>
      </Modal>
    </div>
  );
};

