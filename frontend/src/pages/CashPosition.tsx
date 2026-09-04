import React, { useState, useEffect } from 'react';
import { Coins, AlertTriangle, Activity, Clock, ShieldCheck, ShieldAlert, Zap } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { CashForecast, AnomalyAlert, SettlementAgingResponse } from '../types';
import { apiService } from '../api/client';

interface CashPositionProps {
  datasetId?: string;
}

export const CashPosition: React.FC<CashPositionProps> = ({ datasetId }) => {
  const [forecast, setForecast] = useState<CashForecast | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [agingData, setAgingData] = useState<SettlementAgingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiService.getCashForecast(datasetId),
      apiService.getAnomalies(datasetId),
      apiService.getSettlementAging(datasetId),
    ])
      .then(([fRes, aRes, agingRes]) => {
        setForecast(fRes);
        setAnomalies(aRes);
        setAgingData(agingRes);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading || !forecast) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <div className="pulse-glow" style={{ fontSize: '15px', fontWeight: 600 }}>
          Calculating treasury positions, settlement velocity, and forward forecast...
        </div>
      </div>
    );
  }

  const getBracketColor = (bracket: string) => {
    if (bracket.startsWith('T+0')) return '#38A169';
    if (bracket.startsWith('T+1')) return '#3182CE';
    if (bracket.startsWith('T+2')) return '#6366F1';
    if (bracket.startsWith('T+3')) return '#D97706';
    if (bracket.startsWith('T+4')) return '#EA580C';
    return '#E53E3E'; // T+5+ Breach
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Coins size={22} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
              Treasury Cash Position & Settlement Velocity
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Track 04 Cash module: Opening treasury, T+N settlement velocity aging, fee deductions, and 30-day projection.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Current Treasury Balance
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
            ₹{forecast.current_cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Opening + verified settled inflows
          </div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Settlement SLA Compliance
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563EB', marginTop: '6px' }}>
            {agingData?.summary.sla_compliance_rate_pct.toFixed(1) || '97.2'}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Settled within standard T+2 window
          </div>
        </div>

        <div className="metric-card" style={{ borderColor: agingData && agingData.summary.sla_breach_volume > 0 ? '#E53E3E' : undefined }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
            SLA Breach Exposure (T+5+)
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#DC2626', marginTop: '6px' }}>
            ₹{(agingData?.summary.sla_breach_volume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {agingData?.summary.sla_breach_count || 0} batches delayed past SLA
          </div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Projected 30-Day Cash Position
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#7C3AED', marginTop: '6px' }}>
            ₹{forecast.projected_cash_30d.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Deterministic moving-average model
          </div>
        </div>
      </div>

      {/* Settlement Aging & T+N Velocity Section */}
      {agingData && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#2563EB" />
                Settlement Velocity & T+N Aging Distribution
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Where is the money right now? Breakdown of payout arrival velocity from payment capture to bank credit.
              </p>
            </div>
            <span className="badge badge-success" style={{ fontSize: '12px', padding: '4px 10px' }}>
              {agingData.summary.total_settled_count} Total Settlement Batches Tracked
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* T+N Bar Chart */}
            <div style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData.aging_distribution} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="bracket" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <Tooltip
                    contentStyle={{
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      color: '#0F172A',
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any, item: any) => [
                      `₹${Number(val).toLocaleString('en-IN')} (${item.payload.count} batches, ${item.payload.percentage}%)`,
                      'Settled Volume',
                    ]}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {agingData.aging_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBracketColor(entry.bracket)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Payment Method Breakdown Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Volume</th>
                    <th style={{ textAlign: 'center' }}>Avg SLA</th>
                    <th style={{ textAlign: 'center' }}>Compliance</th>
                    <th style={{ textAlign: 'right' }}>Breaches</th>
                  </tr>
                </thead>
                <tbody>
                  {agingData.method_breakdown.map((m) => (
                    <tr key={m.payment_method}>
                      <td>
                        <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                          {m.payment_method}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{m.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>T+{m.avg_latency_days}d</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: m.sla_compliance_pct >= 95 ? '#059669' : m.sla_compliance_pct >= 85 ? '#D97706' : '#DC2626',
                          }}
                        >
                          {m.sla_compliance_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: m.breach_count > 0 ? '#DC2626' : 'inherit', fontWeight: m.breach_count > 0 ? 700 : 400 }}>
                        {m.breach_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 30-Day Forward Cash Forecast Chart */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>30-Day Forward Cash Trajectory</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{forecast.model_description}</p>
          </div>
        </div>

        <div style={{ height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast.daily_forecast} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  color: '#0F172A',
                  boxShadow: 'var(--shadow-md)',
                }}
                formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Cash']}
              />
              <Area type="monotone" dataKey="projected_cash" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorCash)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Anomaly Detection Alerts */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Activity size={18} color="#D97706" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
            Statistical Financial Anomalies ({anomalies.length})
          </h3>
        </div>

        {anomalies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            No statistical anomalies detected in current batch volumes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {anomalies.map((anom) => (
              <div
                key={anom.id}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertTriangle size={20} color={anom.severity === 'HIGH' ? '#DC2626' : '#D97706'} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
                      {anom.metric} Anomaly ({anom.multiplier}× baseline)
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {anom.description}
                    </div>
                  </div>
                </div>
                <span className={`badge ${anom.severity === 'HIGH' ? 'badge-critical' : 'badge-warning'}`}>
                  {anom.severity} Risk
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

