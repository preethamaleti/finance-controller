import React, { useState, useEffect } from 'react';
import { BarChart3, ShieldCheck, Zap } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { EvaluationResult } from '../types';
import { apiService } from '../api/client';

interface EvaluationProps {
  batchId?: string;
  onSelectException: (id: string) => void;
}

export const Evaluation: React.FC<EvaluationProps> = ({ batchId, onSelectException }) => {
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (batchId) {
      setLoading(true);
      apiService
        .getEvaluation(batchId)
        .then((res) => setEvalResult(res))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [batchId]);

  if (!batchId || (!loading && !evalResult)) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <BarChart3 size={48} color="#94A3B8" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>No Batch Evaluation Available</h3>
        <p style={{ fontSize: '13px', marginTop: '6px' }}>
          Run the reconciliation controller on a dataset to generate an automated evaluation against hidden Ground Truth.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <div className="pulse-glow" style={{ fontSize: '15px', fontWeight: 600 }}>
          Benchmarking controller predictions against hidden ground-truth labels...
        </div>
      </div>
    );
  }

  const cm = evalResult!.confusion_matrix;
  const distData = Object.entries(evalResult!.exception_distribution || {}).map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    count,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="glass-card" style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldCheck size={18} color="#059669" />
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
                Automated Ground-Truth Evaluation
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
              Batch Accuracy & Benchmark Report
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Evaluated across {evalResult!.total_records} records against blind scenario labels. Verification over generation.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Measured Throughput</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563EB', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={22} color="#2563EB" />
              <span>{evalResult!.throughput_records_per_sec.toFixed(1)} rec/s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Match Accuracy</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
            {evalResult!.match_accuracy.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Overall record classification rate</div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Value-Weighted Accuracy</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563EB', marginTop: '6px' }}>
            {evalResult!.value_weighted_accuracy.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Rupee-weighted financial accuracy</div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Precision / Recall / F1</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#7C3AED', marginTop: '6px' }}>
            F1: {evalResult!.f1_score.toFixed(1)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            P: {evalResult!.exception_precision.toFixed(1)}% • R: {evalResult!.exception_recall.toFixed(1)}%
          </div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>False Resolution Rate</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: evalResult!.false_resolution_rate === 0 ? '#059669' : '#DC2626', marginTop: '6px' }}>
            {evalResult!.false_resolution_rate.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {evalResult!.false_resolution_rate === 0 ? 'Zero forced resolutions' : 'Forced resolutions'}
          </div>
        </div>
      </div>

      {/* Confusion Matrix & Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Confusion Matrix Visual Grid */}
        <div className="glass-card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
            Classification Confusion Matrix
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>True Positives (TP)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{cm.TP}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Exceptions Correctly Flagged</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>False Positives (FP)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{cm.FP}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Clean matches flagged as exception</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>False Negatives (FN)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{cm.FN}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Exceptions missed</div>
            </div>

            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>True Negatives (TN)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{cm.TN}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Clean Matches Verified</div>
            </div>
          </div>
        </div>

        {/* Exception Type Distribution Chart */}
        <div className="glass-card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
            Detected Exception Distribution
          </h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} angle={-15} textAnchor="end" />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#0F172A', boxShadow: 'var(--shadow-md)' }} />
                <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Honest Unresolved Exceptions Report */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Honest Unresolved Exceptions ({evalResult!.unresolved_exceptions_report.length})
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Discrepancies where ledger evidence was insufficient. The agent honestly declined to resolve without proof.
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="finctrl-table">
            <thead>
              <tr>
                <th>Exception ID</th>
                <th>Transaction</th>
                <th>Merchant</th>
                <th>Exposure (₹)</th>
                <th>Type</th>
                <th>Severity</th>
                <th>AI Reason for Unresolution</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {evalResult!.unresolved_exceptions_report.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    No unresolved exceptions in this batch.
                  </td>
                </tr>
              ) : (
                evalResult!.unresolved_exceptions_report.map((unr, idx) => (
                  <tr key={idx} onClick={() => onSelectException(unr.exception_id)}>
                    <td className="font-mono" style={{ color: '#1D4ED8', fontWeight: 600 }}>{unr.exception_id}</td>
                    <td className="font-mono">{unr.transaction_id}</td>
                    <td>{unr.merchant_name}</td>
                    <td style={{ fontWeight: 700, color: '#DC2626' }}>
                      ₹{unr.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>{unr.exception_type.replace(/_/g, ' ')}</td>
                    <td>
                      <span className="badge badge-critical">{unr.severity}</span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                      {unr.reason}
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectException(unr.exception_id);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Inspect
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
