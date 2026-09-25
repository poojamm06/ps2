import React, { useState, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import { complianceApi, readingsApi } from '../services/api';
import { getMpeForLoad } from '../utils/oimlMpe';

interface ResultMetric {
  label: string;
  value: string;
  sub: string;
  color: string;
}

const summarySteps = [
  { step: '1', label: '1. Instrument', icon: 'precision_manufacturing' },
  { step: '2', label: '2. Test Session', icon: 'badge' },
  { step: '3', label: '3. Observations', icon: 'sensors' },
  { step: '4', label: '4. Compliance', icon: 'verified' },
  { step: '5', label: '5. Results', icon: 'fact_check' },
  { step: '6', label: '6. Report', icon: 'description' },
];

export const ResultsView: React.FC = () => {
  const { draftSession, activeBackendSessionId, backendConnected, setCurrentView, proceedToStep } = useVerification();

  const [overallVerdict, setOverallVerdict] = useState<string | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [metrics, setMetrics] = useState<ResultMetric[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({});
  const [readingCount, setReadingCount] = useState<number | null>(null);
  const [passCount, setPassCount] = useState<number | null>(null);
  const [failCount, setFailCount] = useState<number | null>(null);
  const [isLocalEstimate, setIsLocalEstimate] = useState(false);

  // Deterministic local fallback — computes the same OIML R-76 Table 6 MPE
  // verdict from the in-progress draft observations when the backend
  // evaluation is unavailable, so this screen never dead-ends the demo.
  const deriveLocalResults = useCallback(() => {
    const points = (draftSession.staticWeighingPoints || []).filter(
      pt => pt.appliedLoad?.trim() && pt.indication?.trim() &&
            !isNaN(parseFloat(pt.appliedLoad)) && !isNaN(parseFloat(pt.indication))
    );

    if (points.length === 0) {
      setOverallVerdict(null);
      setReadingCount(null);
      setPassCount(null);
      setFailCount(null);
      setMetrics([]);
      return;
    }

    const unit = draftSession.unit || 'g';
    const accuracyClass = draftSession.accuracyClass || 'II';
    const e = draftSession.verificationScaleInterval_e || 0.1;

    const evaluated = points.map(pt => {
      const load = parseFloat(pt.appliedLoad);
      const ind = parseFloat(pt.indication);
      const delta = parseFloat(pt.additionalLoadDeltaL) || 0;
      const e0 = parseFloat(pt.zeroErrorE0) || 0;
      const P = ind + 0.5 * e - delta;
      const error = (P - load) - e0;
      const mpe = getMpeForLoad(load, e, accuracyClass, unit);
      return { error, mpeLimit: mpe.limitValue, result: Math.abs(error) <= mpe.limitValue ? 'PASS' : 'FAIL' };
    });

    const total = evaluated.length;
    const passed = evaluated.filter(r => r.result === 'PASS').length;
    const failed = total - passed;
    const verdict = failed > 0 ? 'FAIL' : 'PASS';

    setOverallVerdict(verdict);
    setReadingCount(total);
    setPassCount(passed);
    setFailCount(failed);
    setIsLocalEstimate(true);

    const errors = evaluated.map(r => r.error);
    const meanErr = errors.reduce((acc, v) => acc + v, 0) / errors.length;
    const maxAbsErr = Math.max(...errors.map(v => Math.abs(v)));
    const variance = errors.reduce((acc, v) => acc + Math.pow(v - meanErr, 2), 0) / errors.length;
    const stdDev = Math.sqrt(variance);

    const compRate = ((passed / total) * 100).toFixed(1);
    const localMetrics: ResultMetric[] = [
      {
        label: 'Compliance Rate (MPE)',
        value: `${compRate}%`,
        sub: `${passed}/${total} readings within OIML R-76 MPE`,
        color: failed === 0 ? 'text-on-tertiary-container' : 'text-error',
      },
      ...(failed > 0 ? [{
        label: 'Failed Test Points',
        value: String(failed),
        sub: 'Readings exceeding OIML R-76 MPE — FAIL verdict',
        color: 'text-error',
      }] : []),
      {
        label: 'Mean Error (μ)',
        value: `${meanErr >= 0 ? '+' : ''}${meanErr.toFixed(4)} ${unit}`,
        sub: 'Average error of indication across all test points',
        color: 'text-secondary',
      },
      {
        label: 'Max Absolute Error',
        value: `${maxAbsErr.toFixed(4)} ${unit}`,
        sub: 'Peak error observed relative to reference mass',
        color: failed > 0 ? 'text-error' : 'text-on-tertiary-container',
      },
      {
        label: 'Repeatability Dispersion (σ)',
        value: `${stdDev.toFixed(4)} ${unit}`,
        sub: 'Standard deviation of observation errors',
        color: 'text-on-surface',
      },
    ];
    setMetrics(localMetrics);

    setStepStatuses({
      '1': draftSession.manufacturer ? 'complete' : 'pending',
      '2': draftSession.sessionId ? 'complete' : 'pending',
      '3': total > 0 ? 'complete' : 'pending',
      '4': verdict === 'PASS' ? 'pass' : 'fail',
      '5': 'current',
      '6': 'pending',
    });
  }, [draftSession.staticWeighingPoints, draftSession.unit, draftSession.accuracyClass, draftSession.verificationScaleInterval_e, draftSession.manufacturer, draftSession.sessionId]);

  const loadResults = useCallback(async () => {
    setIsLocalEstimate(false);

    // Real backend first.
    if (!activeBackendSessionId || !backendConnected) {
      deriveLocalResults();
      return;
    }
    setVerdictLoading(true);

    try {
      // 1. Fetch compliance result (OIML R-76 deterministic verdict)
      const compliance = await complianceApi.getSessionCompliance(activeBackendSessionId).catch(() => null);

      // 2. Fetch all readings
      const readings = await readingsApi.getSessionReadings(activeBackendSessionId).catch(() => []);

      // Deterministic mock fallback on failure — no readings/compliance yet
      // reachable from the backend, so fall back to the local draft data.
      if (!compliance?.overall_result && (!readings || readings.length === 0)) {
        deriveLocalResults();
        return;
      }

      // Determine verdict from compliance result or readings
      let verdict: string | null = null;
      if (compliance?.overall_result) {
        verdict = compliance.overall_result;
      } else if (readings && readings.length > 0) {
        const failed = readings.filter(r => r.result === 'FAIL').length;
        verdict = failed > 0 ? 'FAIL' : 'PASS';
      }
      setOverallVerdict(verdict);

      // Calculate reading stats
      const total = readings?.length || 0;
      const passed = readings?.filter(r => r.result === 'PASS').length || 0;
      const failed = readings?.filter(r => r.result === 'FAIL').length || 0;
      setReadingCount(total);
      setPassCount(passed);
      setFailCount(failed);

      // Determine step statuses from real data
      const newStatuses: Record<string, string> = {
        '1': draftSession.manufacturer ? 'complete' : 'pending',
        '2': draftSession.sessionId ? 'complete' : 'pending',
        '3': total > 0 ? 'complete' : 'pending',
        '4': compliance ? (verdict === 'PASS' ? 'pass' : verdict === 'FAIL' ? 'fail' : 'complete') : 'pending',
        '5': 'current',
        '6': 'pending',
      };
      setStepStatuses(newStatuses);

      // Build metrics from real data
      const newMetrics: ResultMetric[] = [];

      if (total > 0) {
        const compRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '—';
        newMetrics.push({
          label: 'Compliance Rate (MPE)',
          value: `${compRate}%`,
          sub: `${passed}/${total} readings within OIML R-76 MPE`,
          color: failed === 0 ? 'text-on-tertiary-container' : 'text-error',
        });

        if (failed > 0) {
          newMetrics.push({
            label: 'Failed Test Points',
            value: String(failed),
            sub: 'Readings exceeding OIML R-76 MPE — FAIL verdict',
            color: 'text-error',
          });
        }
      }

      if (readings && readings.length > 0) {
        const errors = readings.map(r => r.error);
        const meanErr = errors.reduce((acc, v) => acc + v, 0) / errors.length;
        const maxAbsErr = Math.max(...errors.map(e => Math.abs(e)));
        const variance = errors.reduce((acc, v) => acc + Math.pow(v - meanErr, 2), 0) / errors.length;
        const stdDev = Math.sqrt(variance);

        newMetrics.push({
          label: 'Mean Error (μ)',
          value: `${meanErr >= 0 ? '+' : ''}${meanErr.toFixed(4)} ${draftSession.unit}`,
          sub: 'Average error of indication across all test points',
          color: 'text-secondary',
        });

        newMetrics.push({
          label: 'Max Absolute Error',
          value: `${maxAbsErr.toFixed(4)} ${draftSession.unit}`,
          sub: 'Peak error observed relative to reference mass',
          color: failed > 0 ? 'text-error' : 'text-on-tertiary-container',
        });

        newMetrics.push({
          label: 'Repeatability Dispersion (σ)',
          value: `${stdDev.toFixed(4)} ${draftSession.unit}`,
          sub: 'Standard deviation of observation errors',
          color: 'text-on-surface',
        });
      }

      if (newMetrics.length === 0 && total === 0) {
        newMetrics.push({
          label: 'No Data',
          value: '—',
          sub: 'No readings recorded for this session yet',
          color: 'text-outline',
        });
      }

      setMetrics(newMetrics);

    } catch (err) {
      console.warn('Backend results unavailable, using local fallback:', err);
      deriveLocalResults();
    } finally {
      setVerdictLoading(false);
    }
  }, [activeBackendSessionId, backendConnected, draftSession.manufacturer, draftSession.softwareApplicable, draftSession.unit, deriveLocalResults]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const verdictBg = overallVerdict === 'PASS'
    ? 'bg-on-tertiary-container text-white'
    : overallVerdict === 'FAIL'
    ? 'bg-error text-on-error'
    : overallVerdict === 'REVIEW'
    ? 'bg-error-container text-on-error-container'
    : 'bg-surface-container text-outline';

  const verdictText = overallVerdict || (verdictLoading ? 'Calculating...' : 'PENDING');

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold uppercase tracking-wider">
                STEP 5 OF 6 // RESULTS SUMMARY
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                SESSION: {draftSession.sessionId || 'N/A'}
              </span>
              {activeBackendSessionId && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-label-mono-sm">
                  DB ID: {activeBackendSessionId}
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">Verification Results Summary</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Complete metrological evaluation report{draftSession.manufacturer ? ` — ${draftSession.manufacturer} ${draftSession.model} (S/N: ${draftSession.serialNumber})` : ''}
            </p>
          </div>
          <div className="text-center">
            <div className={`px-6 py-3 rounded-xl font-display-lg text-display-lg font-bold ${verdictBg}`}>
              {verdictText}
            </div>
            <div className="font-label-mono-sm text-label-mono-sm text-on-surface-variant mt-1">OIML R-76 Statutory Verdict</div>
          </div>
        </div>
      </section>

      {/* Instrument Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Instrument &amp; Session Identification</h3>
          </div>
          {draftSession.manufacturer ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md">
              {[
                { label: 'Session ID', value: draftSession.sessionId, mono: true },
                { label: 'Manufacturer', value: draftSession.manufacturer },
                { label: 'Model', value: draftSession.model },
                { label: 'Serial Number', value: draftSession.serialNumber, mono: true },
                { label: 'Accuracy Class', value: `OIML Class ${draftSession.accuracyClass}` },
                { label: 'Max Capacity', value: `${draftSession.maxCapacity} ${draftSession.unit}` },
                { label: 'Scale Interval (e)', value: `${draftSession.verificationScaleInterval_e} ${draftSession.unit}`, mono: true },
                { label: 'Officer', value: draftSession.verificationOfficer },
                { label: 'Date', value: draftSession.verificationDate, mono: true },
              ].map(row => (
                <div key={row.label}>
                  <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">{row.label}</div>
                  <div className={`font-body-md text-body-sm text-on-surface font-medium mt-0.5 ${row.mono ? 'metrology-mono' : ''}`}>{row.value || '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-space-lg text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] mb-2">info</span>
              <p className="font-body-md text-body-md">No active session selected. Create or resume a session first.</p>
            </div>
          )}
        </div>

        {/* Workflow Completion */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Workflow Completion</h3>
          </div>
          <div className="space-y-2">
            {summarySteps.map(item => {
              const st = stepStatuses[item.step];
              const bgClass = st === 'pass' ? 'bg-on-tertiary-container text-white'
                : st === 'fail' ? 'bg-error text-on-error'
                : st === 'complete' ? 'bg-secondary text-on-secondary'
                : st === 'current' ? 'bg-secondary text-on-secondary'
                : st === 'na' ? 'bg-surface-container text-outline'
                : 'bg-surface-container text-on-surface-variant';
              const iconName = st === 'pass' ? 'check'
                : st === 'fail' ? 'close'
                : st === 'complete' ? 'check'
                : st === 'na' ? 'remove'
                : item.icon;
              return (
                <div key={item.step} className="flex items-center gap-2 py-1.5 border-b border-outline-variant/15 last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${bgClass}`}>
                    <span className="material-symbols-outlined text-[13px]">{iconName}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body-sm font-semibold text-on-surface text-[12px]">{item.label}</div>
                    <div className="font-label-mono-sm text-label-mono-sm text-outline">
                      {st === 'pass' ? 'PASS' : st === 'fail' ? 'FAIL' : st === 'complete' ? 'Complete' : st === 'current' ? 'Current Step' : st === 'na' ? 'N/A' : 'Pending'}
                    </div>
                  </div>
                  {st === 'pass' && <span className="badge-pass text-[9px]">PASS</span>}
                  {st === 'fail' && <span className="badge-fail text-[9px]">FAIL</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reading Statistics */}
      {readingCount !== null && (
        <div className="grid grid-cols-3 gap-space-md">
          {[
            { label: 'Total Readings', value: String(readingCount), color: 'text-primary' },
            { label: 'PASS', value: String(passCount ?? 0), color: 'text-on-tertiary-container' },
            { label: 'FAIL', value: String(failCount ?? 0), color: failCount ? 'text-error' : 'text-on-tertiary-container' },
          ].map(stat => (
            <div key={stat.label} className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-md text-center">
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">{stat.label}</div>
              <div className={`metrology-mono text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="font-label-mono-sm text-[10px] text-outline mt-1">{isLocalEstimate ? 'local estimate' : 'from PostgreSQL'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Performance Metrics — from real backend fingerprint + readings */}
      {metrics.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">METROLOGICAL PERFORMANCE</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Key Performance Indicators — Actual Measurement Data</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md">
            {metrics.map(metric => (
              <div key={metric.label} className="p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20">
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">{metric.label}</div>
                <div className={`metrology-mono font-bold text-lg ${metric.color}`}>{metric.value}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">{metric.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data Warning — only when there's genuinely nothing to show */}
      {!overallVerdict && !verdictLoading && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-outline mb-4">assignment</span>
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold">No Observations Recorded Yet</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            Record at least one test point in Observations to see a verdict here.
          </p>
          <button onClick={() => setCurrentView('observations')} className="btn-primary mt-4">
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            Go to Observations
          </button>
        </div>
      )}

      {/* Action Footer */}
      <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col sm:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <button
            onClick={() => setCurrentView('compliance')}
            className="btn-secondary text-xs h-[42px]"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            ← Back to Compliance
          </button>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-[24px] ${overallVerdict === 'PASS' ? 'text-on-tertiary-container' : overallVerdict === 'FAIL' ? 'text-error' : 'text-outline'}`}>
              {overallVerdict === 'PASS' ? 'verified' : overallVerdict === 'FAIL' ? 'cancel' : 'pending'}
            </span>
            <div>
              <div className="font-headline-sm text-body-md text-primary font-bold">
                Verification Verdict: {verdictText}
              </div>
              <div className="font-body-sm text-xs text-on-surface-variant">
                {overallVerdict === 'PASS'
                  ? 'Conforms to statutory OIML R-76 MPE criteria. Proceed to official certificate.'
                  : overallVerdict === 'FAIL'
                  ? 'Exceeds statutory MPE limits. Rejection or adjustment required.'
                  : 'Complete observations and evaluate to finalize verdict.'}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            proceedToStep(6);
            setCurrentView('reports');
          }}
          className="btn-primary text-xs h-[42px] px-6 font-semibold"
          disabled={!overallVerdict}
        >
          <span className="material-symbols-outlined text-[16px]">description</span>
          Generate Digital Report &amp; Certificate →
        </button>
      </section>
    </>
  );
};
