import React, { useState, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import { anomalyApi, type AnomalyApiResult } from '../services/api';

export const AnomalyIntelligenceView: React.FC = () => {
  const { setCurrentView, activeBackendSessionId, draftSession, backendConnected } = useVerification();

  const [result, setResult] = useState<AnomalyApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    if (!activeBackendSessionId || !backendConnected) return;
    setLoading(true);
    setError(null);
    try {
      const existing = await anomalyApi.getSessionAnomaly(activeBackendSessionId);
      setResult(existing);
    } catch {
      setResult(null); // Not yet run — that's OK
    } finally {
      setLoading(false);
    }
  }, [activeBackendSessionId, backendConnected]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const handleRunAnalysis = async () => {
    if (!activeBackendSessionId) return;
    setRunning(true);
    setError(null);
    try {
      const freshResult = await anomalyApi.runSessionAnomaly(activeBackendSessionId);
      setResult(freshResult);
    } catch (err: any) {
      setError(err.message || 'Failed to run anomaly analysis.');
    } finally {
      setRunning(false);
    }
  };

  const classificationColor = (cls: string) => {
    if (cls === 'ANOMALY') return 'text-error';
    if (cls === 'ATTENTION') return 'text-error';
    if (cls === 'NORMAL') return 'text-on-tertiary-container';
    return 'text-outline';
  };

  const classificationBg = (cls: string) => {
    if (cls === 'ANOMALY') return 'bg-error text-on-error';
    if (cls === 'ATTENTION') return 'bg-error-container text-on-error-container';
    if (cls === 'NORMAL') return 'bg-tertiary-fixed/40 text-on-tertiary-container';
    return 'bg-surface-container text-outline';
  };

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">ANOMALY INTELLIGENCE MODULE</span>
              {activeBackendSessionId && (
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-mono-sm text-label-mono-sm">
                  Session: {draftSession.sessionId || `ID: ${activeBackendSessionId}`}
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">Metrological Anomaly Intelligence</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Statistical anomaly detection on session measurement data — Z-score and IQR analysis
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button onClick={() => setCurrentView('dashboard')} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Dashboard
            </button>
            <button
              onClick={handleRunAnalysis}
              disabled={running || !activeBackendSessionId || !backendConnected}
              className="btn-primary"
            >
              {running
                ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-[16px]">query_stats</span>
              }
              {running ? 'Analysing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Statutory Separation Notice */}
        <div className="mt-space-md bg-error-container/20 p-space-sm rounded-lg flex items-start gap-2 border border-error/20">
          <span className="material-symbols-outlined text-error text-[18px] flex-shrink-0 mt-0.5">info</span>
          <div className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-primary font-semibold">Anomaly Layer Notice:</strong>{' '}
            This layer detects unusual telemetry patterns and evidence inconsistencies using statistical methods (Z-score, IQR).
            It does <em>not</em> alter or override deterministic OIML R-76 compliance verdicts.
            {result?.is_demo_mode && (
              <span className="ml-1 px-1 py-0.5 rounded bg-error-container text-on-error-container font-semibold">
                DEMO BASELINE MODE — less than 6 readings for full statistical confidence
              </span>
            )}
          </div>
        </div>
      </section>

      {/* No session selected */}
      {!activeBackendSessionId && (
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-outline mb-4">assignment</span>
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold">No Active Session</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            Create or resume a verification session, then return here to run anomaly analysis.
          </p>
          <button onClick={() => setCurrentView('new-test-session')} className="btn-primary mt-4">
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Start New Session
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-xl text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary animate-spin mb-4">progress_activity</span>
          <p className="font-body-md text-body-md text-on-surface-variant">Loading anomaly analysis...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-error-container/30 rounded-xl border border-error/30 p-space-md flex items-center gap-2">
          <span className="material-symbols-outlined text-error">error</span>
          <span className="font-body-md text-body-md text-on-surface">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md">
            {[
              { label: 'Classification', value: result.classification, color: classificationColor(result.classification) },
              { label: 'Anomaly Score', value: `${(result.anomaly_score * 100).toFixed(1)}%`, color: classificationColor(result.classification) },
              { label: 'Flags Detected', value: String(result.flags?.length || 0), color: result.flags?.length > 0 ? 'text-error' : 'text-on-tertiary-container' },
              { label: 'Method', value: result.detection_method, color: 'text-on-surface-variant' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className={`metrology-mono text-xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${classificationBg(result.classification)}`}>
                <span className="material-symbols-outlined text-[24px]">
                  {result.classification === 'ANOMALY' ? 'crisis_alert' : result.classification === 'ATTENTION' ? 'warning' : result.classification === 'NORMAL' ? 'check_circle' : 'pending'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-lg font-label-mono-lg font-bold text-[13px] ${classificationBg(result.classification)}`}>
                    {result.classification}
                  </span>
                  {result.is_demo_mode && (
                    <span className="px-2 py-0.5 rounded bg-surface-container text-outline font-label-mono-sm text-[11px] font-semibold">
                      DEMO BASELINE
                    </span>
                  )}
                </div>
                <p className="font-body-md text-body-md text-on-surface">{result.summary}</p>
                {result.session_code && (
                  <div className="mt-2 font-label-mono-sm text-label-mono-sm text-outline">
                    Session: <span className="metrology-mono text-on-surface">{result.session_code}</span>
                    {result.created_at && (
                      <span className="ml-3">
                        Analysed: {new Date(result.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statistical Flags */}
          {result.flags && result.flags.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
              <div className="flex items-center gap-2 mb-space-md">
                <span className="section-header-bar"></span>
                <div>
                  <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Statistical Flags</div>
                  <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                    {result.flags.length} Anomalous Observation{result.flags.length !== 1 ? 's' : ''} Detected
                  </h3>
                </div>
              </div>
              <div className="space-y-2">
                {result.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 p-space-md rounded-lg bg-error-container/20 border border-error/20">
                    <span className="material-symbols-outlined text-error text-[18px] flex-shrink-0 mt-0.5">warning</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-body-sm font-semibold text-error">{flag.flag}</span>
                        {flag.error_value !== undefined && (
                          <span className="metrology-mono text-[11px] text-outline">
                            Error: {flag.error_value}
                          </span>
                        )}
                        {flag.z_score !== undefined && (
                          <span className="metrology-mono text-[11px] text-outline">
                            Z: {flag.z_score}σ
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-reading breakdown */}
          {result.per_reading && result.per_reading.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
              <div className="flex items-center gap-2 mb-space-md">
                <span className="section-header-bar"></span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Per-Reading Anomaly Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="nawi-table">
                  <thead>
                    <tr>
                      <th>Test Point</th>
                      <th>Reference (kg)</th>
                      <th>Indicated (kg)</th>
                      <th>Error</th>
                      <th>MPE</th>
                      <th>Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.per_reading.map((r, i) => (
                      <tr key={i}>
                        <td><span className="font-body-sm text-body-sm">{r.test_point}</span></td>
                        <td><span className="metrology-mono">{r.reference_value}</span></td>
                        <td><span className="metrology-mono">{r.indicated_value}</span></td>
                        <td><span className={`metrology-mono font-semibold ${Math.abs(r.error) > r.mpe ? 'text-error' : 'text-on-tertiary-container'}`}>{r.error > 0 ? '+' : ''}{r.error}</span></td>
                        <td><span className="metrology-mono text-outline">±{r.mpe}</span></td>
                        <td>
                          {r.compliance_result === 'PASS'
                            ? <span className="badge-pass">PASS</span>
                            : <span className="badge-fail">FAIL</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Advisory Notice */}
          <div className="bg-surface-container p-space-md rounded-lg border border-outline-variant/30">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-outline text-[16px] flex-shrink-0 mt-0.5">info</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{result.advisory_notice}</p>
            </div>
          </div>
        </>
      )}

      {/* Not yet run */}
      {!result && !loading && activeBackendSessionId && (
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-outline mb-4">query_stats</span>
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold">No Analysis Run Yet</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            Add readings to the session, then click "Run Analysis" to perform statistical anomaly detection.
          </p>
          <button
            onClick={handleRunAnalysis}
            disabled={running || !backendConnected}
            className="btn-primary mt-4"
          >
            <span className="material-symbols-outlined text-[16px]">query_stats</span>
            Run Anomaly Analysis
          </button>
        </div>
      )}
    </>
  );
};
