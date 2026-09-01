import React from 'react';
import {
  LayoutDashboard,
  GitCompare,
  AlertTriangle,
  Bot,
  BarChart3,
  History,
  Coins,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  unresolvedCount?: number;
  criticalCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  unresolvedCount = 0,
  criticalCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'reconciliation', label: 'Reconciliation Engine', icon: GitCompare },
    {
      id: 'exceptions',
      label: 'Exception Center',
      icon: AlertTriangle,
      badge: unresolvedCount > 0 ? unresolvedCount : undefined,
      badgeColor: criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500',
    },
    { id: 'copilot', label: 'Finance Copilot', icon: Bot, isAi: true },
    { id: 'evaluation', label: 'Batch Evaluation', icon: BarChart3, highlight: true },
    { id: 'cash', label: 'Cash & Forecasting', icon: Coins },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{ padding: '22px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--brand-glow)',
            }}
          >
            <ShieldCheck size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-0.02em', color: '#0F172A' }}>
              FINCTRL <span style={{ color: 'var(--brand-blue)' }}>AI</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Razorpay Track 04 Controller
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '8px 12px', letterSpacing: '0.06em' }}>
          Operations & Control
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: active ? '#EFF6FF' : 'transparent',
                  color: active ? '#1D4ED8' : 'var(--text-secondary)',
                  border: active ? '1px solid #BFDBFE' : '1px solid transparent',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13.5px',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} color={active ? '#2563EB' : '#64748B'} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      background: item.badgeColor === 'bg-red-500' ? '#FEF2F2' : '#FFFBEB',
                      color: item.badgeColor === 'bg-red-500' ? '#DC2626' : '#D97706',
                      border: item.badgeColor === 'bg-red-500' ? '1px solid #FECACA' : '1px solid #FDE68A',
                      fontWeight: 700,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.isAi && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: '#F5F3FF',
                      color: '#7C3AED',
                      border: '1px solid #DDD6FE',
                      fontWeight: 700,
                    }}
                  >
                    AGENT
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', background: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} className="pulse-glow" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>Core Engine Online</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Mode: L1-L4 Deterministic + AI
        </div>
        <div
          style={{
            background: 'linear-gradient(135deg, #0A2540 0%, #1E3A8A 100%)',
            padding: '8px 10px',
            borderRadius: '8px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93C5FD', fontWeight: 700 }}>
              Razorpay Buildathon
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#FFFFFF' }}>
              Track 04: AI Finance Controller
            </div>
          </div>
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '2px 5px', borderRadius: '4px', fontWeight: 700 }}>
            2026
          </span>
        </div>
      </div>
    </aside>
  );
};
