import React from 'react';
import { useVerification } from '../../context/VerificationContext';
import type { NavigationKey } from '../../context/VerificationContext';

interface NavItem {
  key: NavigationKey;
  icon: string;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const AppSidebar: React.FC = () => {
  const { currentView, setCurrentView, dashboardKPIs } = useVerification();

  const navGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        { key: 'dashboard', icon: 'space_dashboard', label: 'Dashboard' },
        { key: 'repository', icon: 'folder_open', label: 'Digital Repository' },
      ],
    },
    {
      title: 'Verification Workflow',
      items: [
        { key: 'instruments', icon: 'scale', label: 'Instruments' },
        { key: 'test-session', icon: 'assignment_add', label: 'Test Session' },
        { key: 'observations', icon: 'sensors', label: 'Observations' },
        { key: 'evidence', icon: 'photo_camera', label: 'Evidence' },
        { key: 'compliance', icon: 'fact_check', label: 'Compliance' },
        { key: 'results', icon: 'checklist', label: 'Results' },
        { key: 'reports', icon: 'description', label: 'Report' },
      ],
    },
    {
      title: 'Trust Verification',
      items: [
        { key: 'fingerprint', icon: 'fingerprint', label: 'Fingerprint ID' },
        { key: 'software', icon: 'security', label: 'Software Exam' },
        { key: 'anomaly', icon: 'insights', label: 'Anomaly Intel' },
      ],
    },
    {
      title: 'Records',
      items: [
        { key: 'traceability', icon: 'history', label: 'Audit Trail' },
        { key: 'grc', icon: 'analytics', label: 'GRC Analytics' },
      ],
    },
  ];

  const getActiveKey = (): NavigationKey => {
    if (currentView === 'new-test-session' || currentView === 'test-sessions') return 'test-session';
    if (currentView === 'data-acquisition') return 'observations';
    return currentView;
  };

  const activeKey = getActiveKey();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-outline-variant/60 z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-space-lg flex items-center gap-2.5 border-b border-outline-variant/60">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">scale</span>
          </div>
          <div className="min-w-0">
            <div className="font-headline-sm text-headline-sm text-on-surface leading-none tracking-tight font-bold">NAWI Trust</div>
            <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">OIML R-76 Platform</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-space-md px-space-sm">
          <nav className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-0.5">
                <div className="px-3 py-1 font-label-mono-sm text-label-mono-sm font-semibold text-outline uppercase tracking-wider">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const isActive = activeKey === item.key;
                  return (
                    <a
                      key={item.key}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setCurrentView(item.key); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-full transition-all group ${
                        isActive
                          ? 'bg-[#EEEBFF] text-primary font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[19px] ${
                        isActive ? 'text-primary' : 'text-outline group-hover:text-primary'
                      }`}>
                        {item.icon}
                      </span>
                      <span className="font-body-md text-body-md flex-1">{item.label}</span>

                      {item.key === 'compliance' && dashboardKPIs.pendingReviewsCount > 0 && !isActive && (
                        <span className="w-5 h-5 rounded-full bg-[#FEE2E2] text-error text-[10px] flex items-center justify-center font-bold">
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

      {/* Footer */}
      <div className="p-space-md border-t border-outline-variant/60">
        <div className="bg-surface-container-low rounded-2xl p-space-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
            <span className="font-body-sm text-body-sm font-semibold text-on-surface">OIML R 76-1:2006</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Deterministic compliance engine, ISO 17025-aligned.
          </p>
        </div>
      </div>
    </aside>
  );
};
