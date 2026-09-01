import React, { useState } from 'react';
import { AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { ExceptionItem } from '../types';
import { apiService } from '../api/client';

interface ExceptionCenterProps {
  exceptions: ExceptionItem[];
  onSelectException: (id: string) => void;
  onRefresh: () => void;
}

export const ExceptionCenter: React.FC<ExceptionCenterProps> = ({
  exceptions,
  onSelectException,
  onRefresh,
}) => {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [investigatingAll, setInvestigatingAll] = useState(false);

  const filteredExceptions = exceptions.filter((e) => {
    if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (search && !e.transaction_id.toLowerCase().includes(search.toLowerCase()) && !e.merchant_name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleInvestigateAll = async () => {
    setInvestigatingAll(true);
    try {
      const openExceptions = exceptions.filter((e) => !e.has_investigation || e.status === 'OPEN');
      for (const exc of openExceptions.slice(0, 20)) {
        await apiService.investigateException(exc.id);
      }
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setInvestigatingAll(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Batch Actions */}
      <div className="glass-card" style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#D97706" />
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A' }}>Financial Exception Center</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Prioritized discrepancies categorized by financial exposure, risk score, and human-in-the-loop thresholds.
            </p>
          </div>

          <button
            onClick={handleInvestigateAll}
            disabled={investigatingAll}
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)' }}
          >
            <Sparkles size={16} />
            <span>{investigatingAll ? 'Running Multi-Tool Agents...' : 'Auto-Investigate Open Exceptions'}</span>
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: severityFilter === sev ? '1px solid #2563EB' : '1px solid var(--border-strong)',
                  background: severityFilter === sev ? '#EFF6FF' : '#FFFFFF',
                  color: severityFilter === sev ? '#1D4ED8' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {sev}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Filter by txn or merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ width: '260px', padding: '6px 12px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Exception Cards Table */}
      <div className="table-container">
        <table className="finctrl-table">
          <thead>
            <tr>
              <th>Priority Score</th>
              <th>Transaction</th>
              <th>Merchant</th>
              <th>Exception Type</th>
              <th>Exposure (₹)</th>
              <th>Human Review Threshold</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredExceptions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No exceptions matching filter.
                </td>
              </tr>
            ) : (
              filteredExceptions.map((exc) => (
                <tr key={exc.id} onClick={() => onSelectException(exc.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: exc.severity === 'CRITICAL' ? '#DC2626' : '#D97706' }}>
                        {exc.priority_score.toFixed(0)}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontWeight: 600, color: '#1D4ED8' }}>
                    {exc.transaction_id}
                  </td>
                  <td>{exc.merchant_name}</td>
                  <td>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                      {exc.exception_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: '#DC2626' }}>
                    ₹{exc.financial_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    {exc.financial_exposure > 100000 ? (
                      <span className="badge badge-critical">Mandatory Human Review (&gt; ₹1L)</span>
                    ) : exc.financial_exposure > 10000 ? (
                      <span className="badge badge-warning">Approval Recommended (&gt; ₹10k)</span>
                    ) : (
                      <span className="badge badge-matched">Auto-Resolve Eligible (&lt; ₹10k)</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        exc.status === 'RESOLVED'
                          ? 'badge-matched'
                          : exc.status === 'UNRESOLVED'
                          ? 'badge-critical'
                          : 'badge-neutral'
                      }`}
                    >
                      {exc.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectException(exc.id);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                    >
                      <span>Investigate</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
