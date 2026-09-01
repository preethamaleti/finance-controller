import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { apiService } from '../api/client';
import { CopilotResponse } from '../types';

interface CopilotProps {
  batchId?: string;
  datasetId?: string;
}

export const Copilot: React.FC<CopilotProps> = ({ batchId, datasetId }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; tools?: any[]; citations?: string[] }>>([
    {
      role: 'assistant',
      content:
        'Hello! I am your FINCTRL Finance Copilot. I analyze actual reconciliation ledgers, quantify unresolved exposure, and investigate transaction discrepancies with verifiable evidence.',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const sampleQueries = [
    'How much money is unresolved in this batch?',
    'Show me the largest high-exposure exceptions.',
    'How many settlements are delayed past SLA?',
    'Explain why missing settlements remain unresolved.',
  ];

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    const userMsg = { role: 'user' as const, content: q };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res: CopilotResponse = await apiService.queryCopilot(q, batchId, datasetId);
      const botMsg = {
        role: 'assistant' as const,
        content: res.answer,
        tools: res.tools_used,
        citations: res.citations,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error querying finance engine. Please make sure a batch has been reconciled.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--purple-bg)', border: '1px solid var(--purple-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} color="#7C3AED" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Finance Operations Copilot</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Ask natural-language financial questions. Verified against live database ledgers with citations.
              </p>
            </div>
          </div>
          <span className="badge badge-ai">Grounded in Truth</span>
        </div>

        {/* Quick query chips */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleSend(sq)}
              style={{
                background: '#F8FAFC',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              "{sq}"
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="glass-card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                display: 'flex',
                gap: '10px',
              }}
            >
              {m.role === 'assistant' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--purple-bg)', border: '1px solid var(--purple-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={16} color="#7C3AED" />
                </div>
              )}

              <div>
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: m.role === 'user' ? 'var(--brand-gradient)' : '#F8FAFC',
                    color: m.role === 'user' ? '#FFFFFF' : '#0F172A',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {m.content}
                </div>

                {/* Tool calls & citations badge */}
                {m.citations && m.citations.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {m.citations.map((cit, cIdx) => (
                      <span key={cIdx} className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        Source: {cit}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} color="#7C3AED" />
              </div>
              <div style={{ padding: '12px 18px', borderRadius: '12px', background: '#F8FAFC', color: 'var(--text-secondary)', fontSize: '13px', border: '1px solid var(--border-subtle)' }}>
                <span className="pulse-glow">Querying database tools & calculating ledger balances...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: 'flex', gap: '12px', marginTop: '16px' }}
        >
          <input
            type="text"
            placeholder="Ask a question about this reconciliation batch or investigate a transaction..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field"
            style={{ padding: '11px 16px' }}
          />
          <button type="submit" disabled={loading || !query.trim()} className="btn btn-primary" style={{ padding: '11px 20px' }}>
            <Send size={16} />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
};
