import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Save, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import api, { describeError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, StatusBadge, PlatformAvatar } from '../../components/ui/primitives';
import { ErrorPanel, KpiSkeletonGrid, Alert } from '../../components/ui/feedback';
import { ConfirmDialog } from '../../components/ui/overlays';
import { STEPS, errorsToMap } from './wizard/wizardUtils';
import { StepDetails } from './wizard/StepDetails';
import { StepApi } from './wizard/StepApi';
import { StepParams } from './wizard/StepParams';
import { StepInspect } from './wizard/StepInspect';
import { StepMapping } from './wizard/StepMapping';
import { StepValidate } from './wizard/StepValidate';
import './Platforms.scss';

const EMPTY_DETAILS = { name: '', code: '', description: '', logo_url: '', accent_color: '#0170B9', country: '', business_timezone: 'Africa/Accra', currency: '', enabled_modules: ['overview', 'settlement'] };

const PlatformWizardPage = () => {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { refreshPlatforms } = useAuth();

  const [meta, setMeta] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [integration, setIntegration] = useState(null);
  const [secrets, setSecrets] = useState({});
  const [clearSecrets, setClearSecrets] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [presetId, setPresetId] = useState('blank');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeletePlatform = async () => {
    if (!platform?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/platform-management/${platform.id}`);
      toast.success(`Platform "${platform.name}" deleted.`);
      await refreshPlatforms?.();
      navigate('/platforms');
    } catch (err) {
      toast.error(`Delete failed: ${describeError(err).message}`);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const step = STEPS.some(s => s.id === searchParams.get('step')) ? searchParams.get('step') : 'details';
  const stepIndex = STEPS.findIndex(s => s.id === step);

  const goTo = useCallback((next) => {
    const params = new URLSearchParams(searchParams);
    params.set('step', next);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [metaRes, platformRes] = await Promise.all([
        api.get('/platform-management/meta'),
        isNew ? Promise.resolve(null) : api.get(`/platform-management/${id}`)
      ]);
      setMeta(metaRes.data.data);
      if (platformRes) {
        const p = platformRes.data.data;
        setPlatform(p);
        setDetails({
          name: p.name, code: p.code, description: p.description || '', logo_url: p.logo_url || '', accent_color: p.accent_color || '#0170B9',
          country: p.country || '', business_timezone: p.business_timezone || 'UTC', currency: p.currency || '', enabled_modules: p.enabled_modules
        });
        setIntegration(p.integration || metaRes.data.data.presets.find(x => x.id === 'blank').integration);
      } else {
        setIntegration(metaRes.data.data.presets.find(x => x.id === 'blank').integration);
      }
      setDirty(false);
    } catch (err) {
      setLoadError(describeError(err));
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const applyPreset = (pid) => {
    setPresetId(pid);
    const preset = meta.presets.find(p => p.id === pid);
    if (!preset) return;
    setIntegration(preset.integration);
    if (pid !== 'blank') {
      // Editing an existing platform: keep its identity; only adopt the preset's modules.
      setDetails(d => (isNew
        ? { ...d, ...preset.platform, enabled_modules: preset.platform.enabled_modules || d.enabled_modules }
        : { ...d, enabled_modules: preset.platform.enabled_modules || d.enabled_modules }));
    }
    setDirty(true);
  };

  const updateDetails = (patch) => { setDetails(d => ({ ...d, ...patch })); setDirty(true); };
  const updateIntegration = (updater) => { setIntegration(cfg => (typeof updater === 'function' ? updater(cfg) : updater)); setDirty(true); };

  const handleSaveError = (err) => {
    const e = describeError(err);
    const list = e.details?.errors || [];
    setFieldErrors(errorsToMap(list));
    toast.error(list.length ? `${e.message} ${list.length} field(s) need attention.` : e.message);
    return false;
  };

  const saveDetails = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const body = { ...details, country: details.country || null, currency: details.currency || null };
      if (isNew) {
        const res = await api.post('/platform-management', { ...body, integration });
        toast.success(`${res.data.data.name} created as a draft.`);
        setDirty(false);
        navigate(`/platforms/${res.data.data.id}?step=api`, { replace: true });
        return true;
      }
      const { code, ...rest } = body;
      const res = await api.put(`/platform-management/${id}`, rest);
      setPlatform(res.data.data);
      toast.success('Platform details saved.');
      setDirty(false);
      return true;
    } catch (err) {
      return handleSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const saveIntegration = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const res = await api.put(`/platform-management/${id}/integration`, { integration, secrets, clear_secrets: clearSecrets });
      setPlatform(res.data.data);
      setIntegration(res.data.data.integration);
      setSecrets({});
      setClearSecrets([]);
      setDirty(false);
      toast.success('API configuration saved as draft.');
      return true;
    } catch (err) {
      return handleSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const saveCurrent = () => (step === 'details' ? saveDetails() : saveIntegration());
  const saveAndContinue = async () => {
    const ok = step === 'inspect' && !dirty ? true : await saveCurrent();
    if (ok && stepIndex < STEPS.length - 1 && !(isNew && step === 'details')) goTo(STEPS[stepIndex + 1].id);
  };

  const onPlatformUpdated = async (p) => {
    setPlatform(p);
    if (p.status === 'ACTIVE') await refreshPlatforms().catch(() => {});
  };

  const stepProps = useMemo(() => ({
    meta, platform, details, integration, secrets, clearSecrets, fieldErrors, isNew, inspection,
    updateDetails, updateIntegration, setSecrets: (s) => { setSecrets(s); setDirty(true); }, setClearSecrets: (c) => { setClearSecrets(c); setDirty(true); },
    setInspection, onPlatformUpdated, goTo, reloadMeta: load
  }), [meta, platform, details, integration, secrets, clearSecrets, fieldErrors, isNew, inspection, goTo, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <div className="card"><ErrorPanel error={loadError} onRetry={load} /></div>;
  if (!meta || !integration) return <KpiSkeletonGrid count={3} />;

  const errorCount = Object.keys(fieldErrors).length;

  return (
    <div className="stack-lg wizard">
      <PageHeader
        eyebrow={isNew ? 'Platforms · Add platform' : <><PlatformAvatar platform={platform} size={18} /> {platform?.code}</>}
        title={isNew ? 'Add a platform' : platform?.name}
        description={isNew ? 'Register a platform, connect its reporting API, map the response and validate it before activation.' : 'Edit the draft configuration. Reports keep using the published configuration until you validate and activate again.'}
        actions={!isNew && platform && (
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <StatusBadge status={platform.status} />
            {platform.has_unpublished_changes && platform.published && <span className="badge badge--warning">Unpublished changes</span>}
            <button type="button" className="btn btn--danger-soft btn--sm" onClick={() => setConfirmDelete(true)} title="Delete platform">
              <Trash2 size={14} /> Delete platform
            </button>
          </div>
        )}
      />

      <ol className="stepper" aria-label="Configuration steps">
        {STEPS.map((s, i) => {
          const locked = isNew && i > 0;
          return (
            <li key={s.id} className={`stepper__item ${s.id === step ? 'is-current' : ''} ${i < stepIndex ? 'is-done' : ''}`}>
              <button type="button" onClick={() => !locked && goTo(s.id)} disabled={locked} aria-current={s.id === step ? 'step' : undefined}>
                <span className="stepper__num">{i < stepIndex ? <Check size={13} /> : i + 1}</span>
                <span className="stepper__label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {errorCount > 0 && (
        <Alert tone="danger" title={`${errorCount} field(s) need attention`}>
          <ul>{Object.entries(fieldErrors).slice(0, 8).map(([f, m]) => <li key={f}><code>{f}</code>: {m}</li>)}</ul>
        </Alert>
      )}
      {!meta.vaultConfigured && step === 'api' && (
        <Alert tone="warning" title="Credential encryption key missing" icon={AlertTriangle}>
          The server has no <code>INTEGRATION_SECRET_KEY</code>, so API credentials cannot be saved. Set it in the server environment and restart.
        </Alert>
      )}

      <div className="wizard__body fade-in" key={step}>
        {step === 'details' && <StepDetails {...stepProps} presetId={presetId} applyPreset={applyPreset} showPresets={isNew || !platform?.integration} />}
        {step === 'api' && <StepApi {...stepProps} />}
        {step === 'params' && <StepParams {...stepProps} />}
        {step === 'inspect' && <StepInspect {...stepProps} />}
        {step === 'mapping' && <StepMapping {...stepProps} />}
        {step === 'validate' && <StepValidate {...stepProps} dirty={dirty} saveIntegration={saveIntegration} />}
      </div>

      <div className="wizard__footer">
        <button type="button" className="btn btn--secondary" onClick={() => (stepIndex === 0 ? navigate('/platforms') : goTo(STEPS[stepIndex - 1].id))}>
          <ChevronLeft size={16} /> {stepIndex === 0 ? 'Back to platforms' : 'Previous'}
        </button>
        <div className="row">
          {dirty && <span className="text-muted" role="status">Unsaved changes</span>}
          {step !== 'validate' && (
            <>
              {!isNew && step !== 'inspect' && (
                <button type="button" className="btn btn--secondary" onClick={saveCurrent} disabled={saving || !dirty}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save draft
                </button>
              )}
              <button type="button" className="btn btn--primary" onClick={saveAndContinue} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : null}
                {isNew ? 'Create platform & continue' : 'Save & continue'} <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete platform"
        message={`Are you sure you want to permanently delete platform "${platform?.name}" (${platform?.code})? All its API integration settings, credentials, and access permissions will be removed. This cannot be undone.`}
        confirmLabel="Delete platform"
        tone="danger"
        busy={deleting}
        onConfirm={handleDeletePlatform}
        onClose={() => !deleting && setConfirmDelete(false)}
      />
    </div>
  );
};

export default PlatformWizardPage;
