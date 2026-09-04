import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, FileCode, CheckCircle2, AlertCircle, BookOpen, Download } from 'lucide-react';
import { apiService } from '../../api/client';

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId?: string;
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({
  isOpen,
  onClose,
  batchId,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  useEffect(() => {
    if (isOpen && batchId) {
      setLoading(true);
      apiService
        .getBatchJournalEntries(batchId)
        .then((res) => setData(res))
        .catch((err) => console.error('Failed to load journal entries', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  const handleDownloadCsv = async () => {
    if (!batchId) return;
    setExportingCsv(true);
    try {
      await apiService.downloadGlExport(batchId, 'csv');
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDownloadJson = async () => {
    if (!batchId) return;
    setExportingJson(true);
    try {
      await apiService.downloadGlExport(batchId, 'json');
    } catch (err) {
      console.error('Failed to export JSON', err);
    } finally {
      setExportingJson(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content glass-card animate-scale-in"
        style={{ maxWidth: '840px', width: '94%', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={22} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Automated Double-Entry Accounting
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                General Ledger (GL) Journal Voucher
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#64748B" />
          </button>
        </div>

        {loading || !data ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div className="pulse-glow" style={{ fontWeight: 600 }}>Balancing debits and credits across ledgers...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Voucher Metadata & Balance Verification Banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '14px 20px',
                background: data.is_balanced ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${data.is_balanced ? '#BBF7D0' : '#FECACA'}`,
                borderRadius: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Voucher Ref: <span className="font-mono" style={{ fontWeight: 700, color: '#0F172A' }}>{data.journal_id}</span> | Posting Date: <span style={{ fontWeight: 600 }}>{data.posting_date}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Reconciled Records: <span style={{ fontWeight: 700 }}>{data.records_count}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {data.is_balanced ? (
                  <span className="badge badge-matched" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px' }}>
                    <CheckCircle2 size={15} />
                    <span>BALANCED (Debits = Credits)</span>
                  </span>
                ) : (
                  <span className="badge badge-critical" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px' }}>
                    <AlertCircle size={15} />
                    <span>VARIANCE: ₹{data.variance}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Debit / Credit Table */}
            <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table className="finctrl-table">
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>GL Code</th>
                    <th>Account Title</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                    <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                    <th>Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td className="font-mono" style={{ fontWeight: 700, color: '#2563EB' }}>
                        {line.account_code}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {line.account_name}
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                          {line.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: line.debit > 0 ? 700 : 400, color: line.debit > 0 ? '#0F172A' : '#94A3B8' }}>
                        {line.debit > 0 ? `₹${line.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: line.credit > 0 ? 700 : 400, color: line.credit > 0 ? '#0F172A' : '#94A3B8' }}>
                        {line.credit > 0 ? `₹${line.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {line.narration}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr style={{ background: '#F8FAFC', fontWeight: 800, borderTop: '2px solid var(--border-strong)' }}>
                    <td colSpan={3} style={{ textAlign: 'right', color: '#0F172A' }}>
                      TOTALS:
                    </td>
                    <td style={{ textAlign: 'right', color: '#059669', fontSize: '14px' }}>
                      ₹{data.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: '#059669', fontSize: '14px' }}>
                      ₹{data.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: '#059669', fontSize: '11.5px' }}>
                      ✓ Balanced & Verified
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Export Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Directly importable into <b>NetSuite</b>, <b>SAP S/4HANA</b>, <b>TallyPrime</b>, and <b>QuickBooks</b>.
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleDownloadJson}
                  disabled={exportingJson}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px' }}
                >
                  <FileCode size={16} />
                  <span>{exportingJson ? 'Exporting...' : 'Export JSON'}</span>
                </button>

                <button
                  onClick={handleDownloadCsv}
                  disabled={exportingCsv}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px' }}
                >
                  <FileSpreadsheet size={16} />
                  <span>{exportingCsv ? 'Exporting...' : 'Export CSV (ERP Journal)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
