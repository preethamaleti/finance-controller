import React, { useState, useEffect } from 'react';
import { Coins, AlertTriangle, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { CashForecast, AnomalyAlert } from '../types';
import { apiService } from '../api/client';

interface CashPositionProps {
  datasetId?: string;
}

export const CashPosition: React.FC<CashPositionProps> = ({ datasetId }) => {
  const [forecast, setForecast] = useState<CashForecast | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiService.getCashForecast(datasetId), apiService.getAnomalies(datasetId)])
      .then(([fRes, aRes]) => {
        setForecast(fRes);
        setAnomalies(aRes);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading || !forecast) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <div className="pulse-glow" style={{ fontSize: '15px', fontWeight: 600 }}>Calculating treasury positions and forward forecast...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coins size={22} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Treasury Cash Position & Forecast</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Track 04 Cash module: Opening treasury, expected gateway settlements, fee deductions, and 30-day projection.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Treasury Balance</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
            ₹{forecast.current_cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Opening + verified settled inflows</div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Projected Settlements (7-Day)</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563EB', marginTop: '6px' }}>
            ₹{forecast.projected_settlements_7d.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Incoming gateway payouts</div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Projected 30-Day Cash Position</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#7C3AED', marginTop: '6px' }}>
            ₹{forecast.projected_cash_30d.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Deterministic moving-average model</div>
        </div>
      </div>

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
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#0F172A', boxShadow: 'var(--shadow-md)' }} formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Cash']} />
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
