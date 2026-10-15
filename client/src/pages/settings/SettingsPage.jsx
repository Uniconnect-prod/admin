import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Settings, User, Lock, KeyRound, Globe2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import api, { describeError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { PageHeader, Card, Field, Tabs, StatusBadge } from '../../components/ui/primitives';
import { ErrorPanel, KpiSkeletonGrid } from '../../components/ui/feedback';
import { formatDateTime, formatDay } from '../../services/format';

const ProfileTab = ({ profile, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: profile.name, email: profile.email });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/profile', form);
      toast.success('Profile updated.');
      onSaved();
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Profile" icon={User}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Full name" htmlFor="st-name"><input id="st-name" className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email" htmlFor="st-email"><input id="st-email" type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Username" hint="Usernames are managed by a Super Admin."><input className="input" value={profile.username} disabled /></Field>
          <Field label="Last sign-in"><input className="input" value={formatDateTime(profile.last_login_at)} disabled /></Field>
        </div>
        <div><button type="submit" className="btn btn--primary" disabled={saving}>{saving && <Loader2 size={16} className="spin" />} Save profile</button></div>
      </form>
    </Card>
  );
};

const SecurityTab = ({ minLength }) => {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const mismatch = form.confirm && form.newPassword !== form.confirm;
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/security', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed. Other sessions were signed out.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Change password" icon={Lock}>
      <form className="stack" onSubmit={submit} style={{ maxWidth: 460 }}>
        <Field label="Current password" htmlFor="sc-cur"><input id="sc-cur" type="password" className="input" autoComplete="current-password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} required /></Field>
        <Field label="New password" hint={`At least ${minLength} characters.`} htmlFor="sc-new"><input id="sc-new" type="password" className="input" autoComplete="new-password" minLength={minLength} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} required /></Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match.' : null} htmlFor="sc-conf"><input id="sc-conf" type="password" className="input" autoComplete="new-password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required /></Field>
        <div><button type="submit" className="btn btn--primary" disabled={saving || mismatch || form.newPassword.length < minLength}>{saving && <Loader2 size={16} className="spin" />} Change password</button></div>
      </form>
    </Card>
  );
};

const AccessTab = ({ access }) => (
  <Card title="My platform access" icon={KeyRound} flush subtitle="Access windows are enforced on every request.">
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Platform</th><th>Role</th><th>Window</th><th>Status</th></tr></thead>
        <tbody>
          {access.map((a, i) => (
            <tr key={i}>
              <td className="text-strong">{a.platform}</td>
              <td>{a.role}</td>
              <td className="text-muted">{a.start_date ? `${formatDay(String(a.start_date).slice(0, 10))} → ${formatDay(String(a.end_date).slice(0, 10))}` : 'Unrestricted'}</td>
              <td>{a.status ? <StatusBadge status={a.isExpiringSoon ? 'EXPIRING' : a.status} label={a.isExpiringSoon ? 'Expiring soon' : undefined} /> : <StatusBadge status="ACTIVE" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const SettingsPage = () => {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'profile';
  const { data, error, loading, reload } = useApiQuery('/settings', { platformScoped: false });
  useEffect(() => { if (!['profile', 'security', 'access'].includes(tab)) setParams({ tab: 'profile' }); }, [tab, setParams]);

  return (
    <div className="stack-lg">
      <PageHeader eyebrow={<><Settings size={14} /> Settings</>} title="Settings" description="Your account, security and access." />
      <Tabs tabs={[{ id: 'profile', label: 'Profile', icon: User }, { id: 'security', label: 'Security', icon: Lock }, { id: 'access', label: 'My access', icon: KeyRound }]} active={tab} onChange={t => setParams({ tab: t })} />
      {error ? <div className="card"><ErrorPanel error={error} onRetry={reload} /></div> : loading || !data ? <KpiSkeletonGrid count={2} /> : (
        <>
          {tab === 'profile' && <ProfileTab profile={data.profile} onSaved={reload} />}
          {tab === 'security' && <SecurityTab minLength={data.passwordPolicy.minLength} />}
          {tab === 'access' && <AccessTab access={data.access} />}
        </>
      )}
      {(can('countries:manage') || can('allowlist:manage')) && (
        <div className="grid-2">
          {can('countries:manage') && (
            <Link to="/settings/countries" className="card card--interactive" style={{ color: 'inherit' }}>
              <div className="card__body row-between"><div className="row"><Globe2 size={20} color="#0170B9" /><div><div className="text-strong">Countries</div><div className="text-muted" style={{ fontSize: 12.5 }}>Operating markets, currencies and default timezones</div></div></div><ArrowRight size={16} /></div>
            </Link>
          )}
          {can('allowlist:manage') && (
            <Link to="/settings/approved-hosts" className="card card--interactive" style={{ color: 'inherit' }}>
              <div className="card__body row-between"><div className="row"><ShieldCheck size={20} color="#0170B9" /><div><div className="text-strong">Approved API hosts</div><div className="text-muted" style={{ fontSize: 12.5 }}>Outbound destinations allowed for platform APIs</div></div></div><ArrowRight size={16} /></div>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
