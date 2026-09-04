import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bot,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  XCircle,
  Database,
  Calculator,
  UserCheck,
  FileDown,
} from 'lucide-react';
import { ExceptionDetail } from '../types';
import { apiService } from '../api/client';
import { DisputeNoticeModal } from '../components/ui/DisputeNoticeModal';

interface ExceptionDetailProps {
  exceptionId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export const ExceptionDetailView: React.FC<ExceptionDetailProps> = ({
  exceptionId,
  onBack,
  onRefresh,
}) => {
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [notes, setNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  const fetchDetail = () => {
    setLoading(true);
    apiService
      .getExceptionDetail(exceptionId)
      .then((res) => setDetail(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
  }, [exceptionId]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await apiService.downloadExceptionPdf(exceptionId);
    } catch (err) {
      console.error('PDF download failed', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleRunInvestigation = async () => {
    setInvestigating(true);
    try {
      await apiService.investigateException(exceptionId);
      fetchDetail();
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setInvestigating(false);
    }
  };

  const handleHumanApproval = async (decision: string) => {
    try {
      await apiService.approveException(exceptionId, decision, notes);
      setActionSuccess(`Exception successfully ${decision.toLowerCase()}`);
      fetchDetail();
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !detail) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <div className="pulse-glow" style={{ fontSize: '15px', fontWeight: 600 }}>Loading investigation dossier...</div>
      </div>
    );
  }

  const inv = detail.investigation;
  const isUnresolved = inv?.status === 'UNRESOLVED' || detail.status === 'UNRESOLVED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Button & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 14px' }}>
          <ArrowLeft size={16} />
          <span>Back to Exceptions</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsDisputeModalOpen(true)}
            className="btn btn-secondary"
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#B91C1C',
              borderColor: '#FECACA',
              background: '#FEF2F2',
            }}
            title="Generate formal bank & gateway dispute escalation notice"
          >
            <ShieldAlert size={16} color="#DC2626" />
            <span>Escalate & Dispute</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Download audit-ready PDF evidence report"
          >
            <FileDown size={16} />
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download Evidence PDF'}</span>
          </button>

          <span className={`badge ${detail.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning'}`}>
            Severity: {detail.severity}
          </span>
          <span className={`badge ${detail.status === 'RESOLVED' ? 'badge-matched' : 'badge-neutral'}`}>
            Status: {detail.status}
          </span>
          {detail.dispute_status && (
            <span
              className="badge"
              style={{
                background: detail.dispute_status === 'SETTLED_RECOVERED' ? '#DCFCE7' : detail.dispute_status === 'ESCALATED_TO_GATEWAY' ? '#FEF3C7' : '#E0E7FF',
                color: detail.dispute_status === 'SETTLED_RECOVERED' ? '#166534' : detail.dispute_status === 'ESCALATED_TO_GATEWAY' ? '#92400E' : '#3730A3',
                fontWeight: 700,
              }}
            >
              Dispute: {detail.dispute_status}
            </span>
          )}
        </div>
      </div>


      {actionSuccess && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '12px 16px', borderRadius: '8px', color: '#059669', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Transaction & Discrepancy Banner */}
      <div className="glass-card" style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Exception Dossier #{detail.id}
            </div>
            <h1 className="font-mono" style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {detail.transaction_id}
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Merchant: <strong style={{ color: '#0F172A' }}>{detail.merchant_name}</strong> • Method: <strong style={{ color: '#0F172A' }}>{detail.payment_method}</strong> • Customer: <strong style={{ color: '#0F172A' }}>{detail.customer_id || 'N/A'}</strong>
            </div>
          </div>

          {/* Monetary Summary */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Expected Payment</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                ₹{detail.expected_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Accounted Settlement</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563EB' }}>
                ₹{detail.accounted_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase' }}>Discrepancy (Exposure)</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626' }}>
                ₹{detail.financial_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Timeline */}
      <div className="glass-card">
        <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Multi-Source Transaction Ledger Flow
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '10px 20px', overflowX: 'auto' }}>
          {[
            { label: 'Payment Captured', status: 'COMPLETED', color: '#059669', detail: `₹${detail.expected_amount.toFixed(2)}` },
            { label: 'Gateway Settlement', status: detail.accounted_amount > 0 ? 'COMPLETED' : 'MISSING', color: detail.accounted_amount > 0 ? '#059669' : '#DC2626', detail: `₹${detail.accounted_amount.toFixed(2)}` },
            { label: 'Refund Ledger', status: 'SEARCHED', color: '#2563EB', detail: 'Cross-checked' },
            { label: 'Bank Payout (UTR)', status: 'VERIFIED', color: '#7C3AED', detail: 'Statement line' },
            { label: 'Interchange / Fee', status: 'EVALUATED', color: '#D97706', detail: 'Fee ledger' },
          ].map((step, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: '140px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, fontSize: '13px', marginBottom: '8px', boxShadow: 'var(--shadow-sm)' }}>
                {idx + 1}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{step.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{step.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Investigation Section */}
      <div className="glass-card" style={{ borderColor: isUnresolved ? '#FECACA' : '#DDD6FE' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--purple-bg)', border: '1px solid var(--purple-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={22} color="#7C3AED" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>AI Evidence-First Investigation</h3>
                {inv && (
                  <span className="badge badge-ai">{(inv.confidence * 100).toFixed(0)}% Confidence</span>
                )}
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Controlled read-only queries executed across payments, settlements, fees, refunds, and bank statements.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunInvestigation}
            disabled={investigating}
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' }}
          >
            <Sparkles size={16} />
            <span>{investigating ? 'Running AI Tools...' : 'Re-Run AI Investigation'}</span>
          </button>
        </div>

        {inv ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Reasoning Summary */}
            <div
              style={{
                padding: '18px 22px',
                borderRadius: '10px',
                background: isUnresolved ? '#FEF2F2' : '#F0FDF4',
                border: isUnresolved ? '1px solid #FECACA' : '1px solid #BBF7D0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {isUnresolved ? <ShieldAlert size={18} color="#DC2626" /> : <ShieldCheck size={18} color="#059669" />}
                <span style={{ fontWeight: 800, fontSize: '14px', color: isUnresolved ? '#DC2626' : '#15803D' }}>
                  {isUnresolved ? 'HONEST UNCERTAINTY: UNRESOLVED EXCEPTION' : `ROOT CAUSE VERIFIED: ${inv.root_cause}`}
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: '#0F172A', lineHeight: '1.5' }}>
                {inv.reasoning_summary}
              </p>
            </div>

            {/* Evidence & Calculation Steps Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Evidence Records */}
              <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Database size={16} color="#2563EB" />
                  <h4 style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                    Cited Evidence Records ({inv.evidence_records.length})
                  </h4>
                </div>
                {inv.evidence_records.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No ledger records match the discrepancy. System refused to hallucinate.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {inv.evidence_records.map((ev, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="badge badge-ai" style={{ fontSize: '10px', marginRight: '8px' }}>{ev.type}</span>
                          <span className="font-mono" style={{ color: '#1D4ED8', fontWeight: 600 }}>{ev.reference || 'Matched'}</span>
                        </div>
                        {ev.amount !== undefined && (
                          <span style={{ fontWeight: 700, color: '#059669' }}>₹{ev.amount.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verified Calculations */}
              <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Calculator size={16} color="#7C3AED" />
                  <h4 style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                    Arithmetic Ledger Proof
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {inv.calculation_steps.map((step, i) => (
                    <div key={i} style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tools Queried */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Controlled Tools Executed: <span className="font-mono" style={{ color: '#0F172A', fontWeight: 600 }}>{inv.tools_called.join(' → ')}</span> ({inv.duration_sec.toFixed(3)}s runtime)
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            No AI investigation has been performed yet for this exception. Click "Re-Run AI Investigation".
          </div>
        )}
      </div>

      {/* Human Governance */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <UserCheck size={20} color="#2563EB" />
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
            Human-in-the-Loop Governance & Decision
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
              Finance Officer Audit Note
            </label>
            <input
              type="text"
              placeholder="e.g. Verified with merchant operations; journal entry approved."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsDisputeModalOpen(true)} className="btn btn-danger">
              <ShieldAlert size={16} />
              <span>Escalate & Dispute Notice</span>
            </button>
            <button onClick={() => handleHumanApproval('REJECTED')} className="btn btn-secondary">
              <XCircle size={16} />
              <span>Mark Unresolvable</span>
            </button>
            <button onClick={() => handleHumanApproval('APPROVED')} className="btn btn-success">
              <CheckCircle2 size={16} />
              <span>Approve Financial Resolution</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dispute Notice Modal */}
      <DisputeNoticeModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        exceptionId={exceptionId}
        onStatusUpdated={() => {
          fetchDetail();
          onRefresh();
        }}
      />
    </div>
  );
};
