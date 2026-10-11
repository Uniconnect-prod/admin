import React, { useState, useEffect } from 'react';
import {
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Database,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Plus,
  Trash2,
  Server,
  Layers,
  Settings,
  ShieldCheck,
  Zap,
  Clock,
  Radio,
  FileCode,
  Activity,
  Users
} from 'lucide-react';
import api from '../../services/api';

const TIMEZONE_OPTIONS = [
  { value: 'Africa/Accra', label: 'Africa/Accra (UTC+0, Ghana/Universal)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (UTC+1, West Africa)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (UTC+3, East Africa)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+5:30, IST)' }
];

const PRESET_COLORS = [
  '#00E676', // Emerald
  '#00E5FF', // Cyan
  '#FF6B00', // Neon Orange
  '#7C4DFF', // Deep Purple
  '#FFCC00', // MTN Yellow
  '#FF4081', // Pink
  '#3D5AFE'  // Indigo
];

const MODULE_OPTIONS = [
  'Subscribers',
  'Renewals',
  'Churn',
  'Revenue',
  'Quiz',
  'Reports'
];

export const PlatformWizardModal = ({
  isOpen,
  onClose,
  initialPlatform = null,
  onSuccess
}) => {
  const isEditing = Boolean(initialPlatform?.id);

  // Current wizard step (1 to 6)
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Step 1: Basic Details
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('Ghana');
  const [timezone, setTimezone] = useState('Africa/Accra');
  const [accentColor, setAccentColor] = useState('#00E5FF');
  const [enabledModules, setEnabledModules] = useState(['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports']);

  // Step 2: MongoDB Connection
  const [useDefaultCluster, setUseDefaultCluster] = useState(true);
  const [mongoUri, setMongoUri] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [tlsEnabled, setTlsEnabled] = useState(true);
  const [readPreference, setReadPreference] = useState('secondaryPreferred');
  const [showUri, setShowUri] = useState(false);

  // Connection Test State
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState(null);

  // Step 3: Schema Discovery
  const [discovering, setDiscovering] = useState(false);
  const [discoveredCollections, setDiscoveredCollections] = useState([]);
  const [subscribersCol, setSubscribersCol] = useState('users');
  const [sdpLogsCol, setSdpLogsCol] = useState('sdplog');
  const [callbacksCol, setCallbacksCol] = useState('ghanacallbacklogs');
  const [sampleDocuments, setSampleDocuments] = useState({});
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingCol, setInspectingCol] = useState(null);

  // Step 4: Field Mapping
  const [mappings, setMappings] = useState({
    msisdn: 'msisdn',
    timestamp: 'createdAt',
    transaction_id: 'transactionId',
    command: 'command',
    status: 'status',
    subscription_status: 'subscriptionStatus',
    charge_amount: 'chargeAmount',
    offer_code: 'offerCode',
    failure_reason: 'reason',
    next_billing_date: 'nextBillingDate'
  });

  // Step 5: Offers Catalog
  const [offers, setOffers] = useState([
    { code: '9923310010', name: 'Daily Access Plan', type: 'daily', price: 1.0, is_default: true }
  ]);

  // Step 6: Validation & Activation
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [confirmActivation, setConfirmActivation] = useState(false);
  const [activating, setActivating] = useState(false);

  // Saved Platform ID (assigned once created or from initialPlatform)
  const [platformId, setPlatformId] = useState(initialPlatform?.id || null);

  // Initialize or reset form state
  useEffect(() => {
    if (initialPlatform) {
      setPlatformId(initialPlatform.id);
      setName(initialPlatform.name || '');
      setCode(initialPlatform.code || '');
      setDescription(initialPlatform.description || '');
      setCountry(initialPlatform.country || 'Ghana');
      setTimezone(initialPlatform.business_timezone || 'Africa/Accra');
      setAccentColor(initialPlatform.accent_color || '#00E5FF');
      setEnabledModules(initialPlatform.enabled_modules || ['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports']);

      const conn = initialPlatform.connection || {};
      setMongoUri(conn.mongo_uri || initialPlatform.mongo_uri || '');
      setUseDefaultCluster(!conn.mongo_uri);
      setDatabaseName(conn.database_name || initialPlatform.database_name || initialPlatform.name || '');
      setTlsEnabled(conn.tls_enabled !== false);
      setReadPreference(conn.read_preference || 'secondaryPreferred');

      const cols = initialPlatform.collections || {};
      setSubscribersCol(cols.subscribers || 'users');
      setSdpLogsCol(cols.sdp_logs || initialPlatform.collection_sdp || 'sdplog');
      setCallbacksCol(cols.callbacks || initialPlatform.collection_callback || 'ghanacallbacklogs');

      if (initialPlatform.mappings) {
        setMappings(prev => ({ ...prev, ...initialPlatform.mappings }));
      }

      if (Array.isArray(initialPlatform.offers) && initialPlatform.offers.length > 0) {
        setOffers(initialPlatform.offers);
      }
    } else {
      setPlatformId(null);
      setName('');
      setCode('');
      setDescription('');
      setCountry('Ghana');
      setTimezone('Africa/Accra');
      setAccentColor('#00E5FF');
      setEnabledModules(['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports']);
      setUseDefaultCluster(true);
      setMongoUri('');
      setDatabaseName('');
      setTlsEnabled(true);
      setReadPreference('secondaryPreferred');
      setSubscribersCol('users');
      setSdpLogsCol('sdplog');
      setCallbacksCol('ghanacallbacklogs');
      setMappings({
        msisdn: 'msisdn',
        timestamp: 'createdAt',
        transaction_id: 'transactionId',
        command: 'command',
        status: 'status',
        subscription_status: 'subscriptionStatus',
        charge_amount: 'chargeAmount',
        offer_code: 'offerCode',
        failure_reason: 'reason',
        next_billing_date: 'nextBillingDate'
      });
      setOffers([
        { code: '9923310010', name: 'Daily Access Plan', type: 'daily', price: 1.0, is_default: true }
      ]);
      setConnResult(null);
      setValidationResult(null);
      setCurrentStep(1);
    }
    setErrorMsg(null);
  }, [initialPlatform, isOpen]);

  if (!isOpen) return null;

  // Handle module toggle
  const toggleModule = (mod) => {
    setEnabledModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  };

  // Test MongoDB Connection
  const handleTestConnection = async () => {
    try {
      setTestingConn(true);
      setConnResult(null);
      setErrorMsg(null);

      const targetDb = databaseName.trim() || code.trim().toLowerCase();
      if (!targetDb) {
        setErrorMsg('Please enter a Database Name to test connection.');
        setTestingConn(false);
        return;
      }

      const res = await api.post(
        platformId
          ? `/platform-management/${platformId}/test-connection`
          : '/platform-management/test-connection',
        {
          mongo_uri: useDefaultCluster ? '' : mongoUri,
          database_name: targetDb
        }
      );

      if (res.data?.success) {
        setConnResult(res.data.data);
      } else {
        setConnResult({ success: false, error: res.data?.message || 'Connection failed' });
      }
    } catch (err) {
      setConnResult({
        success: false,
        error: err.response?.data?.message || err.message || 'Connection failed.'
      });
    } finally {
      setTestingConn(false);
    }
  };

  // Discover Collections & Schema
  const handleDiscoverSchema = async () => {
    try {
      setDiscovering(true);
      setErrorMsg(null);

      const targetDb = databaseName.trim() || code.trim().toLowerCase();
      const res = await api.post(
        platformId
          ? `/platform-management/${platformId}/discover-schema`
          : '/platform-management/discover-schema',
        {
          mongo_uri: useDefaultCluster ? '' : mongoUri,
          database_name: targetDb,
          sample_collections: [subscribersCol, sdpLogsCol, callbacksCol].filter(Boolean)
        }
      );

      if (res.data?.success) {
        const { collections, samples, suggestedMappings } = res.data.data;
        setDiscoveredCollections(collections || []);
        setSampleDocuments(samples || {});

        // Apply suggestions if available
        if (suggestedMappings) {
          if (suggestedMappings.collections?.subscribers) {
            setSubscribersCol(suggestedMappings.collections.subscribers);
          }
          if (suggestedMappings.collections?.sdp_logs) {
            setSdpLogsCol(suggestedMappings.collections.sdp_logs);
          }
          if (suggestedMappings.collections?.callbacks) {
            setCallbacksCol(suggestedMappings.collections.callbacks);
          }

          setMappings(prev => ({
            ...prev,
            msisdn: suggestedMappings.msisdn || prev.msisdn,
            timestamp: suggestedMappings.timestamp || prev.timestamp,
            transaction_id: suggestedMappings.transaction_id || prev.transaction_id,
            command: suggestedMappings.command || prev.command,
            status: suggestedMappings.status || prev.status,
            subscription_status: suggestedMappings.subscription_status || prev.subscription_status,
            charge_amount: suggestedMappings.charge_amount || prev.charge_amount,
            offer_code: suggestedMappings.offer_code || prev.offer_code,
            failure_reason: suggestedMappings.failure_reason || prev.failure_reason,
            next_billing_date: suggestedMappings.next_billing_date || prev.next_billing_date
          }));
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to inspect database schema.');
    } finally {
      setDiscovering(false);
    }
  };

  // Add / Remove Offer
  const handleAddOffer = () => {
    setOffers(prev => [
      ...prev,
      {
        code: `99233100${prev.length + 11}`,
        name: `Offer ${prev.length + 1}`,
        type: 'daily',
        price: 1.0,
        is_default: false
      }
    ]);
  };

  const handleUpdateOffer = (idx, field, val) => {
    setOffers(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveOffer = (idx) => {
    if (offers.length <= 1) return;
    setOffers(prev => prev.filter((_, i) => i !== idx));
  };

  // Step 6: Run Read-Only Validation
  const handleRunValidation = async () => {
    try {
      setValidating(true);
      setErrorMsg(null);

      const targetDb = databaseName.trim() || code.trim().toLowerCase();
      const payload = {
        name,
        code: code.trim().toUpperCase(),
        database_name: targetDb,
        connection: {
          mongo_uri: useDefaultCluster ? '' : mongoUri,
          database_name: targetDb,
          tls_enabled: tlsEnabled,
          read_preference: readPreference
        },
        collections: {
          subscribers: subscribersCol,
          sdp_logs: sdpLogsCol,
          callbacks: callbacksCol
        },
        mappings,
        offers
      };

      const res = await api.post(
        platformId
          ? `/platform-management/${platformId}/validate`
          : '/platform-management/1/validate', // dry-run fallback
        payload
      );

      if (res.data?.success) {
        setValidationResult(res.data.data);
      } else {
        setErrorMsg(res.data?.message || 'Validation failed.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Validation failed.');
    } finally {
      setValidating(false);
    }
  };

  // Save or Update Platform Draft
  const handleSavePlatform = async (transitionToNext = true) => {
    try {
      setSaving(true);
      setErrorMsg(null);

      const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
      const targetDb = databaseName.trim() || cleanCode.toLowerCase();

      const payload = {
        name: name.trim(),
        code: cleanCode,
        description: description.trim(),
        country: country.trim(),
        business_timezone: timezone,
        accent_color: accentColor,
        enabled_modules: enabledModules,
        database_name: targetDb,
        connection: {
          mongo_uri: useDefaultCluster ? '' : mongoUri,
          database_name: targetDb,
          tls_enabled: tlsEnabled,
          read_preference: readPreference
        },
        collections: {
          subscribers: subscribersCol,
          sdp_logs: sdpLogsCol,
          callbacks: callbacksCol
        },
        mappings,
        offers
      };

      let savedPlat = null;
      if (platformId) {
        const res = await api.put(`/platform-management/${platformId}`, payload);
        savedPlat = res.data?.data;
      } else {
        const res = await api.post('/platform-management', payload);
        savedPlat = res.data?.data;
        if (savedPlat?.id) {
          setPlatformId(savedPlat.id);
        }
      }

      if (transitionToNext && currentStep < 6) {
        setCurrentStep(prev => prev + 1);
      }

      return savedPlat;
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save platform configuration.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Step 6: Final Activation
  const handleActivatePlatform = async () => {
    if (!platformId) {
      setErrorMsg('Please save the platform before activating.');
      return;
    }
    if (!confirmActivation) {
      setErrorMsg('Please check the confirmation box to activate this platform.');
      return;
    }

    try {
      setActivating(true);
      setErrorMsg(null);
      const res = await api.post(`/platform-management/${platformId}/activate`);
      if (res.data?.success) {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to activate platform.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="modal-backdrop fade-in">
      <div className="modal-container platform-wizard-modal">
        {/* Wizard Header */}
        <div className="modal-header">
          <div className="wizard-title-group">
            <div className="wizard-icon-box" style={{ background: `${accentColor}20`, color: accentColor }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 className="modal-title">
                {isEditing ? `Configure Platform: ${name || code}` : 'Add New Digital Platform Wizard'}
              </h3>
              <p className="wizard-subtitle">
                Connect and configure a multi-tenant MongoDB platform without redeploying backend code.
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="wizard-stepper-bar">
          {[
            { num: 1, title: 'Basic Details', icon: Settings },
            { num: 2, title: 'MongoDB Connection', icon: Database },
            { num: 3, title: 'Discovery', icon: Server },
            { num: 4, title: 'Field Mapping', icon: FileCode },
            { num: 5, title: 'Offers Catalog', icon: Zap },
            { num: 6, title: 'Validation & Live', icon: ShieldCheck }
          ].map(s => {
            const isCompleted = s.num < currentStep;
            const isCurrent = s.num === currentStep;
            const Icon = s.icon;
            return (
              <button
                key={s.num}
                type="button"
                className={`wizard-step-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
                onClick={() => {
                  if (platformId || s.num <= currentStep) {
                    setCurrentStep(s.num);
                  }
                }}
              >
                <div className="step-circle">
                  {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <div className="step-label">
                  <span className="step-index">STEP {s.num}</span>
                  <span className="step-title">{s.title}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Wizard Body */}
        <div className="modal-body wizard-body">
          {errorMsg && (
            <div className="alert alert-danger mb-4 d-flex align-items-center gap-2">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 1: BASIC DETAILS */}
          {/* ========================================================== */}
          {currentStep === 1 && (
            <div className="wizard-step-content fade-in">
              <h4 className="section-title">1. Platform Metadata & Regional Profile</h4>
              <p className="section-desc">
                Provide core tenant identification, business timezone, and enabled reporting modules.
              </p>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="required-label">Platform Display Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. GhanaGameium or SuperWinnings"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <small className="form-hint">Friendly name shown across navigation and headers.</small>
                </div>

                <div className="form-group">
                  <label className="required-label">Unique Platform Code</label>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="e.g. GHGAMEZONE"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={isEditing}
                    required
                  />
                  <small className="form-hint">Used in API headers (`x-platform-code`). Permanent identifier.</small>
                </div>
              </div>

              <div className="form-grid-2 mt-3">
                <div className="form-group">
                  <label>Country / Market</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ghana"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="required-label">Business Timezone</label>
                  <select
                    className="form-control"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONE_OPTIONS.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <small className="form-hint">Used to calculate exact calendar boundaries for daily settlement.</small>
                </div>
              </div>

              <div className="form-group mt-3">
                <label>Platform Description</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="Describe service offerings, target audience, and telco partner..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group mt-3">
                <label>Platform Accent Color</label>
                <div className="color-swatches-grid">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch-btn ${accentColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setAccentColor(c)}
                    >
                      {accentColor === c && <Check size={16} color="#000" />}
                    </button>
                  ))}
                  <input
                    type="text"
                    className="form-control font-mono custom-color-input"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ width: '110px' }}
                  />
                </div>
              </div>

              <div className="form-group mt-4">
                <label className="d-block mb-2">Enabled Reporting & Content Modules</label>
                <div className="modules-toggle-grid">
                  {MODULE_OPTIONS.map(mod => {
                    const isChecked = enabledModules.includes(mod);
                    return (
                      <label key={mod} className={`module-chip ${isChecked ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(mod)}
                        />
                        <span>{mod}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 2: MONGODB CONNECTION */}
          {/* ========================================================== */}
          {currentStep === 2 && (
            <div className="wizard-step-content fade-in">
              <h4 className="section-title">2. MongoDB Cluster & Secure Read-Only Access</h4>
              <p className="section-desc">
                Provide connection parameters for the target database. Production sources are strictly guarded in READ-ONLY mode.
              </p>

              <div className="cluster-mode-selector mb-3">
                <label className={`mode-card ${useDefaultCluster ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="clusterMode"
                    checked={useDefaultCluster}
                    onChange={() => setUseDefaultCluster(true)}
                  />
                  <div>
                    <strong>Shared Source Cluster (Recommended)</strong>
                    <p>Connects to the primary MongoDB cluster configured in server environment.</p>
                  </div>
                </label>

                <label className={`mode-card ${!useDefaultCluster ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="clusterMode"
                    checked={!useDefaultCluster}
                    onChange={() => setUseDefaultCluster(false)}
                  />
                  <div>
                    <strong>Independent MongoDB Connection URI</strong>
                    <p>Provide a dedicated connection string for external or isolated databases.</p>
                  </div>
                </label>
              </div>

              {!useDefaultCluster && (
                <div className="form-group mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="required-label">MongoDB Connection URI</label>
                    <button
                      type="button"
                      className="btn-text-link"
                      onClick={() => setShowUri(!showUri)}
                    >
                      {showUri ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showUri ? 'Hide Secret' : 'Show URI'}
                    </button>
                  </div>
                  <input
                    type={showUri ? 'text' : 'password'}
                    className="form-control font-mono"
                    placeholder="mongodb+srv://username:password@cluster.mongodb.net/dbname"
                    value={mongoUri}
                    onChange={(e) => setMongoUri(e.target.value)}
                  />
                  <small className="form-hint">
                    Credentials are encrypted and strictly masked as `****` in UI and audit logs.
                  </small>
                </div>
              )}

              <div className="form-grid-2 mt-3">
                <div className="form-group">
                  <label className="required-label">Database Name</label>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="e.g. ghanagameium or ghsuperwinings"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    required
                  />
                  <small className="form-hint">The target database within the cluster.</small>
                </div>

                <div className="form-group">
                  <label>Read Preference</label>
                  <select
                    className="form-control"
                    value={readPreference}
                    onChange={(e) => setReadPreference(e.target.value)}
                  >
                    <option value="secondaryPreferred">secondaryPreferred (Recommended for Reporting)</option>
                    <option value="primaryPreferred">primaryPreferred</option>
                    <option value="secondary">secondary</option>
                  </select>
                </div>
              </div>

              {/* Test Connection Button and Outcome Banner */}
              <div className="test-conn-action-panel mt-4">
                <button
                  type="button"
                  className="btn btn-secondary btn-test-conn"
                  onClick={handleTestConnection}
                  disabled={testingConn}
                >
                  {testingConn ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      Testing Ping & Auth...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Test Connection
                    </>
                  )}
                </button>

                {connResult && (
                  <div className={`conn-status-banner ${connResult.success ? 'success' : 'failed'}`}>
                    {connResult.success ? (
                      <>
                        <CheckCircle2 size={18} className="text-success" />
                        <div>
                          <strong>Connection Verified!</strong>
                          <span className="ms-2 text-muted">Latency: {connResult.latencyMs}ms</span>
                          {connResult.collections && (
                            <span className="ms-2 badge badge-info">
                              {connResult.collections.length} collections detected
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={18} className="text-danger" />
                        <div>
                          <strong>Connection Failed:</strong>
                          <span className="ms-2">{connResult.error}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 3: DISCOVER DATABASE STRUCTURE */}
          {/* ========================================================== */}
          {currentStep === 3 && (
            <div className="wizard-step-content fade-in">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <h4 className="section-title mb-0">3. Schema Discovery & Collection Roles</h4>
                  <p className="section-desc mb-0">
                    Inspect accessible collections and assign roles for subscribers, transactions, and callbacks.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDiscoverSchema}
                  disabled={discovering}
                >
                  {discovering ? (
                    <Loader2 size={14} className="spin-animation" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Auto-Detect Collections
                </button>
              </div>

              {discoveredCollections.length > 0 && (
                <div className="discovered-collections-summary mb-3">
                  <span className="summary-title">Accessible Collections:</span>
                  <div className="collections-pill-scroller">
                    {discoveredCollections.map(c => (
                      <span key={c.name} className="collection-chip">
                        <Database size={12} />
                        {c.name}
                        <span className="doc-count">{c.documentCount.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="collection-roles-grid">
                <div className="role-card">
                  <div className="role-header">
                    <Users size={16} className="text-primary" />
                    <strong>1. Subscribers Registry</strong>
                  </div>
                  <p className="role-desc">Authoritative collection storing unique user memberships and status.</p>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="e.g. users or subscriptions"
                    value={subscribersCol}
                    onChange={(e) => setSubscribersCol(e.target.value)}
                  />
                </div>

                <div className="role-card">
                  <div className="role-header">
                    <Activity size={16} className="text-success" />
                    <strong>2. SDP / Transaction Logs</strong>
                  </div>
                  <p className="role-desc">Collection storing billing attempts, renewals, and charge transactions.</p>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="e.g. sdplog or sdplogs"
                    value={sdpLogsCol}
                    onChange={(e) => setSdpLogsCol(e.target.value)}
                  />
                </div>

                <div className="role-card">
                  <div className="role-header">
                    <Radio size={16} className="text-warning" />
                    <strong>3. Callbacks & Grace Parking</strong>
                  </div>
                  <p className="role-desc">Collection logging parking callbacks and redirect activations.</p>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="e.g. ghanacallbacklogs or callbacklogs"
                    value={callbacksCol}
                    onChange={(e) => setCallbacksCol(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 4: FIELD MAPPING */}
          {/* ========================================================== */}
          {currentStep === 4 && (
            <div className="wizard-step-content fade-in">
              <h4 className="section-title">4. Canonical Field Mappings</h4>
              <p className="section-desc">
                Map the platform's native source field names to the canonical reporting schema. Dot-notation paths (e.g., `data.msisdn`) are fully supported.
              </p>

              <div className="mapping-table-wrapper">
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Canonical Field</th>
                      <th style={{ width: '38%' }}>Source Field Path</th>
                      <th style={{ width: '34%' }}>Role & Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'msisdn', label: 'Subscriber / MSISDN', desc: 'Unique phone number or subscriber ID', required: true },
                      { key: 'timestamp', label: 'Event Timestamp', desc: 'Date/time when transaction occurred', required: true },
                      { key: 'transaction_id', label: 'Transaction ID', desc: 'Unique transaction or request reference', required: true },
                      { key: 'command', label: 'Command / Action', desc: 'e.g. NotifyRenewal, NotifyActivation', required: true },
                      { key: 'subscription_status', label: 'Subscription Status', desc: 'e.g. active, A, deactivated', required: true },
                      { key: 'charge_amount', label: 'Charge Amount', desc: 'Monetary value charged (GHC)', required: true },
                      { key: 'offer_code', label: 'Offer / Product Code', desc: 'Offer identifier (e.g. 9923310010)', required: true },
                      { key: 'failure_reason', label: 'Failure Reason', desc: 'Error message or insufficient balance', required: false },
                      { key: 'next_billing_date', label: 'Next Billing Date', desc: 'Scheduled recurring charge date', required: false }
                    ].map(row => (
                      <tr key={row.key}>
                        <td>
                          <strong>{row.label}</strong>
                          {row.required ? (
                            <span className="badge badge-required ms-2">Required</span>
                          ) : (
                            <span className="badge badge-optional ms-2">Optional</span>
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control font-mono"
                            value={mappings[row.key] || ''}
                            onChange={(e) => setMappings({ ...mappings, [row.key]: e.target.value })}
                            placeholder={`e.g. ${row.key}`}
                          />
                        </td>
                        <td className="field-desc-cell">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 5: OFFERS CONFIGURATION */}
          {/* ========================================================== */}
          {currentStep === 5 && (
            <div className="wizard-step-content fade-in">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="section-title mb-0">5. Offer Definitions & Billing Tiers</h4>
                  <p className="section-desc mb-0">
                    Define the subscription packages and product codes active on this platform.
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddOffer}>
                  <Plus size={14} />
                  Add Offer
                </button>
              </div>

              <div className="offers-builder-table-wrapper">
                <table className="offers-table">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Offer Code</th>
                      <th style={{ width: '35%' }}>Display Name</th>
                      <th style={{ width: '20%' }}>Billing Type</th>
                      <th style={{ width: '15%' }}>Price (GHC)</th>
                      <th style={{ width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((off, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="form-control font-mono"
                            value={off.code}
                            onChange={(e) => handleUpdateOffer(idx, 'code', e.target.value)}
                            placeholder="e.g. 9923310010"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={off.name}
                            onChange={(e) => handleUpdateOffer(idx, 'name', e.target.value)}
                            placeholder="e.g. Daily Trivia Pass"
                          />
                        </td>
                        <td>
                          <select
                            className="form-control"
                            value={off.type}
                            onChange={(e) => handleUpdateOffer(idx, 'type', e.target.value)}
                          >
                            <option value="daily">Daily</option>
                            <option value="ondemand">On-Demand</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={off.price}
                            onChange={(e) => handleUpdateOffer(idx, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          {offers.length > 1 && (
                            <button
                              type="button"
                              className="btn-icon text-danger"
                              onClick={() => handleRemoveOffer(idx)}
                              title="Delete Offer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 6: VALIDATION & ACTIVATION */}
          {/* ========================================================== */}
          {currentStep === 6 && (
            <div className="wizard-step-content fade-in">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="section-title mb-0">6. Read-Only Validation & Activation</h4>
                  <p className="section-desc mb-0">
                    Execute dry-run aggregation queries to verify collection accessibility, check records, and preview KPIs.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleRunValidation}
                  disabled={validating}
                >
                  {validating ? (
                    <>
                      <Loader2 size={14} className="spin-animation" />
                      Validating Live Data...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      Run Validation
                    </>
                  )}
                </button>
              </div>

              {validationResult ? (
                <div className="validation-results-panel">
                  {/* Validation Checks List */}
                  <div className="checks-list-card mb-3">
                    <h5 className="sub-title">System Checks:</h5>
                    <div className="checks-grid">
                      {validationResult.checks.map((chk, i) => (
                        <div key={i} className={`check-item ${chk.status.toLowerCase()}`}>
                          {chk.status === 'PASSED' ? (
                            <CheckCircle2 size={16} className="text-success" />
                          ) : chk.status === 'WARNING' ? (
                            <AlertTriangle size={16} className="text-warning" />
                          ) : (
                            <AlertCircle size={16} className="text-danger" />
                          )}
                          <div>
                            <strong>{chk.name}</strong>
                            <p>{chk.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Preview */}
                  {validationResult.metricsPreview && (
                    <div className="metrics-preview-grid mb-3">
                      <div className="metric-box">
                        <span className="metric-label">Total Subscribers</span>
                        <span className="metric-value">
                          {validationResult.metricsPreview.totalSubscribers?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Active Subscribers</span>
                        <span className="metric-value text-success">
                          {validationResult.metricsPreview.activeSubscribers?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Total Transactions</span>
                        <span className="metric-value">
                          {validationResult.metricsPreview.totalTransactions?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Sample Revenue</span>
                        <span className="metric-value text-primary">
                          GHC {validationResult.metricsPreview.sampleRevenue?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sample Normalized Records Preview */}
                  {validationResult.sampleRecords?.length > 0 && (
                    <div className="sample-records-preview mb-3">
                      <h5 className="sub-title">Normalized Records Preview (First 3):</h5>
                      <div className="table-responsive">
                        <table className="sample-table">
                          <thead>
                            <tr>
                              <th>MSISDN</th>
                              <th>Command</th>
                              <th>Status</th>
                              <th>Charge</th>
                              <th>Offer</th>
                              <th>Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validationResult.sampleRecords.slice(0, 3).map((r, idx) => (
                              <tr key={idx}>
                                <td className="font-mono">{r.msisdn}</td>
                                <td>{r.command}</td>
                                <td>
                                  <span className={`status-pill ${r.status.toLowerCase()}`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td>GHC {r.charge_amount.toFixed(2)}</td>
                                <td>{r.offer_name || r.offer_code}</td>
                                <td className="text-muted">{new Date(r.event_timestamp).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Activation Agreement */}
                  <div className="activation-confirmation-box">
                    <label className="confirmation-checkbox-label">
                      <input
                        type="checkbox"
                        checked={confirmActivation}
                        onChange={(e) => setConfirmActivation(e.target.checked)}
                      />
                      <span>
                        I confirm that these collections, mappings, and offers are verified and ready for live multi-tenant reporting.
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="validation-placeholder-card text-center p-4">
                  <ShieldCheck size={36} className="text-muted mb-2" />
                  <p className="text-secondary mb-2">Ready to run dry-run validation on this configuration.</p>
                  <p className="text-muted small">
                    Click <strong>"Run Validation"</strong> above to inspect live document structures without making any mutations.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="modal-footer wizard-footer">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentStep(prev => prev - 1)}
                disabled={saving || activating}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSavePlatform(false)}
              disabled={saving || activating || !name || !code}
            >
              {saving ? <Loader2 size={14} className="spin-animation" /> : 'Save Draft'}
            </button>

            {currentStep < 6 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSavePlatform(true)}
                disabled={saving || !name || !code}
              >
                Next Step
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success"
                onClick={handleActivatePlatform}
                disabled={activating || !confirmActivation}
              >
                {activating ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    Activating Platform...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Activate Platform
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
