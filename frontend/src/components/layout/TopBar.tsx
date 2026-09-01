import React from 'react';
import {
  PlusCircle,
  Play,
  DollarSign,
  Cpu,
} from 'lucide-react';
import { Dataset, BatchRun } from '../../types';

interface TopBarProps {
  activeBatch?: BatchRun;
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset: (id: string) => void;
  onOpenGenerateModal: () => void;
  onRunReconciliation: () => void;
  onOpenFindTheMoney: () => void;
  isProcessing: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeBatch,
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onOpenGenerateModal,
  onRunReconciliation,
  onOpenFindTheMoney,
  isProcessing,
}) => {
  return (
    <header className="topbar">
      {/* Left: Dataset & Batch Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Dataset:</span>
          <select
            value={selectedDatasetId || ''}
            onChange={(e) => onSelectDataset(e.target.value)}
            style={{
              background: '#FFFFFF',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {datasets.length === 0 ? (
              <option value="">No Datasets (Generate one)</option>
            ) : (
              datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count} records)
                </option>
              ))
            )}
          </select>
        </div>

        {activeBatch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '4px 10px', borderRadius: '6px' }}>
            <Cpu size={14} color="#2563EB" />
            <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: 600 }}>
              Batch: <span className="font-mono">{activeBatch.id}</span>
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Find the Money Button */}
        <button
          onClick={onOpenFindTheMoney}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
            fontWeight: 700,
          }}
        >
          <DollarSign size={16} />
          <span>FIND THE MONEY</span>
        </button>

        {/* Generate Dataset */}
        <button onClick={onOpenGenerateModal} className="btn btn-secondary">
          <PlusCircle size={16} color="#475569" />
          <span>Generate Dataset</span>
        </button>

        {/* Run Controller */}
        <button
          onClick={onRunReconciliation}
          disabled={isProcessing || !selectedDatasetId}
          className="btn btn-primary"
          style={{ opacity: isProcessing || !selectedDatasetId ? 0.6 : 1 }}
        >
          {isProcessing ? (
            <>
              <div className="pulse-glow" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFFFFF' }} />
              <span>Reconciling Batch...</span>
            </>
          ) : (
            <>
              <Play size={15} />
              <span>Run Controller</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
