import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Activity, ArrowUpRight, RefreshCw } from 'lucide-react';
import { apiService } from '../../api/client';
import { LiveEvent } from '../../types';

interface LiveReconFeedProps {
  onSelectTransaction?: (txnId: string) => void;
}

export const LiveReconFeed: React.FC<LiveReconFeedProps> = ({ onSelectTransaction }) => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const streamIntervalRef = useRef<any>(null);

  // Initialize SSE connection
  useEffect(() => {
    const eventSource = new EventSource(apiService.getLiveFeedUrl());

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event && data.event !== 'connection.established') {
          setEvents((prev) => [data as LiveEvent, ...prev.slice(0, 24)]);
        }
      } catch (err) {
        // Heartbeat or malformed frame
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  const handleTriggerSingle = async (type = 'payment.captured') => {
    setIsTriggering(true);
    try {
      const randomAmounts = [1499, 2999, 4999, 850, 12400, 3200];
      const amt = randomAmounts[Math.floor(Math.random() * randomAmounts.length)];
      await apiService.simulateWebhook(type, amt);
    } catch (err) {
      console.error('Webhook simulation failed', err);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSyncRazorpay = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await apiService.syncLiveRazorpay();
      if (res.fetched_count === 0) {
        setSyncStatusMsg('Razorpay account has 0 recent payments');
      } else {
        setSyncStatusMsg(`Synced ${res.reconciled_count} live payments from Razorpay API`);
      }
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      console.error('Sync failed', err);
      setSyncStatusMsg('Sync error: Check API keys');
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleStreamSimulation = () => {
    if (isStreaming) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      setIsStreaming(false);
    } else {
      setIsStreaming(true);
      // Fire an immediate event then interval
      handleTriggerSingle('payment.captured');
      streamIntervalRef.current = setInterval(() => {
        const eventTypes = ['payment.captured', 'payment.captured', 'refund.created', 'payment.captured', 'settlement.processed'];
        const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        handleTriggerSingle(chosen);
      }, 3000);
    }
  };

  const avgLatency = events.length > 0
    ? (events.reduce((acc, curr) => acc + (curr.latency_ms || 8), 0) / events.length).toFixed(1)
    : '6.4';

  return (
    <div className="card live-feed-container" style={{ borderColor: 'var(--color-primary)', borderWidth: '1.5px' }}>
      {/* Header */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Radio className="icon-pulse" size={18} color={isConnected ? '#38A169' : '#E53E3E'} />
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#38A169' : '#E53E3E',
              marginLeft: '4px',
              animation: isConnected ? 'pulse 1.5s infinite' : 'none'
            }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Razorpay Real-Time Webhook Feed
              <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                HMAC-SHA256 Verified
              </span>
              {syncStatusMsg && (
                <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                  {syncStatusMsg}
                </span>
              )}
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Subscribed to <code>/api/webhooks/live-feed</code> (SSE) &bull; Avg Latency: <b>{avgLatency}ms</b>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleSyncRazorpay}
            disabled={isSyncing}
            className="btn btn-secondary btn-sm"
            style={{ background: '#F1F5F9', color: '#1E293B', fontWeight: 600 }}
            title="Fetch and reconcile all live payments directly from Razorpay REST API"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Razorpay API'}
          </button>
          <button
            onClick={() => handleTriggerSingle('payment.captured')}
            disabled={isTriggering}
            className="btn btn-secondary btn-sm"
            title="Simulate a single authentic payment.captured webhook"
          >
            <Zap size={14} />
            Mock Webhook
          </button>
          <button
            onClick={toggleStreamSimulation}
            className={`btn btn-sm ${isStreaming ? 'btn-danger' : 'btn-primary'}`}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />}
            {isStreaming ? 'Stop Stream' : 'Start Live Stream'}
          </button>
        </div>
      </div>


      {/* Ticker / Event List */}
      <div style={{
        maxHeight: '260px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '8px 0',
      }}>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            <Activity size={24} style={{ opacity: 0.5, marginBottom: '6px' }} />
            <p style={{ margin: 0 }}>Listening for incoming Razorpay Webhooks...</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
              Click <b>"Start Live Stream"</b> or <b>"Mock Webhook"</b> to dispatch live events.
            </p>
          </div>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                fontSize: '0.82rem',
                animation: 'fadeIn 0.3s ease-in-out'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {evt.status === 'MATCHED' ? (
                  <CheckCircle2 size={16} color="#38A169" />
                ) : evt.status === 'MATCHED_WITH_ADJUSTMENT' ? (
                  <ShieldCheck size={16} color="#3182CE" />
                ) : (
                  <AlertTriangle size={16} color="#DD6B20" />
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code style={{ fontSize: '0.78rem', color: 'var(--color-primary-light)' }}>
                      {evt.event}
                    </code>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                      ({evt.transaction_id})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    {evt.details || `${evt.merchant_name} &bull; Matched via ${evt.match_level}`}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  ₹{evt.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', fontSize: '0.7rem' }}>
                  <span className="badge badge-neutral" style={{ padding: '1px 4px' }}>
                    {evt.latency_ms}ms
                  </span>
                  <span className={`badge ${evt.status === 'MATCHED' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '1px 5px' }}>
                    {evt.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
