import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileDown, AlertTriangle, ShieldAlert, Mail } from 'lucide-react';
import { apiService } from '../../api/client';

interface DisputeNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  exceptionId: string;
  onStatusUpdated?: () => void;
}

export const DisputeNoticeModal: React.FC<DisputeNoticeModalProps> = ({
  isOpen,
  onClose,
  exceptionId,
  onStatusUpdated,
}) => {
  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [disputeStatus, setDisputeStatus] = useState<string>('DRAFTED');
  const [disputeRef, setDisputeRef] = useState<string>('');
  const [recoveredAmt, setRecoveredAmt] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  useEffect(() => {
    if (isOpen && exceptionId) {
      setLoading(true);
      setStatusSaved(false);
      apiService
        .getDisputePacket(exceptionId)
        .then((data) => {
          setPacket(data);
          if (data) {
            setDisputeStatus(data.dispute_status || 'DRAFTED');
            setDisputeRef(data.dispute_reference || '');
            setRecoveredAmt(data.recovered_amount ? String(data.recovered_amount) : '');
          }
        })
        .catch((err) => console.error('Failed to load dispute packet', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, exceptionId]);

  const handleSaveStatus = async () => {
    if (!exceptionId) return;
    try {
      setSavingStatus(true);
      await apiService.updateDisputeStatus(exceptionId, {
        status: disputeStatus,
        dispute_reference: disputeRef || undefined,
        recovered_amount: recoveredAmt ? parseFloat(recoveredAmt) : undefined,
      });
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 3000);
      if (onStatusUpdated) {
        onStatusUpdated();
      }
    } catch (err) {
      console.error('Failed to update dispute status:', err);
    } finally {
      setSavingStatus(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    if (!packet) return;
    navigator.clipboard.writeText(packet.email_body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await apiService.downloadDisputePdf(exceptionId);
    } catch (err) {
      console.error('Failed to download dispute PDF', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content glass-card animate-scale-in"
        style={{ maxWidth: '780px', width: '92%', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={22} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Bank & Gateway Escalation
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                Notice of Settlement Discrepancy & Dispute
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#64748B" />
          </button>
        </div>

        {loading || !packet ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div className="pulse-glow" style={{ fontWeight: 600 }}>Drafting formal dispute escalation dossier...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Key Particulars Summary Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
                background: '#F8FAFC',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Disputed Rupee Exposure</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>
                  ₹{packet.disputed_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Transaction ID</div>
                <div className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {packet.transaction_id}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Merchant Partner</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {packet.merchant_name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4338CA', marginTop: '4px' }}>
                  {packet.exception_type}
                </div>
              </div>
            </div>

            {/* Email Draft Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  <Mail size={15} color="#2563EB" />
                  <span>Pre-Drafted Nodal Escalation Email</span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  To: <span className="font-mono" style={{ color: '#0F172A' }}>{packet.recipient_email}</span>
                </span>
              </div>

              <div
                style={{
                  background: '#0F172A',
                  color: '#F8FAFC',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  fontFamily: 'monospace',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #334155',
                }}
              >
                {packet.email_body}
              </div>
            </div>

            {/* Regulatory Notice Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#1E40AF',
              }}
            >
              <AlertTriangle size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <b>Regulatory Compliance Framework:</b> Issued under Master Payment Aggregator & Nodal Settlement Directives. 
                Payment aggregators are required to remit merchant funds within T+2 days or provide an auditable deduction schedule.
              </div>
            </div>

            {/* Dispute Lifecycle & Remediation Tracking */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Dispute Remediation & Recovery Lifecycle
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: disputeStatus === 'SETTLED_RECOVERED' ? '#DCFCE7' : disputeStatus === 'ESCALATED_TO_GATEWAY' ? '#FEF3C7' : '#E0E7FF',
                    color: disputeStatus === 'SETTLED_RECOVERED' ? '#166534' : disputeStatus === 'ESCALATED_TO_GATEWAY' ? '#92400E' : '#3730A3',
                  }}
                >
                  STATUS: {disputeStatus}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Gateway Ticket / Reference #
                  </label>
                  <input
                    type="text"
                    value={disputeRef}
                    onChange={(e) => setDisputeRef(e.target.value)}
                    placeholder="e.g. RZP-DISP-98124"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Recovered Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={recoveredAmt}
                    onChange={(e) => setRecoveredAmt(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Update Lifecycle Stage
                  </label>
                  <select
                    value={disputeStatus}
                    onChange={(e) => setDisputeStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFF',
                    }}
                  >
                    <option value="DRAFTED">DRAFTED (Notice Generated)</option>
                    <option value="ESCALATED_TO_GATEWAY">ESCALATED_TO_GATEWAY (Sent)</option>
                    <option value="IN_REVIEW">IN_REVIEW (Gateway Acknowledged)</option>
                    <option value="SETTLED_RECOVERED">SETTLED_RECOVERED (Rupees Credited)</option>
                    <option value="WRITTEN_OFF">WRITTEN_OFF (Accepted Loss)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                {statusSaved && (
                  <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Status Recorded to Ledger
                  </span>
                )}
                <button
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFF',
                    background: '#2563EB',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: savingStatus ? 0.6 : 1,
                  }}
                >
                  {savingStatus ? 'Saving...' : 'Save Remediation Status'}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={handleCopyEmail}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}
              >
                {copied ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Email to Nodal Officer'}</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn btn-primary"
                style={{
                  background: '#991B1B',
                  borderColor: '#7F1D1D',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                }}
              >
                <FileDown size={16} />
                <span>{downloadingPdf ? 'Compiling PDF...' : 'Download Bank Dispute PDF'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
