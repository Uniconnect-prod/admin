import React, { useState, useEffect } from 'react';
import { Eye, Clock, DollarSign, History, AlertCircle, Calendar, Hash, Tag, Activity, CheckCircle, XCircle } from 'lucide-react';
import { Drawer } from '../../components/common/Drawer';
import { StatusBadge } from '../../components/common/StatusBadge';
import api from '../../services/api';
import './SubscriberDetailsDrawer.scss';

export const SubscriberDetailsDrawer = ({ subscriberId, isOpen, onClose, defaultTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (!subscriberId || !isOpen) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/subscribers/${subscriberId}`);
        if (res.data?.success) {
          setDetails(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load subscriber detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [subscriberId, isOpen]);

  const subscriber = details?.subscriber || (details?.msisdn ? details : null);
  const renewals = details?.renewals || details?.recent_renewals || [];
  const churns = details?.churns || details?.recent_churns || [];
  const transactions = details?.transactions || details?.recent_transactions || [];
  const activity = details?.activity || [];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={subscriber ? `MSISDN: +${String(subscriber.msisdn || '').replace(/^\++/, '')}` : 'Subscriber Profile'}
      subtitle={subscriber?.platform_name ? `Platform: ${subscriber.platform_name}` : 'Subscriber Deep-Dive'}
      width="640px"
    >
      {loading ? (
        <div className="drawer-loading">
          <div className="skeleton-bar" style={{ width: '80%', height: '24px' }} />
          <div className="skeleton-bar" style={{ width: '60%', height: '20px', marginTop: '12px' }} />
          <div className="skeleton-bar" style={{ width: '100%', height: '180px', marginTop: '20px' }} />
        </div>
      ) : !subscriber ? (
        <div className="drawer-not-found">Subscriber details could not be found.</div>
      ) : (
        <div className="subscriber-drawer-content">
          {/* Quick Header Summary */}
          <div className="subscriber-quick-summary">
            <div className="quick-item">
              <span className="q-label">Current Status</span>
              <StatusBadge status={subscriber.status} />
            </div>
            <div className="quick-item">
              <span className="q-label">Lifecycle</span>
              <span className="lifecycle-badge">{subscriber.lifecycle}</span>
            </div>
            <div className="quick-item">
              <span className="q-label">Plan Price</span>
              <span className="charging-val">GHC {Number(subscriber.charging_amount).toFixed(2)}</span>
            </div>
            <div className="quick-item">
              <span className="q-label">Renewals</span>
              <span className="renewal-count-tag">{subscriber.renewal_count || 0} cycles</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="drawer-tabs">
            <button
              type="button"
              className={`drawer-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`drawer-tab ${activeTab === 'renewals' ? 'active' : ''}`}
              onClick={() => setActiveTab('renewals')}
            >
              Renewal History ({renewals.length})
            </button>
            <button
              type="button"
              className={`drawer-tab ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              Transaction History ({transactions.length})
            </button>
            <button
              type="button"
              className={`drawer-tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              Activity & Audit
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-pane overview-pane">
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-row">
                    <span className="info-key">MSISDN</span>
                    <span className="info-value font-mono">+{String(subscriber.msisdn || '').replace(/^\++/, '')}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Offer Code</span>
                    <span className="info-value font-mono">{subscriber.offer_code}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Billing Reason</span>
                    <span className="info-value">{subscriber.reason}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Platform</span>
                    <span className="info-value">{subscriber.platform_name}</span>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-row">
                    <span className="info-key">Next Billing Date</span>
                    <span className="info-value">
                      {subscriber.next_billing_date ? new Date(subscriber.next_billing_date).toLocaleDateString() : 'None Scheduled'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Joined Date</span>
                    <span className="info-value">{new Date(subscriber.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Total Successful Renewals</span>
                    <span className="info-value">{subscriber.renewal_count}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">Lifetime Billed</span>
                    <span className="info-value font-bold text-success">
                      GHC {((subscriber.renewal_count || 1) * subscriber.charging_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Churn History Section */}
              {churns.length > 0 && (
                <div className="churn-section">
                  <h4 className="section-title text-danger">
                    <AlertCircle size={15} />
                    Churn Event Record
                  </h4>
                  <div className="churn-records-list">
                    {churns.map((c, i) => (
                      <div key={i} className="churn-record-card">
                        <div className="churn-header">
                          <span className="churn-reason">{c.reason}</span>
                          <span className="churn-date">{new Date(c.churned_at).toLocaleDateString()}</span>
                        </div>
                        <span className="churn-offer">Terminated from offer: {c.offer_code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RENEWAL HISTORY */}
          {activeTab === 'renewals' && (
            <div className="tab-pane renewals-pane">
              {renewals.length === 0 ? (
                <div className="empty-sub-tab">No renewal records logged yet.</div>
              ) : (
                <div className="renewals-timeline">
                  {renewals.map((r, i) => (
                    <div key={i} className="renewal-event">
                      <div className="event-icon">
                        {r.status === 'Successful' ? (
                          <CheckCircle size={16} className="text-success" />
                        ) : (
                          <XCircle size={16} className="text-danger" />
                        )}
                      </div>
                      <div className="event-content">
                        <div className="event-top">
                          <StatusBadge status={r.status} />
                          <span className="event-amount">GHC {Number(r.amount).toFixed(2)}</span>
                          <span className="event-time">
                            {new Date(r.renewed_at).toLocaleDateString()} {new Date(r.renewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="event-desc">
                          Auto-renewal for <strong>{r.offer_code}</strong>
                          {r.failure_reason && <span className="fail-note"> — Reason: {r.failure_reason}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="tab-pane transactions-pane">
              <div className="txn-list">
                {transactions.map((tx) => (
                  <div key={tx.id} className="txn-item">
                    <div className="txn-icon-col">
                      <DollarSign size={18} />
                    </div>
                    <div className="txn-details-col">
                      <span className="txn-id">{tx.id}</span>
                      <span className="txn-desc">{tx.description}</span>
                      <span className="txn-time">{new Date(tx.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="txn-amount-col">
                      <span className={`txn-val ${tx.status === 'SUCCESS' ? 'text-success' : 'text-danger'}`}>
                        {tx.status === 'SUCCESS' ? '+' : ''}GHC {Number(tx.amount).toFixed(2)}
                      </span>
                      <span className="txn-status-tag">{tx.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY & AUDIT */}
          {activeTab === 'activity' && (
            <div className="tab-pane activity-pane">
              <div className="activity-feed-list">
                {activity.map((act) => (
                  <div key={act.id} className="act-item">
                    <div className="act-dot" />
                    <div className="act-info">
                      <span className="act-event">{act.event}</span>
                      <p className="act-details">{act.details}</p>
                      <span className="act-time">{new Date(act.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

