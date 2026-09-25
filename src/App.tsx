import React from 'react';
import { ConfigProvider } from 'antd';
import { VerificationProvider, useVerification } from './context/VerificationContext';
import { MainShell } from './components/layout/MainShell';
import { LoginPage } from './views/LoginPage';
import { DashboardView } from './views/DashboardView';
import { DigitalRepositoryView } from './views/DigitalRepositoryView';
import { InstrumentView } from './views/InstrumentView';
import { NewTestSessionView } from './views/NewTestSessionView';
import { DataAcquisitionView } from './views/DataAcquisitionView';
import { EvidenceCaptureView } from './views/EvidenceCaptureView';
import { ComplianceView } from './views/ComplianceView';
import { FingerprintView } from './views/FingerprintView';
import { SoftwareVerificationView } from './views/SoftwareVerificationView';
import { AnomalyIntelligenceView } from './views/AnomalyIntelligenceView';
import { ResultsView } from './views/ResultsView';
import { DigitalReportView } from './views/DigitalReportView';
import { TraceabilityView } from './views/TraceabilityView';
import { GrcAnalyticsView } from './views/GrcAnalyticsView';
import { PlaceholderView } from './views/PlaceholderView';

const AppContent: React.FC = () => {
  const { isAuthenticated, currentView } = useVerification();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'repository':
        return <DigitalRepositoryView />;
      case 'instruments':
        return <InstrumentView />;
      case 'test-session':
      case 'new-test-session':
        return <NewTestSessionView />;
      case 'observations':
      case 'data-acquisition':
        return <DataAcquisitionView />;
      case 'compliance':
        return <ComplianceView />;
      case 'results':
        return <ResultsView />;
      case 'reports':
        return <DigitalReportView />;
      case 'traceability':
        return <TraceabilityView />;
      case 'grc':
        return <GrcAnalyticsView />;
      case 'evidence':
        return <EvidenceCaptureView />;
      case 'fingerprint':
        return <FingerprintView />;
      case 'software':
        return <SoftwareVerificationView />;
      case 'anomaly':
        return <AnomalyIntelligenceView />;
      default:
        return <PlaceholderView moduleKey={currentView} />;
    }
  };

  return (
    <MainShell>
      {renderActiveView()}
    </MainShell>
  );
};

// Shared Ant Design theme — DigiLocker-inspired indigo/violet system.
// Every restyled Ant component (buttons, inputs, modals, tables, tabs,
// tags, etc.) consumes these tokens so it matches the Tailwind palette.
const antdTheme = {
  token: {
    colorPrimary: '#4A3AFF',
    colorLink: '#4A3AFF',
    colorLinkHover: '#3D2FE0',
    colorSuccess: '#16A34A',
    colorWarning: '#F59E0B',
    colorError: '#DC2626',
    colorInfo: '#7C3AED',
    colorTextBase: '#1A1A2E',
    colorTextSecondary: '#5A5A72',
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#F6F5FF',
    colorBorder: '#E7E4F7',
    colorBorderSecondary: '#F0EEFF',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    controlHeight: 38,
    boxShadow: '0 2px 10px rgba(74,58,255,0.07)',
    boxShadowSecondary: '0 10px 28px rgba(74,58,255,0.16)',
  },
  components: {
    Button: {
      borderRadius: 999,
      controlHeight: 40,
      fontWeight: 600,
      primaryShadow: 'none',
    },
    Input: { borderRadius: 12, controlHeight: 40 },
    Select: { borderRadius: 12, controlHeight: 40 },
    Modal: { borderRadiusLG: 20 },
    Card: { borderRadiusLG: 16 },
    Tag: { borderRadiusSM: 999 },
    Table: { borderRadiusLG: 16, headerBg: '#F4F2FF' },
  },
};

export const App: React.FC = () => {
  return (
    <ConfigProvider theme={antdTheme}>
      <VerificationProvider>
        <AppContent />
      </VerificationProvider>
    </ConfigProvider>
  );
};

export default App;
