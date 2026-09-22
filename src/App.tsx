import React from 'react';
import { VerificationProvider, useVerification } from './context/VerificationContext';
import { MainShell } from './components/layout/MainShell';
import { LoginPage } from './views/LoginPage';
import { DashboardView } from './views/DashboardView';
import { DigitalRepositoryView } from './views/DigitalRepositoryView';
import { InstrumentView } from './views/InstrumentView';
import { TestSessionView } from './views/TestSessionView';
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
        return <TestSessionView />;
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

export const App: React.FC = () => {
  return (
    <VerificationProvider>
      <AppContent />
    </VerificationProvider>
  );
};

export default App;
