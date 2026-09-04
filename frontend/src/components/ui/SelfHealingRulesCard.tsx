import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  BrainCircuit, 
  RefreshCw,
  Zap
} from 'lucide-react';
import { apiService } from '../../api/client';

interface RuleSuggestion {
  id: string;
  name: string;
  rule_type: string;
  description: string;
  frequency_count: number;
  estimated_recovery: number;
  confidence: number;
  status: string;
  created_at: string;
}

interface SelfHealingRulesCardProps {
  batchId?: string;
  onRuleApplied?: () => void;
}

export const SelfHealingRulesCard: React.FC<SelfHealingRulesCardProps> = ({ batchId, onRuleApplied }) => {
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const [sugRes, allRes] = await Promise.all([
        apiService.getSuggestedRules(batchId),
        apiService.getRules(),
      ]);

      const sugList = Array.isArray(sugRes) ? sugRes : (sugRes?.suggestions || []);
      const allList = Array.isArray(allRes) ? allRes : (allRes?.rules || []);

      setSuggestions(sugList);
      const active = allList.filter((r: any) => r.status === 'ACTIVE').length;
      setActiveCount(active);
    } catch (err) {
      console.error('Failed to fetch self-healing rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [batchId]);

  const handleApprove = async (ruleId: string) => {
    try {
      setActionInProgress(ruleId);
      await apiService.approveRule(ruleId);
      await fetchRules();
      if (onRuleApplied) {
        onRuleApplied();
      }
    } catch (err) {
      console.error('Failed to approve rule:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDismiss = async (ruleId: string) => {
    try {
      setActionInProgress(ruleId);
      await apiService.dismissRule(ruleId);
      await fetchRules();
    } catch (err) {
      console.error('Failed to dismiss rule:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading && suggestions.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
        <RefreshCw size={15} className="animate-spin" color="#6366F1" />
        <span style={{ fontSize: '13px' }}>Analyzing recurring reconciliation friction for self-healing rules...</span>
      </div>
    );
  }

  if (suggestions.length === 0 && activeCount === 0) {
    return null;
  }

  return (
    <div
      className="glass-card"
      style={{
        background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 50%, #ECFDF5 100%)',
        border: '1px solid #C7D2FE',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(99, 102, 241, 0.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
            }}
          >
            <BrainCircuit size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                Self-Healing Matching Rules
              </h3>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  background: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  color: '#15803D',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />
                <span>Continuous Learning Active</span>
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Learned from recurring fee & settlement friction. Approved rules auto-resolve future anomalies without manual review.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                color: '#1E293B',
              }}
            >
              <ShieldCheck size={15} color="#10B981" />
              <span>{activeCount} Active Rules Guarding Pipeline</span>
            </span>
          )}
          <button
            onClick={fetchRules}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            title="Scan for new rule suggestions"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Suggestion Cards */}
      {suggestions.length === 0 ? (
        <div
          style={{
            padding: '12px 16px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10B981" />
            <span>All exception clusters conform to active policy. Zero anomalous rule drift.</span>
          </div>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Continuously evaluated per batch</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {suggestions.map((sug) => {
            const isActing = actionInProgress === sug.id;
            return (
              <div
                key={sug.id}
                style={{
                  padding: '14px 18px',
                  background: '#FFFFFF',
                  border: '1px solid #E0E7FF',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                      {sug.name}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE',
                      }}
                    >
                      {sug.rule_type?.replace(/_/g, ' ') || 'RULE'}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #FDE68A',
                      }}
                    >
                      <TrendingUp size={12} />
                      <span>{sug.frequency_count} recurring transactions</span>
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#DCFCE7',
                        color: '#166534',
                        border: '1px solid #BBF7D0',
                      }}
                    >
                      ₹{Number(sug.estimated_recovery || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} exposure
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, margin: '2px 0 0' }}>
                    {sug.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                    <span>
                      Pattern Confidence: <strong style={{ color: '#059669' }}>{Math.round((sug.confidence || 0.94) * 100)}%</strong>
                    </span>
                    <span>•</span>
                    <span>Target: Razorpay Gateway MDR Tolerance</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleDismiss(sug.id)}
                    disabled={isActing}
                    className="btn btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '12px' }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleApprove(sug.id)}
                    disabled={isActing}
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #4F46E5 0%, #059669 100%)',
                      padding: '7px 14px',
                      fontSize: '12px',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                    }}
                  >
                    {isActing ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Activating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} color="#FDE047" />
                        <span>Approve & Activate Rule</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
