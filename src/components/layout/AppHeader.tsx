import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';

export const AppHeader: React.FC = () => {
  const { 
    currentUser, 
    logout, 
    anomalyAlerts, 
    setCurrentView, 
    currentView, 
    draftSession, 
    backendConnected, 
    databaseConnected,
    switchRole,
  } = useVerification();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const pageTitleMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'repository': 'Digital Repository',
    'instruments': 'Instrument Registry',
    'test-session': 'Test Session',
    'new-test-session': 'Verification Wizard',
    'observations': 'Observations',
    'data-acquisition': 'Data Acquisition',
    'compliance': 'Compliance Engine',
    'results': 'Results Summary',
    'reports': 'Digital Report',
    'traceability': 'Audit Trail',
    'grc': 'GRC Analytics',
    'evidence': 'Evidence Capture',
    'fingerprint': 'Metrological Fingerprint',
    'software': 'Software Verification',
    'anomaly': 'Anomaly Intelligence',
  };

  const firstName = (currentUser?.name || 'Officer').split(' ').slice(-1)[0];

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant/60 z-40 flex items-center justify-between px-space-lg select-none shadow-header">
      {/* Left — Page context */}
      <div className="flex items-center gap-space-md min-w-0">
        <div className="min-w-0">
          <div className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
            {pageTitleMap[currentView] || 'NAWI Trust'}
          </div>
          <div className="font-body-sm text-body-sm text-on-surface-variant">
            Hi {firstName}, welcome back!
          </div>
        </div>

        {/* Active Session Pill */}
        {(currentView === 'test-session' || currentView === 'new-test-session' || currentView === 'observations' || currentView === 'data-acquisition' || currentView === 'compliance' || currentView === 'results' || currentView === 'reports') && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-primary font-label-mono-sm text-label-mono-sm font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="tracking-wide">{draftSession.sessionId} · Class {draftSession.accuracyClass}</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-space-sm">
        {/* Backend / DB status — soft pills */}
        <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-mono-sm text-label-mono-sm font-semibold ${
          databaseConnected ? 'bg-[#DCFCE7] text-[#15803D]' : backendConnected ? 'bg-[#EEEBFF] text-primary' : 'bg-surface-container text-on-surface-variant'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${databaseConnected ? 'bg-[#16A34A] animate-pulse' : backendConnected ? 'bg-primary' : 'bg-outline'}`}></span>
          {databaseConnected ? 'Database Connected' : backendConnected ? 'API Connected' : 'Demo Mode'}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }}
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {anomalyAlerts.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-surface-container-lowest"></span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest rounded-2xl shadow-card-hover border border-outline-variant/50 z-50 overflow-hidden">
              <div className="p-space-md border-b border-outline-variant/40 flex items-center justify-between">
                <span className="font-headline-sm text-body-md font-bold text-on-surface">Alerts</span>
                <span className="px-2 py-0.5 rounded-full bg-[#EEEBFF] text-primary font-label-mono-sm text-label-mono-sm font-bold">
                  {anomalyAlerts.length} active
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {anomalyAlerts.length > 0 ? (
                  anomalyAlerts.map(alert => (
                    <div
                      key={alert.id}
                      onClick={() => { setCurrentView('anomaly'); setNotifOpen(false); }}
                      className="doc-row rounded-none border-b border-outline-variant/30 last:border-b-0"
                    >
                      <div className={`doc-row-icon ${alert.severity === 'Anomaly' ? 'bg-[#FEE2E2] text-error' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
                        <span className="material-symbols-outlined text-[18px]">warning</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-body-md text-body-sm font-semibold text-on-surface truncate">{alert.title}</div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">{alert.description}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-space-md text-center font-body-sm text-body-sm text-on-surface-variant">
                    No active anomaly alerts
                  </div>
                )}
              </div>
              <div className="p-space-sm text-center border-t border-outline-variant/30">
                <button
                  onClick={() => { setCurrentView('anomaly'); setNotifOpen(false); }}
                  className="section-heading-link text-[13px]"
                >
                  View all anomaly intelligence →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 pl-1 hover:bg-surface-container rounded-full px-1.5 py-1 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{(currentUser?.name || 'O').charAt(0)}</span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="font-body-md font-semibold text-on-surface leading-tight text-[13px]">
                {currentUser?.name || 'Officer'}
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">
                {currentUser?.role || 'Verification Officer'}
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-2xl shadow-card-hover border border-outline-variant/50 z-50 overflow-hidden">
              <div className="p-space-md border-b border-outline-variant/40">
                <div className="font-body-md font-semibold text-on-surface">{currentUser?.name}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{currentUser?.badgeNumber}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{currentUser?.station}</div>
              </div>
              <div className="p-space-xs border-b border-outline-variant/30">
                <div className="px-3 pt-1 pb-0.5 font-label-mono-sm text-[10px] text-outline uppercase font-bold">
                  Inspector Role (RBAC)
                </div>
                <div className="px-2 py-1">
                  <select
                    value={currentUser?.role || 'Legal Metrology Officer'}
                    onChange={(e) => switchRole(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg bg-surface-container border border-outline-variant/40 px-2 py-1.5 text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Legal Metrology Officer">Legal Metrology Officer</option>
                    <option value="Senior Metrologist">Senior Metrologist</option>
                    <option value="Technical Auditor">Technical Auditor</option>
                  </select>
                </div>
              </div>
              <div className="p-space-xs">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-on-surface-variant font-body-sm text-[12px]">
                  <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
                  NLMA Compliance Authority
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-error font-body-md text-body-md hover:bg-[#FEE2E2] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(notifOpen || userOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setUserOpen(false); }} />
      )}
    </header>
  );
};
