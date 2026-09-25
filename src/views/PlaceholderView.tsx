import React from 'react';
import { useVerification } from '../context/VerificationContext';

const MODULE_DETAILS: Record<string, { title: string; description: string; icon: string }> = {
  'instruments': {
    title: 'Instrument Registry',
    description: 'Manage the metrological instrument registry — register new instruments, view type approval certificates, and track verification history.',
    icon: 'precision_manufacturing',
  },
  'test-sessions': {
    title: 'Test Sessions Register',
    description: 'View and manage all verification test sessions, filter by status, officer, date, and location.',
    icon: 'lab_research',
  },
  'reports': {
    title: 'Reports & Certificates',
    description: 'Generate, download, and manage digital verification certificates and metrological test reports.',
    icon: 'description',
  },
};

interface PlaceholderViewProps {
  moduleKey: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ moduleKey }) => {
  const { setCurrentView } = useVerification();
  const module = MODULE_DETAILS[moduleKey] || {
    title: `${moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)} Module`,
    description: 'This module is available in the full platform deployment.',
    icon: 'pending_actions',
  };

  return (
    <>
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">
                {moduleKey.toUpperCase().replace(/-/g, ' ')}
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">{module.title}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">{module.description}</p>
          </div>
          <button onClick={() => setCurrentView('dashboard')} className="btn-secondary">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Dashboard
          </button>
        </div>
      </section>

      <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-xl flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-20 h-20 rounded-2xl bg-primary-container flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-on-primary text-[40px]">{module.icon}</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-primary font-bold mb-2">{module.title}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">
          {module.description}
        </p>
        <div className="flex items-center gap-space-sm flex-wrap justify-center">
          <button onClick={() => setCurrentView('dashboard')} className="btn-primary">
            <span className="material-symbols-outlined text-[16px]">dashboard</span>
            Return to Dashboard
          </button>
          <button onClick={() => setCurrentView('new-test-session')} className="btn-secondary">
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            New Test Session
          </button>
        </div>
        <div className="mt-8 flex items-center gap-2 text-outline font-label-mono-sm text-label-mono-sm">
          <span className="material-symbols-outlined text-[16px] text-secondary">info</span>
          Full module available in NAWI TRUST Enterprise Edition
        </div>
      </div>
    </>
  );
};
