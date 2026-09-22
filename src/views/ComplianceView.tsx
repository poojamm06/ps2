import React, { useState, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import { complianceApi, readingsApi, type ApiComplianceCalculationResponse } from '../services/api';
import type { ComplianceTestRow } from '../types';

const defaultComplianceTests: ComplianceTestRow[] = [
  { id: 'ct_01', testType: 'Initial Zero-Setting', appliedLoad: 0.0000, indicatedValue: 0.0000, referenceValue: 0.0000, error: 0.0000, applicableMPE: 0.0010, result: 'PASS' },
  { id: 'ct_02', testType: 'Weighing Performance', appliedLoad: 50.0000, indicatedValue: 50.0002, referenceValue: 50.0000, error: 0.0002, applicableMPE: 0.0010, result: 'PASS' },
  { id: 'ct_03', testType: 'Weighing Performance', appliedLoad: 100.0000, indicatedValue: 99.9998, referenceValue: 100.0000, error: -0.0002, applicableMPE: 0.0010, result: 'PASS' },
  { id: 'ct_04', testType: 'Weighing Performance', appliedLoad: 200.0000, indicatedValue: 200.0005, referenceValue: 200.0000, error: 0.0005, applicableMPE: 0.0020, result: 'PASS' },
  { id: 'ct_05', testType: 'Tare Test', appliedLoad: 100.0000, indicatedValue: 99.9997, referenceValue: 100.0000, error: -0.0003, applicableMPE: 0.0010, result: 'PASS' },
  { id: 'ct_06', testType: 'Eccentricity', appliedLoad: 70.0000, indicatedValue: 70.0004, referenceValue: 70.0000, error: 0.0004, applicableMPE: 0.0010, result: 'PASS' },
  { id: 'ct_07', testType: 'Repeatability', appliedLoad: 100.0000, indicatedValue: 100.0008, referenceValue: 100.0000, error: 0.0008, applicableMPE: 0.0010, result: 'PASS' },
];

const TEST_TYPE_OPTIONS = [
  { value: 'weighing_performance', label: 'Weighing Performance (Error of Indication — Clause 3.5.1)' },
  { value: 'eccentricity', label: 'Eccentricity Loading (Clause 3.6.2)' },
  { value: 'repeatability', label: 'Repeatability Test (Clause 3.6.1)' },
  { value: 'tare_test', label: 'Tare Setting & Net Weighing (Clause 3.5.3.4)' },
  { value: 'zero_setting', label: 'Zero-Setting Accuracy (Clause 4.5.2)' },
];

const getOimlClause = (testType: string): string => {
  switch (testType) {
    case 'Weighing Performance': return 'OIML R-76 cl. 3.5.1';
    case 'Eccentricity': return 'OIML R-76 cl. 3.6.2';
    case 'Repeatability': return 'OIML R-76 cl. 3.6.1';
    case 'Tare Test': return 'OIML R-76 cl. 3.5.3.4';
    case 'Initial Zero-Setting': return 'OIML R-76 cl. 4.5.2';
    default: return 'OIML R-76 cl. 3.5';
  }
};

const VerdictBadge: React.FC<{ result: string }> = ({ result }) => {
  if (result === 'PASS') return <span className="badge-pass">PASS</span>;
  if (result === 'FAIL') return <span className="badge-fail">FAIL</span>;
  if (result === 'REVIEW') return <span className="badge-review">REVIEW</span>;
  if (result === 'NOT_IMPLEMENTED') {
    return <span className="px-2 py-0.5 rounded bg-surface-container-high text-outline font-label-mono-sm text-[11px] font-bold">NOT IMPLEMENTED</span>;
  }
  if (result === 'INVALID') {
    return <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-mono-sm text-[11px] font-bold">INVALID INPUT</span>;
  }
  return <span className="badge-review">{result}</span>;
};

export const ComplianceView: React.FC = () => {
  const { draftSession, activeBackendSessionId, backendConnected, databaseConnected, setCurrentView } = useVerification();
  const [tests, setTests] = useState<ComplianceTestRow[]>(defaultComplianceTests);
  const [overallVerdict, setOverallVerdict] = useState<string>('PASS');
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [calcFeedback, setCalcFeedback] = useState<string | null>(null);

  // Single test calculation interactive tester
  const [selectedTestType, setSelectedTestType] = useState<string>('weighing_performance');
  const [calcRef, setCalcRef] = useState<string>('500.0');
  const [calcInd, setCalcInd] = useState<string>('500.2');
  const [calcMpe, setCalcMpe] = useState<string>('0.5');
  const [backendResult, setBackendResult] = useState<ApiComplianceCalculationResponse | null>(null);

  const loadComplianceState = useCallback(async () => {
    if (!backendConnected || !activeBackendSessionId) return;
    try {
      // 1. Fetch readings from PostgreSQL
      const serverReadings = await readingsApi.getSessionReadings(activeBackendSessionId);
      if (serverReadings && serverReadings.length > 0) {
        const mapped: ComplianceTestRow[] = serverReadings.map((r) => ({
          id: `ct_db_${r.id}`,
          testType: (r.test_point.includes('Tare') ? 'Tare Test' : r.test_point.includes('Eccentric') ? 'Eccentricity' : r.test_point.includes('Repeat') ? 'Repeatability' : 'Weighing Performance') as any,
          appliedLoad: r.reference_value,
          indicatedValue: r.indicated_value,
          referenceValue: r.reference_value,
          error: r.error,
          applicableMPE: r.mpe,
          result: r.result as 'PASS' | 'FAIL',
        }));
        setTests(mapped);
      } else {
        setTests([]);
      }

      // 2. Fetch session compliance result
      const compResult = await complianceApi.getSessionCompliance(activeBackendSessionId);
      if (compResult) {
        setOverallVerdict(compResult.overall_result);
      }
    } catch (e: any) {
      console.warn('Could not load session compliance from backend:', e.message);
    }
  }, [backendConnected, activeBackendSessionId]);

  useEffect(() => {
    loadComplianceState();
  }, [loadComplianceState]);

  const handleRunBackendCalculation = async () => {
    setEvaluating(true);
    setCalcFeedback(null);
    try {
      const refVal = parseFloat(calcRef);
      const indVal = parseFloat(calcInd);
      const mpeVal = parseFloat(calcMpe);

      // Perform calculation through FastAPI modular deterministic compliance engine
      const res = await complianceApi.calculateCompliance({
        reference_value: refVal,
        indicated_value: indVal,
        mpe: mpeVal,
        test_type: selectedTestType,
        accuracy_class: `Class ${draftSession.accuracyClass}`,
      });
      setBackendResult(res);

      // If active session exists and calculation resulted in PASS/FAIL, also trigger evaluation in PostgreSQL
      if (activeBackendSessionId && (res.result === 'PASS' || res.result === 'FAIL')) {
        const evalRes = await complianceApi.evaluateSession(activeBackendSessionId);
        setOverallVerdict(evalRes.overall_result);
        await loadComplianceState();
      }

      if (res.result === 'NOT_IMPLEMENTED') {
        setCalcFeedback(`OIML R-76 Framework notice: ${res.explanation}`);
      } else if (res.result === 'INVALID') {
        setCalcFeedback(`Validation Error: ${res.explanation}`);
      } else {
        setCalcFeedback(`OIML R-76 verified: Error = ${res.error} ${draftSession.unit}, Result = ${res.result}`);
      }
    } catch (err: any) {
      setCalcFeedback(`Calculation error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const passCount = tests.filter(t => t.result === 'PASS').length;
  const reviewCount = tests.filter(t => t.result === 'REVIEW').length;
  const failCount = tests.filter(t => t.result === 'FAIL').length;

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">STEP 4 // COMPLIANCE ENGINE</span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono-sm text-label-mono-sm uppercase font-bold">OIML R-76:2006</span>
              {databaseConnected && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-label-mono-sm font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                  POSTGRESQL PERSISTED
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">OIML R-76 Compliance Verification</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Deterministic rule-based compliance engine — Maximum Permissible Error (MPE) evaluation
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`px-4 py-2 rounded-xl font-label-mono-lg text-label-mono-lg font-bold text-center ${
              overallVerdict === 'PASS' ? 'bg-on-tertiary-container text-white'
              : overallVerdict === 'FAIL' ? 'bg-error text-on-error'
              : 'bg-error-container text-on-error-container'
            }`}>
              OVERALL: {overallVerdict}
            </div>
            <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">
              {passCount} PASS · {reviewCount} REVIEW · {failCount} FAIL
            </span>
          </div>
        </div>

        {/* Compliance Framework Notice */}
        <div className="mt-space-md bg-surface-container-low p-space-sm rounded-lg flex items-start gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px] flex-shrink-0 mt-0.5">verified_user</span>
          <div className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-primary font-semibold">OIML R-76 Compliance Framework:</strong>{' '}
            Verified test points are evaluated by strict deterministic formulas against Table 6 MPE limits.
            Accuracy Class {draftSession.accuracyClass} | e = {draftSession.verificationScaleInterval_e} {draftSession.unit}
          </div>
        </div>
      </section>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md">
        {[
          { label: 'Tests Run', value: tests.length, icon: 'lab_research', color: 'text-secondary' },
          { label: 'Pass', value: passCount, icon: 'check_circle', color: 'text-on-tertiary-container' },
          { label: 'Review', value: reviewCount, icon: 'pending', color: 'text-error' },
          { label: 'Fail', value: failCount, icon: 'cancel', color: 'text-error' },
        ].map(stat => (
          <div key={stat.label} className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">{stat.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${stat.color}`}>{stat.icon}</span>
            </div>
            <div className={`metrology-mono text-3xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Interactive Deterministic Compliance Calculator (FastAPI Backend) */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
        <div className="flex items-center justify-between mb-space-md">
          <div className="flex items-center gap-2">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                STATUTORY ENGINE INTERFACE (/api/compliance/calculate)
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                Run Deterministic MPE Verification Calculation
              </h3>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-semibold">
            OIML R-76:2006 (E)
          </span>
        </div>

        {/* Test Type Selection */}
        <div className="mb-space-md">
          <label className="nawi-label">OIML R-76 Prescribed Test Category</label>
          <select
            value={selectedTestType}
            onChange={e => setSelectedTestType(e.target.value)}
            className="nawi-select sm:w-1/2 font-body-sm font-semibold"
          >
            {TEST_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-space-md items-end">
          <div>
            <label className="nawi-label">Reference Value ({draftSession.unit})</label>
            <input
              type="number"
              value={calcRef}
              onChange={e => setCalcRef(e.target.value)}
              className="nawi-input metrology-mono"
              step="any"
            />
          </div>
          <div>
            <label className="nawi-label">Indicated Value ({draftSession.unit})</label>
            <input
              type="number"
              value={calcInd}
              onChange={e => setCalcInd(e.target.value)}
              className="nawi-input metrology-mono"
              step="any"
            />
          </div>
          <div>
            <label className="nawi-label">Statutory MPE (± {draftSession.unit})</label>
            <input
              type="number"
              value={calcMpe}
              onChange={e => setCalcMpe(e.target.value)}
              className="nawi-input metrology-mono"
              step="any"
            />
          </div>
          <button
            onClick={handleRunBackendCalculation}
            disabled={evaluating}
            className="btn-primary h-[42px] justify-center"
          >
            {evaluating ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">calculate</span>
            )}
            Evaluate with Backend
          </button>
        </div>

        {/* Calculation output display */}
        {backendResult && (
          <div className="mt-space-md p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-2 border-b border-outline-variant/20">
              <div className="flex flex-wrap items-center gap-2 font-label-mono-sm text-[11px]">
                <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-semibold">
                  {backendResult.standard} : {backendResult.edition}
                </span>
                <span className="text-secondary font-semibold">
                  {backendResult.clause}
                </span>
                {backendResult.calculation_method && (
                  <span className="text-outline">
                    • Method: {backendResult.calculation_method}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-mono-sm text-[11px] text-outline uppercase font-semibold">Verdict:</span>
                <VerdictBadge result={backendResult.result} />
              </div>
            </div>

            {backendResult.result !== 'NOT_IMPLEMENTED' && backendResult.result !== 'INVALID' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md">
                <div>
                  <span className="font-label-mono-sm text-[11px] text-outline uppercase block">Reference (L)</span>
                  <span className="metrology-mono text-[14px] font-bold text-primary">{backendResult.reference_value} {draftSession.unit}</span>
                </div>
                <div>
                  <span className="font-label-mono-sm text-[11px] text-outline uppercase block">Indicated (I)</span>
                  <span className="metrology-mono text-[14px] font-bold text-on-surface">{backendResult.indicated_value} {draftSession.unit}</span>
                </div>
                <div>
                  <span className="font-label-mono-sm text-[11px] text-outline uppercase block">Error (E = I - L)</span>
                  <span className={`metrology-mono text-[14px] font-bold ${backendResult.result === 'PASS' ? 'text-on-tertiary-container' : 'text-error'}`}>
                    {backendResult.error >= 0 ? '+' : ''}{backendResult.error} {draftSession.unit}
                  </span>
                </div>
                <div>
                  <span className="font-label-mono-sm text-[11px] text-outline uppercase block">Statutory MPE</span>
                  <span className="metrology-mono text-[14px] font-bold text-outline">±{backendResult.mpe} {draftSession.unit}</span>
                </div>
              </div>
            )}

            {backendResult.explanation && (
              <div className="p-2.5 rounded-lg bg-surface-container text-body-sm text-on-surface-variant font-medium border border-outline-variant/30">
                <span className="font-semibold text-primary">Audit Trace: </span>
                {backendResult.explanation}
              </div>
            )}
          </div>
        )}

        {calcFeedback && (
          <div className="mt-2 text-body-sm text-on-surface-variant font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {calcFeedback}
          </div>
        )}
      </div>

      {/* MPE Test Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex items-center justify-between p-space-lg border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">MPE EVALUATION TABLE</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Metrological Compliance Test Results</h3>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="nawi-table">
            <thead>
              <tr>
                <th>Test Type</th>
                <th>Applied Load</th>
                <th>Indicated Value</th>
                <th>Reference Value</th>
                <th>Error (Δ)</th>
                <th>MPE (±)</th>
                <th>MPE Utilisation</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-1 block">rule</span>
                    <p className="font-semibold text-primary">No readings recorded yet for this session.</p>
                    <p className="text-xs text-outline mt-1">
                      Go to Step 2 (Data Acquisition) to capture test points or run simulated telemetry.
                    </p>
                    <button
                      onClick={() => setCurrentView('data-acquisition')}
                      className="btn-secondary mt-3 text-xs mx-auto inline-flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">sensors</span>
                      Record Test Points
                    </button>
                  </td>
                </tr>
              ) : (
                tests.map(test => {
                  const utilisation = test.applicableMPE > 0 ? Math.abs(test.error / test.applicableMPE) * 100 : 0;
                  const eVal = draftSession.verificationScaleInterval_e > 0 ? draftSession.verificationScaleInterval_e : 1;
                  const loadInE = `${Math.round(test.appliedLoad / eVal)}e`;
                  return (
                    <tr key={test.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-body-sm font-semibold text-on-surface">{test.testType}</span>
                          <span className="font-label-mono-sm text-[10px] text-outline font-medium">{getOimlClause(test.testType)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-baseline gap-1">
                          <span className="metrology-mono text-[12px] text-primary font-semibold">{test.appliedLoad.toFixed(4)} {draftSession.unit}</span>
                          <span className="font-label-mono-sm text-[10px] text-outline">({loadInE})</span>
                        </div>
                      </td>
                      <td><span className="metrology-mono text-[12px] text-on-surface">{test.indicatedValue.toFixed(4)} {draftSession.unit}</span></td>
                      <td><span className="metrology-mono text-[12px] text-on-surface-variant">{test.referenceValue.toFixed(4)} {draftSession.unit}</span></td>
                      <td>
                        <span className={`metrology-mono text-[12px] font-semibold ${
                          Math.abs(test.error) <= test.applicableMPE ? 'text-on-tertiary-container' : 'text-error'
                        }`}>
                          {test.error >= 0 ? '+' : ''}{test.error.toFixed(4)} {draftSession.unit}
                        </span>
                      </td>
                      <td><span className="metrology-mono text-[12px] text-outline">±{test.applicableMPE.toFixed(4)}</span></td>
                      <td>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 bg-surface-container rounded overflow-hidden">
                            <div
                              className={`h-full rounded transition-all ${utilisation > 90 ? 'bg-error' : utilisation > 70 ? 'bg-error-container' : 'bg-on-tertiary-container'}`}
                              style={{ width: `${Math.min(100, utilisation)}%` }}
                            />
                          </div>
                          <span className="metrology-mono text-[10px] text-outline w-10">{utilisation.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td><VerdictBadge result={test.result} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation Footer */}
      <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col sm:flex-row items-center justify-between gap-space-md mt-space-md">
        <button
          onClick={() => setCurrentView('data-acquisition')}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Data Acquisition
        </button>
        <div className="flex items-center gap-space-sm">
          <button
            onClick={async () => {
              if (activeBackendSessionId) {
                setEvaluating(true);
                try {
                  const evalRes = await complianceApi.evaluateSession(activeBackendSessionId);
                  setOverallVerdict(evalRes.overall_result);
                  await loadComplianceState();
                } catch (e: any) {
                  console.error('Session evaluation failed:', e);
                } finally {
                  setEvaluating(false);
                }
              }
            }}
            disabled={evaluating || !activeBackendSessionId}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            {evaluating ? 'Evaluating Session...' : 'Re-Evaluate All Points'}
          </button>
          <button
            onClick={() => setCurrentView('evidence')}
            className="btn-primary"
          >
            <span>Proceed to Evidence &amp; Photos</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </footer>
    </>
  );
};
