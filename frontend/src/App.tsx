import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Reconciliation } from './pages/Reconciliation';
import { ExceptionCenter } from './pages/ExceptionCenter';
import { ExceptionDetailView } from './pages/ExceptionDetail';
import { Copilot } from './pages/Copilot';
import { Evaluation } from './pages/Evaluation';
import { CashPosition } from './pages/CashPosition';
import { AuditTrail } from './pages/AuditTrail';
import { FindTheMoneyModal } from './components/ui/FindTheMoneyModal';
import { ExplainMetricModal } from './components/ui/ExplainMetricModal';
import { GenerateDatasetModal } from './components/ui/GenerateDatasetModal';
import { apiService } from './api/client';
import { Dataset, BatchRun, DashboardSummary, ExceptionItem, FindTheMoneyResponse } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>();
  const [activeBatch, setActiveBatch] = useState<BatchRun | undefined>();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isFindTheMoneyOpen, setIsFindTheMoneyOpen] = useState(false);
  const [explainMetric, setExplainMetric] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // Load Datasets on Mount
  const loadDatasets = async () => {
    try {
      const list = await apiService.listDatasets();
      setDatasets(list);
      if (list.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(list[0].id);
      }
    } catch (err) {
      console.error('Error fetching datasets', err);
    }
  };

  // Load Summary and Exceptions
  const loadBatchData = async (batchId?: string) => {
    try {
      const sum = await apiService.getDashboardSummary(batchId);
      setSummary(sum);
      if (sum.batch_id) {
        const b = await apiService.getBatchStatus(sum.batch_id);
        setActiveBatch(b);
        const excs = await apiService.listExceptions(sum.batch_id);
        setExceptions(excs);
      }
    } catch (err) {
      console.error('Error loading summary', err);
    }
  };

  useEffect(() => {
    loadDatasets();
    loadBatchData();
  }, []);

  const handleRunReconciliation = async () => {
    if (!selectedDatasetId) return;
    setIsProcessing(true);
    try {
      const res = await apiService.runReconciliation(selectedDatasetId, true);
      await loadBatchData(res.batch_id);
      setCurrentTab('dashboard');
    } catch (err) {
      console.error('Reconciliation failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectException = (id: string) => {
    setSelectedExceptionId(id);
    setCurrentTab('exception-detail');
  };

  const unresolvedCount = exceptions.filter((e) => e.status === 'UNRESOLVED' || e.status === 'OPEN').length;
  const criticalCount = exceptions.filter((e) => e.severity === 'CRITICAL').length;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setSelectedExceptionId(null);
          setCurrentTab(tab);
        }}
        unresolvedCount={unresolvedCount}
        criticalCount={criticalCount}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <TopBar
          activeBatch={activeBatch}
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          onSelectDataset={(id) => {
            setSelectedDatasetId(id);
          }}
          onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
          onRunReconciliation={handleRunReconciliation}
          onOpenFindTheMoney={() => setIsFindTheMoneyOpen(true)}
          isProcessing={isProcessing}
        />

        <main className="page-body">
          {currentTab === 'dashboard' && (
            <Dashboard
              summary={summary}
              exceptions={exceptions}
              onOpenExplain={(m) => setExplainMetric(m)}
              onOpenFindTheMoney={() => setIsFindTheMoneyOpen(true)}
              onSelectException={handleSelectException}
              onNavigateToTab={(t) => setCurrentTab(t)}
            />
          )}

          {currentTab === 'reconciliation' && (
            <Reconciliation
              batchId={summary?.batch_id}
              onSelectException={handleSelectException}
            />
          )}

          {currentTab === 'exceptions' && (
            <ExceptionCenter
              exceptions={exceptions}
              onSelectException={handleSelectException}
              onRefresh={() => loadBatchData(summary?.batch_id)}
            />
          )}

          {currentTab === 'exception-detail' && selectedExceptionId && (
            <ExceptionDetailView
              exceptionId={selectedExceptionId}
              onBack={() => setCurrentTab('exceptions')}
              onRefresh={() => loadBatchData(summary?.batch_id)}
            />
          )}

          {currentTab === 'copilot' && (
            <Copilot
              batchId={summary?.batch_id}
              datasetId={selectedDatasetId}
            />
          )}

          {currentTab === 'evaluation' && (
            <Evaluation
              batchId={summary?.batch_id}
              onSelectException={handleSelectException}
            />
          )}

          {currentTab === 'cash' && (
            <CashPosition datasetId={selectedDatasetId} />
          )}

          {currentTab === 'audit' && (
            <AuditTrail batchId={summary?.batch_id} />
          )}
        </main>
      </div>

      {/* Modals */}
      {summary && (
        <FindTheMoneyModal
          isOpen={isFindTheMoneyOpen}
          onClose={() => setIsFindTheMoneyOpen(false)}
          data={summary.exposure_breakdown}
          onDrillDown={() => {
            setCurrentTab('exceptions');
          }}
        />
      )}

      <ExplainMetricModal
        isOpen={!!explainMetric}
        onClose={() => setExplainMetric(null)}
        metricName={explainMetric || ''}
        batchId={summary?.batch_id}
      />

      <GenerateDatasetModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onDatasetCreated={(newDs) => {
          setDatasets((prev) => [newDs, ...prev]);
          setSelectedDatasetId(newDs.id);
        }}
      />
    </div>
  );
}

export default App;
