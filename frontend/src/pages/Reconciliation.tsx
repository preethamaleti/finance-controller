import React, { useState, useEffect } from 'react';
import { Search, Calculator, ArrowRight } from 'lucide-react';
import { ReconciliationItem } from '../types';
import { apiService } from '../api/client';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filters & Search Header */}
      <div className="glass-card" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'MATCHED', 'EXCEPTION'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: statusFilter === st ? '1px solid #2563EB' : '1px solid var(--border-strong)',
                  background: statusFilter === st ? '#EFF6FF' : '#FFFFFF',
                  color: statusFilter === st ? '#1D4ED8' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {st === 'ALL' ? 'All Records' : st === 'MATCHED' ? 'Matched / Balanced' : 'Exceptions'}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', minWidth: '320px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input
                type="text"
                placeholder="Search transaction ID or reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '36px' }}
              />
            </div>
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Main Grid: Table (Left) + Financial Equation Inspector (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 380px' : '1fr', gap: '20px', alignItems: 'start' }}>
        {/* Table Container */}
        <div className="table-container">
          <table className="finctrl-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Merchant</th>
                <th>Payment (₹)</th>
                <th>Accounted (₹)</th>
                <th>Difference (₹)</th>
                <th>Match Strategy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <div className="pulse-glow">Loading reconciliation ledger...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No transactions matching current filter.
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
                        background: isSelected ? '#EFF6FF' : undefined,
                        borderLeft: isSelected ? '3px solid #2563EB' : undefined,
                      }}
                    >
                      <td>
                        <div className="font-mono" style={{ fontWeight: 600, color: '#1D4ED8' }}>
                          {item.transaction_id}
                        </div>
                        {item.payment_reference && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.payment_reference}</div>
                        )}
                      </td>
                      <td>{item.merchant_name}</td>
                      <td style={{ fontWeight: 600 }}>₹{item.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 600 }}>₹{item.accounted_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 700, color: isBalanced ? '#059669' : '#DC2626' }}>
                        {isBalanced ? '₹0.00' : `₹${item.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {item.match_level?.replace(/LEVEL_\d+_/, '') || 'N/A'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {(item.match_confidence * 100).toFixed(0)}% confidence
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
                        >
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Inspector: Financial Equation */}
        {selectedItem && (
          <div className="glass-card" style={{ position: 'sticky', top: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} color="#2563EB" />
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Financial Equation</h4>
              </div>
              <span className={`badge ${selectedItem.difference === 0 ? 'badge-matched' : 'badge-critical'}`}>
                {selectedItem.difference === 0 ? 'Balanced' : 'Unbalanced'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Captured:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>₹{selectedItem.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Accounted Deductions & Settlements:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>+ Net Settlement:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{selectedItem.settlement_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>+ Refund Amount:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{selectedItem.refund_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>+ Fees & GST:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{selectedItem.fee_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: '#EFF6FF', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                <span style={{ color: '#1E40AF', fontWeight: 600 }}>Total Accounted:</span>
                <span style={{ fontWeight: 800, color: '#1D4ED8' }}>₹{selectedItem.accounted_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: selectedItem.difference === 0 ? '#ECFDF5' : '#FEF2F2', borderRadius: '6px', border: selectedItem.difference === 0 ? '1px solid #A7F3D0' : '1px solid #FECACA' }}>
                <span style={{ fontWeight: 700, color: selectedItem.difference === 0 ? '#059669' : '#DC2626' }}>Discrepancy:</span>
                <span style={{ fontWeight: 800, fontSize: '15px', color: selectedItem.difference === 0 ? '#059669' : '#DC2626' }}>
                  ₹{selectedItem.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {selectedItem.has_exception && selectedItem.exception_id && (
                <button
                  onClick={() => onSelectException(selectedItem.exception_id!)}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '10px' }}
                >
                  <span>Open AI Investigation</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
