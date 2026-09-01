import React from 'react';
import {
  ShieldCheck,
  Zap,
  DollarSign,
  HelpCircle,
  ArrowUpRight,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { DashboardSummary, ExceptionItem } from '../types';

interface DashboardProps {
  summary: DashboardSummary | null;
  exceptions: ExceptionItem[];
  onOpenExplain: (metric: string) => void;
  onOpenFindTheMoney: () => void;
  onSelectException: (id: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  exceptions,
  onOpenExplain,
  onOpenFindTheMoney,
  onSelectException,
  onNavigateToTab,
}) => {
  if (!summary || summary.total_records === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--brand-gradient)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <ShieldCheck size={36} color="#FFFFFF" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>FINCTRL AI is Ready</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '10px auto 24px' }}>
          Generate a synthetic multi-source financial dataset or run the reconciliation controller to start analyzing.
        </p>
      </div>
    );
  }

  const pieData = [
    { name: 'Matched', value: summary.status_counts.MATCHED || 0, color: '#059669' },
    { name: 'AI Resolved', value: summary.status_counts.RESOLVED || 0, color: '#7C3AED' },
    { name: 'Unresolved', value: summary.status_counts.UNRESOLVED || 0, color: '#DC2626' },
  ];

  const exposureData = summary.exposure_breakdown?.categories.map((c) => ({
    name: c.category.replace(' Settlements', '').replace(' Discrepancies', ''),
    amount: c.amount,
  })) || [];

  const criticalExceptions = exceptions.filter((e) => e.severity === 'CRITICAL' || e.severity === 'HIGH').slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Spotlight Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #ECFDF5 100%)',
          border: '1px solid #BFDBFE',
          borderRadius: '16px',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-ai">Controller Active</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Verified Ledger State</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Executive Financial Control Summary
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Closed-loop multi-source reconciliation across payments, settlements, bank accounts, fees, and refunds.
          </p>
        </div>

        <button
          onClick={onOpenFindTheMoney}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: '#FFFFFF',
            padding: '12px 22px',
            fontSize: '14.5px',
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
          }}
        >
          <DollarSign size={18} />
          <span>FIND THE MONEY: ₹{(summary.unresolved_exposure / 100000).toFixed(2)}L Risk</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Total Processed */}
        <div className="metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Total Volume
            </span>
            <button onClick={() => onOpenExplain('total_volume')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <HelpCircle size={15} />
            </button>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
            ₹{summary.total_transaction_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across {summary.total_records.toLocaleString()} transactions
          </div>
        </div>

        {/* Value-Weighted Accuracy */}
        <div className="metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Value-Weighted Accuracy
            </span>
            <button onClick={() => onOpenExplain('value_weighted_accuracy')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <HelpCircle size={15} />
            </button>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
            {summary.value_weighted_accuracy.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Rupee-weighted financial precision
          </div>
        </div>

        {/* Unresolved Exposure */}
        <div className="metric-card" style={{ borderColor: summary.unresolved_exposure > 0 ? '#FECACA' : 'var(--border-subtle)', background: summary.unresolved_exposure > 0 ? '#FEF2F2' : '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
              Unresolved Exposure
            </span>
            <button onClick={() => onOpenExplain('unresolved_exposure')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <HelpCircle size={15} />
            </button>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '6px' }}>
            ₹{summary.unresolved_exposure.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Honest unexplained exposure
          </div>
        </div>

        {/* Measured Throughput */}
        <div className="metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Measured Throughput
            </span>
            <button onClick={() => onOpenExplain('throughput')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <HelpCircle size={15} />
            </button>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={20} color="#2563EB" />
            <span>{summary.throughput.toFixed(1)}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>rec/s</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Runtime benchmark (L1-L4 engine)
          </div>
        </div>
      </div>

      {/* Visual Analytics & Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Match Distribution Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Batch Status Distribution</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total: {summary.total_records} Records</span>
          </div>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#0F172A', boxShadow: 'var(--shadow-md)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '40%' }}>
              {pieData.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: p.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Exposure by Category Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Exposure by Category</h3>
            <button onClick={onOpenFindTheMoney} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              View Details →
            </button>
          </div>
          <div style={{ height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exposureData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} angle={-15} textAnchor="end" />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#0F172A', boxShadow: 'var(--shadow-md)' }} formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Exposure']} />
                <Bar dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Exceptions Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>High-Exposure Exceptions Requiring Review</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Exceptions with highest financial exposure and priority scores
            </p>
          </div>
          <button onClick={() => onNavigateToTab('exceptions')} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12.5px' }}>
            <span>View All ({exceptions.length})</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="finctrl-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Merchant</th>
                <th>Exception Type</th>
                <th>Exposure (₹)</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {criticalExceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px' }}>
                    No critical exceptions detected in this batch.
                  </td>
                </tr>
              ) : (
                criticalExceptions.map((e) => (
                  <tr key={e.id} onClick={() => onSelectException(e.id)}>
                    <td className="font-mono" style={{ fontWeight: 600, color: '#1D4ED8' }}>
                      {e.transaction_id}
                    </td>
                    <td>{e.merchant_name}</td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                        {e.exception_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#DC2626' }}>
                      ₹{e.financial_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge ${e.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning'}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${e.status === 'RESOLVED' ? 'badge-matched' : 'badge-neutral'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectException(e.id);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
