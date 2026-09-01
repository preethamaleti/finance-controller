import React, { useState } from 'react';
import { X, Sparkles, Database, Sliders } from 'lucide-react';
import { apiService } from '../../api/client';
import { Dataset } from '../../types';

interface GenerateDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetCreated: (dataset: Dataset) => void;
}

export const GenerateDatasetModal: React.FC<GenerateDatasetModalProps> = ({
  isOpen,
  onClose,
  onDatasetCreated,
}) => {
  const [name, setName] = useState('Razorpay Synthetic Batch');
  const [recordCount, setRecordCount] = useState(500);
  const [seed, setSeed] = useState(42);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Scenarios
  const [normalPct, setNormalPct] = useState(70);
  const [feeMismatchPct, setFeeMismatchPct] = useState(8);
  const [refundPct, setRefundPct] = useState(5);
  const [delayedPct, setDelayedPct] = useState(4);
  const [missingPct, setMissingPct] = useState(3);
  const [duplicatePct, setDuplicatePct] = useState(3);
  const [unresolvablePct, setUnresolvablePct] = useState(2);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const scenarios = {
        normal_pct: normalPct,
        fee_mismatch_pct: feeMismatchPct,
        refund_pct: refundPct,
        delayed_settlement_pct: delayedPct,
        missing_settlement_pct: missingPct,
        duplicate_record_pct: duplicatePct,
        incorrect_amount_pct: 3,
        complex_case_pct: 2,
        unresolvable_pct: unresolvablePct,
      };
      const dataset = await apiService.generateDataset(name, recordCount, seed, scenarios);
      onDatasetCreated(dataset);
      onClose();
    } catch (err) {
      console.error('Failed to generate dataset', err);
    } finally {
      setLoading(false);
    }
  };

  const presetSizes = [50, 100, 500, 1000, 5000];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={22} color="#2563EB" />
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Generate Multi-Source Dataset</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Dataset Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="e.g. Batch Q3 Recon"
            />
          </div>

          {/* Record Count Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Record Batch Size
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {presetSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setRecordCount(size)}
                  style={{
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: recordCount === size ? '2px solid #2563EB' : '1px solid var(--border-strong)',
                    background: recordCount === size ? '#EFF6FF' : '#FFFFFF',
                    color: recordCount === size ? '#1D4ED8' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Generates linked Payments, Settlements, Bank Ledgers, Fees, Refunds, and hidden Ground Truth.
            </div>
          </div>

          {/* Seed */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Random Seed (Reproducibility)
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="input-field"
              placeholder="42"
            />
          </div>

          {/* Advanced Scenario Breakdown Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={14} />
              <span>{showAdvanced ? 'Hide Scenario Distribution' : 'Configure Scenario Distribution'}</span>
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '14px', background: '#F8FAFC', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Normal Clean Matches:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{normalPct}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fee Mismatches (Resolvable):</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{feeMismatchPct}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delayed Settlements (T+5+ days):</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{delayedPct}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Missing Gateway Settlements:</span>
                  <span style={{ fontWeight: 700, color: '#DC2626' }}>{missingPct}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Intentionally Unresolvable Discrepancies:</span>
                  <span style={{ fontWeight: 700, color: '#DC2626' }}>{unresolvablePct}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: '#F8FAFC' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleGenerate} disabled={loading} className="btn btn-primary">
            {loading ? (
              <span className="pulse-glow">Generating {recordCount} Records...</span>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate Dataset</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
