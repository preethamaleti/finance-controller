import React, { useState, useEffect } from 'react';
import {
  Store,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Clock,
  Search,
  ArrowUpDown,
  ArrowRight,
  BarChart3,
  Percent,
  RefreshCw,
} from 'lucide-react';
import { apiService } from '../api/client';
import { MerchantScorecard, MerchantsScorecardResponse } from '../types';

interface MerchantsScorecardProps {
  batchId?: string;
  onNavigateToExceptions?: (merchantName?: string) => void;
}

export const MerchantsScorecard: React.FC<MerchantsScorecardProps> = ({
  batchId,
  onNavigateToExceptions,
}) => {
  const [data, setData] = useState<MerchantsScorecardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ragFilter, setRagFilter] = useState<'ALL' | 'RED' | 'AMBER' | 'GREEN'>('ALL');
  const [sortBy, setSortBy] = useState<'exposure' | 'rate' | 'volume' | 'sla'>('exposure');

  const loadScorecard = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getMerchantsScorecard(batchId);
      setData(res);
    } catch (err) {
      console.error('Failed to load merchant scorecard', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScorecard();
  }, [batchId]);

  if (isLoading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="pulse-glow" style={{ fontSize: '15px', fontWeight: 600 }}>
          Analyzing Merchant Health Scorecards & SLA Performance...
        </div>
      </div>
    );
  }

  const scorecards = data?.scorecards || [];
  const summary = data?.summary || {
    total_merchants: 0,
    high_risk_merchants_count: 0,
    avg_exception_rate: 0,
    total_merchant_exposure: 0,
  };

  // Filtering
  const filteredScorecards = scorecards.filter((m) => {
    const matchesSearch =
      m.merchant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.merchant_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRag = ragFilter === 'ALL' || m.rag_status === ragFilter;
    return matchesSearch && matchesRag;
  });

  // Sorting
  filteredScorecards.sort((a, b) => {
    if (sortBy === 'exposure') return b.unresolved_exposure - a.unresolved_exposure;
    if (sortBy === 'rate') return b.exception_rate_pct - a.exception_rate_pct;
    if (sortBy === 'volume') return b.gross_volume - a.gross_volume;
    if (sortBy === 'sla') return b.avg_settlement_sla_days - a.avg_settlement_sla_days;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={20} color="#2563EB" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                Merchant Health Scorecard & Risk Profiling
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Continuous SLA compliance tracking, exception rate ranking, and Red/Amber/Green counterparty risk management
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadScorecard}
          className="btn btn-secondary"
          style={{ padding: '7px 14px', fontSize: '12.5px', gap: '6px' }}
        >
          <RefreshCw size={14} color="#64748B" />
          <span>Refresh Scorecards</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="kpi-grid">
        {/* Active Merchants */}
        <div className="kpi-card" style={{ borderTop: '3px solid #2563EB' }}>
          <div className="kpi-icon" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
            <Store size={20} color="#2563EB" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Active Counterparties</span>
            <div className="kpi-value">{summary.total_merchants}</div>
            <span className="kpi-subtext">Monitored in current reconciliation batch</span>
          </div>
        </div>

        {/* High Risk Merchants */}
        <div className="kpi-card" style={{ borderTop: '3px solid #DC2626' }}>
          <div className="kpi-icon" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <ShieldAlert size={20} color="#DC2626" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">High-Risk (RED RAG)</span>
            <div className="kpi-value" style={{ color: summary.high_risk_merchants_count > 0 ? '#DC2626' : undefined }}>
              {summary.high_risk_merchants_count}
            </div>
            <span className="kpi-subtext">Breaching &gt;15% exception or SLA threshold</span>
          </div>
        </div>

        {/* Avg Exception Rate */}
        <div className="kpi-card" style={{ borderTop: '3px solid #D97706' }}>
          <div className="kpi-icon" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <Percent size={20} color="#D97706" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Average Exception Rate</span>
            <div className="kpi-value" style={{ color: summary.avg_exception_rate > 5 ? '#D97706' : '#059669' }}>
              {summary.avg_exception_rate.toFixed(1)}%
            </div>
            <span className="kpi-subtext">Industry benchmark tolerance &lt; 5.0%</span>
          </div>
        </div>

        {/* Total At-Risk Exposure */}
        <div className="kpi-card" style={{ borderTop: '3px solid #7C3AED' }}>
          <div className="kpi-icon" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
            <TrendingUp size={20} color="#7C3AED" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">At-Risk Rupee Exposure</span>
            <div className="kpi-value" style={{ color: '#0F172A' }}>
              ₹{summary.total_merchant_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="kpi-subtext">Total unrecovered discrepancy balance</span>
          </div>
        </div>
      </div>

      {/* Filters, Search & Sorting Bar */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Filter by merchant name, category, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '38px', height: '40px' }}
            />
          </div>

          {/* RAG Status Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(['ALL', 'RED', 'AMBER', 'GREEN'] as const).map((status) => {
              const isSelected = ragFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setRagFilter(status)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected ? '1px solid #2563EB' : '1px solid var(--border-subtle)',
                    background: isSelected
                      ? '#EFF6FF'
                      : status === 'RED'
                      ? '#FEF2F2'
                      : status === 'AMBER'
                      ? '#FFFBEB'
                      : status === 'GREEN'
                      ? '#ECFDF5'
                      : '#FFFFFF',
                    color: isSelected
                      ? '#1D4ED8'
                      : status === 'RED'
                      ? '#DC2626'
                      : status === 'AMBER'
                      ? '#D97706'
                      : status === 'GREEN'
                      ? '#059669'
                      : 'var(--text-secondary)',
                    boxShadow: isSelected ? '0 1px 3px rgba(37, 99, 235, 0.15)' : 'none',
                  }}
                >
                  {status === 'ALL' ? 'All Merchants' : `${status} Status`}
                </button>
              );
            })}
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpDown size={15} color="#64748B" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="select-field"
              style={{ height: '40px' }}
            >
              <option value="exposure">Sort: Highest Exposure (₹)</option>
              <option value="rate">Sort: Highest Exception Rate (%)</option>
              <option value="volume">Sort: Gross Processed Volume (₹)</option>
              <option value="sla">Sort: Longest Payout SLA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Scorecard Table */}
      <div className="table-container" style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
        <table className="finctrl-table">
          <thead>
            <tr>
              <th>Risk RAG</th>
              <th>Merchant Profile</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Gross Volume</th>
              <th style={{ textAlign: 'right' }}>Transactions</th>
              <th style={{ textAlign: 'right' }}>Exceptions</th>
              <th style={{ textAlign: 'right' }}>Exception Rate</th>
              <th style={{ textAlign: 'right' }}>Exposure (₹)</th>
              <th style={{ textAlign: 'center' }}>Avg Settlement</th>
              <th style={{ textAlign: 'center', width: '130px' }}>Compliance</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredScorecards.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                  No merchants matched the current filter criteria.
                </td>
              </tr>
            ) : (
              filteredScorecards.map((m) => {
                const ragPillClass =
                  m.rag_status === 'RED'
                    ? 'rag-pill rag-pill-red'
                    : m.rag_status === 'AMBER'
                    ? 'rag-pill rag-pill-amber'
                    : 'rag-pill rag-pill-green';
                const ragDotClass =
                  m.rag_status === 'RED'
                    ? 'rag-dot rag-dot-red'
                    : m.rag_status === 'AMBER'
                    ? 'rag-dot rag-dot-amber'
                    : 'rag-dot rag-dot-green';

                return (
                  <tr key={m.merchant_id}>
                    <td>
                      <span className={ragPillClass}>
                        <span className={ragDotClass} />
                        <span>{m.rag_status}</span>
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{m.merchant_name}</div>
                      <div className="font-mono" style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                        {m.merchant_id}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        {m.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{m.gross_volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {m.total_transactions}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: m.exceptions_count > 0 ? 700 : 400, color: m.exceptions_count > 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                      {m.exceptions_count}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: m.exception_rate_pct > 10 ? '#DC2626' : m.exception_rate_pct > 5 ? '#D97706' : '#059669',
                        }}
                      >
                        {m.exception_rate_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: m.unresolved_exposure > 0 ? '#DC2626' : '#059669' }}>
                      {m.unresolved_exposure > 0
                        ? `₹${m.unresolved_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : '₹0.00'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                        <Clock size={12} color="#64748B" />
                        <span>T+{m.avg_settlement_sla_days.toFixed(1)}d</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                          <span style={{ color: m.compliance_score < 70 ? '#DC2626' : m.compliance_score < 90 ? '#D97706' : '#059669' }}>
                            {m.compliance_score.toFixed(0)}%
                          </span>
                          <span style={{ color: '#94A3B8', fontSize: '10px' }}>Score</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, m.compliance_score))}%`,
                              height: '100%',
                              borderRadius: '3px',
                              background:
                                m.compliance_score < 70
                                  ? '#EF4444'
                                  : m.compliance_score < 90
                                  ? '#F59E0B'
                                  : '#10B981',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {onNavigateToExceptions ? (
                        <button
                          onClick={() => onNavigateToExceptions(m.merchant_name)}
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '11.5px', gap: '4px' }}
                          title={`Investigate ${m.exceptions_count} exceptions for ${m.merchant_name}`}
                        >
                          <span>Review</span>
                          <ArrowRight size={13} />
                        </button>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
