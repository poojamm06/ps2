import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';

export const AppHeader: React.FC = () => {
  const { currentUser, logout, anomalyAlerts, setCurrentView, currentView, draftSession } = useVerification();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const breadcrumbMap: Record<string, string[]> = {
    'dashboard': ['Legal Metrology', 'Dashboard'],
    'repository': ['Legal Metrology', 'Digital Repository'],
    'instruments': ['Verification Workflow', 'Step 1: Instrument'],
    'test-session': ['Verification Workflow', 'Step 2: Test Session'],
    'new-test-session': ['Verification Workflow', 'Step 2: Test Session'],
    'observations': ['Verification Workflow', 'Step 3: Observations'],
    'data-acquisition': ['Verification Workflow', 'Step 3: Observations'],
    'compliance': ['Verification Workflow', 'Step 4: Compliance Engine'],
    'results': ['Verification Workflow', 'Step 5: Results Summary'],
    'reports': ['Verification Workflow', 'Step 6: Digital Report'],
    'traceability': ['Legal Metrology', 'Audit Trail'],
    'grc': ['Legal Metrology', 'GRC Analytics'],
  };

  const crumbs = breadcrumbMap[currentView] || ['Legal Metrology', currentView];

  return (
    <header className="fixed top-0 left-64 right-0 h-14 bg-surface-container-lowest border-b border-outline-variant/40 z-40 flex items-center justify-between px-space-lg select-none shadow-header">
      {/* Left — Breadcrumb + Session Indicator */}
      <div className="flex items-center gap-space-md">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-outline font-label-mono-sm text-label-mono-sm">
          {crumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-outline-variant">/</span>}
              <span className={idx === crumbs.length - 1 ? 'text-primary font-semibold' : 'text-on-surface-variant'}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="h-4 w-px bg-outline-variant/50"></div>

        {/* Active Session Pill */}
        {(currentView === 'test-session' || currentView === 'new-test-session' || currentView === 'observations' || currentView === 'data-acquisition' || currentView === 'compliance' || currentView === 'results' || currentView === 'reports') && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-primary-container text-on-primary border border-primary font-label-mono-sm text-label-mono-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse"></span>
            <span className="tracking-wide">SESSION: {draftSession.sessionId} [CLASS {draftSession.accuracyClass}]</span>
          </div>
        )}

        {/* ISO Accreditation Badge */}
        <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-mono-sm text-label-mono-sm bg-surface-container text-on-primary-fixed-variant border border-outline-variant/50">
          <span className="material-symbols-outlined text-[13px] text-secondary">military_tech</span>
          ISO/IEC 17025-Aligned Workflow
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-space-md">
        {/* OIML Engine Status */}
        <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/40 font-label-mono-sm text-label-mono-sm">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container ring-2 ring-tertiary-fixed-dim/50"></span>
          <span className="text-on-surface-variant font-medium">Rule Engine:</span>
          <span className="text-on-tertiary-container font-semibold">OIML R-76-BASED</span>
        </div>

        {/* Environmental Telemetry */}
        <div className="hidden lg:flex items-center gap-1 text-on-surface-variant font-label-mono-sm text-label-mono-sm hover:text-on-surface cursor-pointer">
          <span className="material-symbols-outlined text-[16px] text-outline">thermostat</span>
          <span>20.4°C</span>
          <span className="text-outline-variant">|</span>
          <span>1013.2 hPa</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }}
            className="relative p-1.5 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {anomalyAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full ring-2 ring-surface-container-lowest"></span>
            )}
          </button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-surface-container-lowest rounded-xl shadow-card-hover border border-outline-variant/40 z-50">
              <div className="p-space-md border-b border-outline-variant/30 flex items-center justify-between">
                <span className="font-headline-sm text-body-md font-semibold text-primary">Metrological Alerts</span>
                <span className="px-1.5 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm font-bold">
                  {anomalyAlerts.length} Active
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {anomalyAlerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => { setCurrentView('anomaly'); setNotifOpen(false); }}
                    className="p-space-md border-b border-outline-variant/20 cursor-pointer hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        alert.severity === 'Anomaly' ? 'bg-error text-on-error' : 'bg-error-container text-on-error-container'
                      }`}>
                        <span className="material-symbols-outlined text-[13px]">warning</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-body-md text-body-sm font-semibold text-on-surface truncate">{alert.title}</div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">{alert.description}</div>
                        <div className="font-label-mono-sm text-label-mono-sm text-outline mt-1">
                          {alert.sessionId} • {alert.timestamp}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-space-sm text-center border-t border-outline-variant/20">
                <button
                  onClick={() => { setCurrentView('anomaly'); setNotifOpen(false); }}
                  className="font-label-mono-sm text-label-mono-sm text-secondary hover:text-primary font-semibold"
                >
                  View All Anomaly Intelligence →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-outline-variant/50"></div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 pl-1 hover:bg-surface-container rounded-lg px-2 py-1 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="font-body-md font-semibold text-primary leading-tight text-[13px]">
                {currentUser?.name || 'Officer'}
              </div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline flex items-center gap-1">
                <span>{currentUser?.badgeNumber}</span>
                <span className="text-outline-variant">•</span>
                <span>Verification Officer</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
          </button>

          {/* User Dropdown */}
          {userOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-surface-container-lowest rounded-xl shadow-card-hover border border-outline-variant/40 z-50 overflow-hidden">
              <div className="p-space-md border-b border-outline-variant/30">
                <div className="font-body-md font-semibold text-primary">{currentUser?.name}</div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline mt-0.5">{currentUser?.badgeNumber}</div>
                <div className="font-label-mono-sm text-label-mono-sm text-on-surface-variant mt-0.5">{currentUser?.station}</div>
              </div>
              <div className="p-space-xs">
                <div className="flex items-center gap-2 px-3 py-2 rounded text-on-surface-variant font-body-md text-body-md">
                  <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
                  NLMA Compliance Authority
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-error font-body-md text-body-md hover:bg-error-container/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(notifOpen || userOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setUserOpen(false); }} />
      )}
    </header>
  );
};
