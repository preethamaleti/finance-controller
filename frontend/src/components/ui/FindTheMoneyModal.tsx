import React from 'react';
import { X, DollarSign, ShieldAlert, ArrowRight } from 'lucide-react';
import { FindTheMoneyResponse } from '../../types';

interface FindTheMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: FindTheMoneyResponse;
  onDrillDown?: (category: string) => void;
}

export const FindTheMoneyModal: React.FC<FindTheMoneyModalProps> = ({
  isOpen,
  onClose,
  data,
  onDrillDown,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={24} color="#059669" />
            </div>
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A' }}>FIND THE MONEY</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Autonomous Financial Exposure Breakdown & Root-Cause Ledger Analysis
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Hero Exposure Value */}
        <div style={{ padding: '24px', background: '#F0FDF4', borderBottom: '1px solid #DCFCE7' }}>
          <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Potential Financial Exposure
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#15803D', marginTop: '2px', letterSpacing: '-0.02em' }}>
            ₹{data.total_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '13px', color: '#166534', marginTop: '4px' }}>
            Money currently at risk across unlinked settlements, fee discrepancies, and unresolved ledger shortages.
          </div>
        </div>

        {/* Category Breakdown */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.categories.map((cat, idx) => (
            <div
              key={idx}
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ flex: 1, marginRight: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#0F172A' }}>{cat.category}</span>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#2563EB' }}>
                    ₹{cat.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {cat.description} ({cat.count} affected records)
                </div>
                {/* Visual Progress Bar */}
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(cat.percentage, 100)}%`,
                      height: '100%',
                      background: idx === 0 ? '#DC2626' : idx === 1 ? '#D97706' : '#2563EB',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {cat.percentage}% of total
                </span>
                {onDrillDown && (
                  <button
                    onClick={() => {
                      onClose();
                      onDrillDown(cat.category);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '12px' }}
                  >
                    <span>Inspect</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={18} color="#D97706" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            All numbers are deterministically computed from actual ledger balances. AI investigation can be triggered on each item.
          </span>
        </div>
      </div>
    </div>
  );
};
