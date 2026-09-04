import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calculator, 
  ArrowRight, 
  BookOpen, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { ReconciliationItem } from '../types';
import { apiService } from '../api/client';
import { JournalEntryModal } from '../components/ui/JournalEntryModal';
import { SelfHealingRulesCard } from '../components/ui/SelfHealingRulesCard';
import { TaxReconciliationModal } from '../components/ui/TaxReconciliationModal';

interface ReconciliationProps {
  batchId?: string;
  onSelectException: (exceptionId: string) => void;
}

export const Reconciliation: React.FC<ReconciliationProps> = ({ batchId, onSelectException }) => {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);

  const fetchItems = () => {
    if (!batchId) return;
    setLoading(true);
    apiService
      .getBatchItems(batchId, statusFilter === 'ALL' ? undefined : statusFilter, search || undefined, 100, 0)
      .then((res) => {
        setItems(res);
        if (res.length > 0 && !selectedItem) {
          setSelectedItem(res[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [batchId, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const matchedCount = items.filter((i) => i.difference === 0).length;
  const exceptionCount = items.filter((i) => i.difference !== 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Filter & Actions Bar */}
      <div className="glass-card" style={{ padding: '16px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Status Filter Segmented Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#F1F5F9', padding: '3px', borderRadius: '10px', gap: '4px' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: statusFilter === 'ALL' ? '#FFFFFF' : 'transparent',
                color: statusFilter === 'ALL' ? '#0F172A' : '#64748B',
                boxShadow: statusFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              All Records ({items.length})
            </button>

            <button
              onClick={() => setStatusFilter('MATCHED')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: statusFilter === 'MATCHED' ? '#FFFFFF' : 'transparent',
                color: statusFilter === 'MATCHED' ? '#059669' : '#64748B',
                boxShadow: statusFilter === 'MATCHED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Matched ({matchedCount})
            </button>

            <button
              onClick={() => setStatusFilter('EXCEPTION')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: statusFilter === 'EXCEPTION' ? '#FFFFFF' : 'transparent',
                color: statusFilter === 'EXCEPTION' ? '#DC2626' : '#64748B',
                boxShadow: statusFilter === 'EXCEPTION' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Exceptions ({exceptionCount})
            </button>
          </div>

          {/* Right Action Buttons & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsJournalModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#2563EB',
                borderColor: '#BFDBFE',
                background: '#EFF6FF',
              }}
              title="View balanced double-entry accounting records & export to ERP (SAP / NetSuite / Tally)"
            >
              <BookOpen size={15} color="#2563EB" />
              <span>Export ERP Journal (GL)</span>
            </button>

            <button
              onClick={() => setIsTaxModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#7C3AED',
                borderColor: '#DDD6FE',
                background: '#F5F3FF',
              }}
              title="Reconcile Razorpay SAC 997159 18% GST invoices against Input Tax Credit (ITC)"
            >
              <Receipt size={15} color="#7C3AED" />
              <span>GSTR-2B Tax Audit</span>
            </button>

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', minWidth: '260px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="Search transaction or reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ padding: '0 14px', height: '38px', fontSize: '12.5px' }}>
                Search
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Self-Healing Dynamic Matching Rules Card */}
      <SelfHealingRulesCard batchId={batchId} onRuleApplied={fetchItems} />

      {/* Main Content Grid: Ledger Table + Financial Equation Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 380px' : '1fr', gap: '20px', alignItems: 'start' }}>
        {/* Table Container - Fully Scrollable */}
        <div
          className="table-container"
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 220px)',
            minHeight: '480px',
            position: 'relative',
          }}
        >
          <table className="finctrl-table" style={{ minWidth: '850px' }}>
            <thead>
              <tr>
                <th>Transaction Reference</th>
                <th>Merchant</th>
                <th style={{ textAlign: 'right' }}>Payment Captured</th>
                <th style={{ textAlign: 'right' }}>Accounted Total</th>
                <th style={{ textAlign: 'right' }}>Discrepancy (₹)</th>
                <th>Match Strategy & Confidence</th>
                <th>Reconciliation Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    <div className="pulse-glow" style={{ fontWeight: 600 }}>Loading reconciliation ledger...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    No transactions matched the current filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isBalanced = item.difference === 0;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        background: isSelected ? '#F0F7FF' : undefined,
                        borderLeft: isSelected ? '3px solid #2563EB' : '3px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#1D4ED8', fontSize: '13px' }}>
                          {item.transaction_id}
                        </div>
                        {item.payment_reference && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>{item.payment_reference}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.merchant_name}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{item.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{item.accounted_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: isBalanced ? '#059669' : '#DC2626' }}>
                        {isBalanced ? '₹0.00' : `₹${item.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {item.match_level?.replace(/LEVEL_\d+(?:_\d+)?_/, '') || 'STANDARD'}
                          </span>
                          <span style={{ color: item.match_confidence >= 0.9 ? '#059669' : '#D97706' }}>
                            {(item.match_confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ marginTop: '4px', width: '100%', height: '4px', borderRadius: '2px', background: '#F1F5F9', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${(item.match_confidence * 100).toFixed(0)}%`,
                              height: '100%',
                              borderRadius: '2px',
                              background:
                                item.match_confidence >= 0.95
                                  ? '#10B981'
                                  : item.match_confidence >= 0.85
                                  ? '#F59E0B'
                                  : '#EF4444',
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === 'MATCHED'
                              ? 'badge-matched'
                              : item.status === 'MATCHED_WITH_ADJUSTMENT'
                              ? 'badge-ai'
                              : 'badge-critical'
                          }`}
                          style={{ fontSize: '10.5px' }}
                        >
                          {item.status === 'MATCHED' && <CheckCircle2 size={11} style={{ marginRight: '2px' }} />}
                          {item.status !== 'MATCHED' && <AlertTriangle size={11} style={{ marginRight: '2px' }} />}
                          <span>{item.status.replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Inspector: Double-Entry Financial Equation */}
        {selectedItem && (
          <div
            className="glass-card"
            style={{
              position: 'sticky',
              top: '90px',
              padding: '22px',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator size={18} color="#2563EB" />
                </div>
                <div>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>Financial Equation</h4>
                  <span className="font-mono" style={{ fontSize: '11px', color: '#64748B' }}>{selectedItem.transaction_id}</span>
                </div>
              </div>
              <span className={`badge ${selectedItem.difference === 0 ? 'badge-matched' : 'badge-critical'}`} style={{ fontSize: '11px' }}>
                {selectedItem.difference === 0 ? 'Balanced' : 'Discrepancy'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              {/* Payment Gross Captured */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Gross Captured (Credit):</span>
                <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '14.5px' }}>
                  ₹{selectedItem.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Accounted Debits */}
              <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Accounted Deductions & Settlements:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Net Bank Payout:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    ₹{selectedItem.settlement_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Refunds / Chargebacks:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    ₹{selectedItem.refund_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>MDR Processing Fee + GST:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    ₹{selectedItem.fee_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Total Accounted */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <span style={{ color: '#1E40AF', fontWeight: 700 }}>Total Debits Accounted:</span>
                <span style={{ fontWeight: 800, color: '#1D4ED8', fontSize: '14.5px' }}>
                  ₹{selectedItem.accounted_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Discrepancy Equation */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: selectedItem.difference === 0 ? '#ECFDF5' : '#FEF2F2',
                  borderRadius: '8px',
                  border: selectedItem.difference === 0 ? '1px solid #A7F3D0' : '1px solid #FECACA',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedItem.difference === 0 ? <CheckCircle2 size={16} color="#059669" /> : <AlertTriangle size={16} color="#DC2626" />}
                  <span style={{ fontWeight: 700, color: selectedItem.difference === 0 ? '#059669' : '#DC2626' }}>
                    Variance (Δ):
                  </span>
                </div>
                <span style={{ fontWeight: 800, fontSize: '16px', color: selectedItem.difference === 0 ? '#059669' : '#DC2626' }}>
                  ₹{selectedItem.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {selectedItem.has_exception && selectedItem.exception_id && (
                <button
                  onClick={() => onSelectException(selectedItem.exception_id!)}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '6px', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span>Open AI Root Cause Investigation</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Journal Entry Modal */}
      <JournalEntryModal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        batchId={batchId}
      />

      {/* GSTR-2B Tax Reconciliation Modal */}
      <TaxReconciliationModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        batchId={batchId}
      />
    </div>
  );
};
