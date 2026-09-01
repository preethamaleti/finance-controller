import React, { useEffect, useState } from 'react';
import { X, HelpCircle, Calculator, Database } from 'lucide-react';
import { apiService } from '../../api/client';

interface ExplainMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricName: string;
  batchId?: string;
}

export const ExplainMetricModal: React.FC<ExplainMetricModalProps> = ({
  isOpen,
  onClose,
  metricName,
  batchId,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && metricName) {
      setLoading(true);
      apiService
        .explainMetric(metricName, batchId)
        .then((res) => setData(res))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, metricName, batchId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HelpCircle size={22} color="#2563EB" />
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>EXPLAIN THIS NUMBER</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="pulse-glow" style={{ fontSize: '14px', fontWeight: 600 }}>Tracing ledger calculations...</div>
          </div>
        ) : data ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Value Card */}
            <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                {data.metric_name}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                {data.value}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {data.description}
              </div>
            </div>

            {/* Formula */}
            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Calculator size={16} color="#7C3AED" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>
                  Mathematical Definition
                </span>
              </div>
              <div className="font-mono" style={{ fontSize: '12.5px', color: '#0F172A', padding: '10px 12px', background: '#FFFFFF', border: '1px solid var(--border-strong)', borderRadius: '6px' }}>
                {data.formula}
              </div>
            </div>

            {/* Contributing Records / Factors */}
            {data.contributing_factors && data.contributing_factors.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Database size={16} color="#059669" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                    Source Ledger Factors ({data.source_records_count} records evaluated)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {data.contributing_factors.map((f: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        background: '#F8FAFC',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{f.factor || f.txn}</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        {f.amount ? `₹${f.amount.toLocaleString('en-IN')}` : f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', background: '#F8FAFC', textAlign: 'right' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
