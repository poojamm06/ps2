import React from 'react';
import { useVerification } from '../../context/VerificationContext';
import type { NavigationKey } from '../../context/VerificationContext';

interface NavItem {
  key: NavigationKey;
  icon: string;
  label: string;
  badge?: string | number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const AppSidebar: React.FC = () => {
  const { currentView, setCurrentView, dashboardKPIs, databaseConnected } = useVerification();

  const navGroups: NavGroup[] = [
    {
      title: 'Repository & Overview',
      items: [
        { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
        { key: 'repository', icon: 'inventory_2', label: 'Digital Repository' },
      ],
    },
    {
      title: 'Phase-1 Core Workflow',
      items: [
        { key: 'instruments', icon: 'scale', label: '1. Instrument', badge: 'STEP 1' },
        { key: 'test-session', icon: 'badge', label: '2. Test Session', badge: 'STEP 2' },
        { key: 'observations', icon: 'sensors', label: '3. Observations', badge: 'STEP 3' },
        { key: 'compliance', icon: 'verified', label: '4. Compliance', badge: 'STEP 4' },
        { key: 'results', icon: 'fact_check', label: '5. Results', badge: 'STEP 5' },
        { key: 'reports', icon: 'description', label: '6. Report', badge: 'STEP 6' },
      ],
    },
    {
      title: 'Audit & Records',
      items: [
        { key: 'traceability', icon: 'linear_scale', label: 'Audit Trail' },
      ],
    },
  ];

  const getActiveKey = (): NavigationKey => {
    if (currentView === 'new-test-session' || currentView === 'test-sessions') return 'test-session';
    if (currentView === 'data-acquisition') return 'observations';
    return currentView;
  };

  const activeKey = getActiveKey();

  const handleNav = (key: NavigationKey) => {
    setCurrentView(key);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-outline-variant/40 z-50 flex flex-col justify-between select-none shadow-surface">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="p-space-md border-b border-outline-variant/30">
          <div className="flex items-center justify-between gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <div className="w-7 h-7 rounded-lg bg-primary-container flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-[18px]">scale</span>
              </div>
              <div>
                <div className="font-headline-sm text-headline-sm text-primary leading-none tracking-tight font-bold">NAWI TRUST</div>
                <div className="font-label-mono-sm text-label-mono-sm text-on-surface-variant font-medium tracking-wide uppercase mt-0.5">Metrological Platform</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-label-mono-sm font-semibold bg-surface-container-high text-secondary border border-secondary-fixed-dim/60 uppercase">
              OIML R-76
            </span>
          </div>

          {/* Station Indicator */}
          <div className="mt-space-sm py-1 px-2 rounded bg-surface-container-low border border-outline-variant/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${databaseConnected ? 'bg-on-tertiary-container ring-2 ring-tertiary-fixed-dim/40' : 'bg-secondary'}`}></span>
              <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant font-medium">STATION: LAB-DE-04</span>
            </div>
            <span className="font-label-mono-sm text-label-mono-sm text-secondary font-bold">e=0.1g</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-space-sm px-space-xs">
          <nav className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-3 py-1 font-label-mono-sm text-label-mono-sm font-semibold text-outline uppercase tracking-wider">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const isActive = activeKey === item.key;
                  return (
                    <a
                      key={item.key}
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleNav(item.key); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group ${
                        isActive
                          ? 'bg-primary-container text-on-primary shadow-sm border-l-[3px] border-secondary-container font-medium'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${
                        isActive ? 'text-on-primary-container' : 'text-outline group-hover:text-secondary'
                      }`}>
                        {item.icon}
                      </span>
                      <span className="font-body-md text-body-md flex-1">{item.label}</span>

                      {/* Badges */}
                      {item.key === 'new-test-session' && (
                        <span className="font-label-mono-sm text-label-mono-sm px-1.5 py-0.5 bg-secondary-fixed text-on-secondary-fixed rounded text-[9px] font-bold">
                          LIVE
                        </span>
                      )}
                      {item.key === 'compliance' && dashboardKPIs.pendingReviewsCount > 0 && !isActive && (
                        <span className="w-4 h-4 rounded-full bg-error-container text-on-error-container text-[9px] flex items-center justify-center font-bold">
                          {dashboardKPIs.pendingReviewsCount}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Truthful Metrological Engine Footer */}
      <div className="p-space-md border-t border-outline-variant/30 bg-surface-container-low">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase tracking-wider font-semibold">Rule Architecture</span>
          <span className="font-label-mono-sm text-label-mono-sm text-secondary font-bold">OIML R 76-1:2006</span>
        </div>
        <div className="w-full bg-surface-container h-1 rounded overflow-hidden mb-2">
          <div className="bg-secondary h-full" style={{ width: '100%' }}></div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-label-mono-sm text-outline">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-secondary">database</span>
            PostgreSQL DB
          </span>
          <span>ISO 17025-Aligned</span>
        </div>
      </div>
    </aside>
  );
};
