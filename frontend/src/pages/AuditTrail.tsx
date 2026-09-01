import React, { useState, useEffect } from 'react';
import { History, Search } from 'lucide-react';
import { AuditLog } from '../types';
import { apiService } from '../api/client';

interface AuditTrailProps {
  batchId?: string;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ batchId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    apiService
      .getAuditTrail(batchId)
      .then((res) => setLogs(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [batchId]);

  const filteredLogs = logs.filter((l) => {
    if (!search) return true;
    return (
      (l.transaction_id && l.transaction_id.toLowerCase().includes(search.toLowerCase())) ||
      l.event_type.toLowerCase().includes(search.toLowerCase()) ||
      l.action_taken.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={22} color="#2563EB" />
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A' }}>Immutable Audit Trail</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Chronological log of all deterministic matches, AI investigation decisions, tools executed, and human sign-offs.
            </p>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-container">
        <table className="finctrl-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Transaction</th>
              <th>Event Type</th>
              <th>Decision</th>
              <th>Tools Executed</th>
              <th>Action Taken</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <div className="pulse-glow">Loading audit logs...</div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="font-mono" style={{ color: '#1D4ED8', fontWeight: 600 }}>
                    {log.transaction_id || 'System Batch'}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                      {log.event_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        log.decision === 'RESOLVED' || log.decision === 'MATCHED'
                          ? 'badge-matched'
                          : log.decision === 'UNRESOLVED'
                          ? 'badge-critical'
                          : 'badge-ai'
                      }`}
                    >
                      {log.decision}
                    </span>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {log.tools_called && log.tools_called.length > 0 ? (
                      <span className="font-mono" style={{ fontWeight: 600, color: '#0F172A' }}>{log.tools_called.slice(0, 3).join(', ')}</span>
                    ) : (
                      'None (Deterministic)'
                    )}
                  </td>
                  <td style={{ fontSize: '13px', color: '#0F172A', maxWidth: '340px' }}>
                    {log.action_taken}
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
