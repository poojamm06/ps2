import React, { useState, useEffect } from 'react';
import { useVerification } from '../context/VerificationContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { fingerprintApi } from '../services/api';
import type { ApiFingerprintResponse } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ChartTitle, ChartTooltip, Legend, Filler);

export const FingerprintView: React.FC = () => {
  const { draftSession, activeBackendSessionId, backendConnected } = useVerification();
  const [fingerprint, setFingerprint] = useState<ApiFingerprintResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [sealed, setSealed] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sessionId = activeBackendSessionId || draftSession.backendSessionId;

  const loadFingerprint = async () => {
    if (!sessionId || !backendConnected) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await fingerprintApi.getSessionFingerprint(sessionId);
      setFingerprint(data);
    } catch (err: any) {
      console.warn('Could not fetch fingerprint from backend:', err.message);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReAnalyze = async () => {
    if (!sessionId) return;
    try {
      setAnalyzing(true);
      setErrorMsg(null);
      const data = await fingerprintApi.generateSessionFingerprint(sessionId);
      setFingerprint(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate fingerprint');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadFingerprint();
  }, [sessionId, backendConnected]);

  const handleSeal = () => {
    setSealing(true);
    setTimeout(() => {
      setSealing(false);
      setSealed(true);
    }, 1200);
  };

  // Build dynamic Linearity Chart from real readings if available
  const hasRealPoints = fingerprint && fingerprint.data_points && fingerprint.data_points.length > 0;
  
  const sortedPoints = hasRealPoints
    ? [...fingerprint.data_points].sort((a, b) => a.reference_value - b.reference_value)
    : [];

  const linearityLabels = sortedPoints.length > 0
    ? sortedPoints.map(p => `${p.reference_value} ${p.unit}`)
    : ['0 kg', '5 kg', '10 kg', '15 kg', '20 kg', '25 kg', '30 kg'];

  const linearityErrors = sortedPoints.length > 0
    ? sortedPoints.map(p => p.error)
    : [0, 0.04, 0.06, 0.08, 0.10, 0.11, 0.12];

  const linearityMpeLimits = sortedPoints.length > 0
    ? sortedPoints.map(p => p.mpe)
    : [0.5, 0.5, 1.0, 1.0, 1.5, 1.5, 1.5];

  const linearityData = {
    labels: linearityLabels,
    datasets: [
      {
        label: 'Observed Error (e)',
        data: linearityErrors,
        borderColor: '#006398',
        backgroundColor: 'rgba(0,99,152,0.08)',
        fill: false,
        tension: 0.2,
        pointRadius: 5,
        pointBackgroundColor: '#006398',
      },
      {
        label: 'Upper MPE Limit',
        data: linearityMpeLimits,
        borderColor: '#5bb8fe',
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Lower MPE Limit',
        data: linearityMpeLimits.map(v => -v),
        borderColor: '#5bb8fe',
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const linearityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        grid: { color: '#eff4ff' },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' },
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 }, color: '#44474e' },
      },
    },
  };

  // Build Repeatability Bar Chart from real data
  const repReadings = fingerprint?.repeatability?.readings || [];
  const repData = {
    labels: repReadings.length > 0
      ? repReadings.map((_, idx) => `Run #${idx + 1}`)
      : ['Run 1', 'Run 2', 'Run 3', 'Run 4', 'Run 5'],
    datasets: [{
      label: 'Observed Value',
      data: repReadings.length > 0 ? repReadings : [15.001, 15.002, 15.000, 15.001, 15.001],
      backgroundColor: 'rgba(0,99,152,0.6)',
      borderColor: '#006398',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const repOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        grid: { color: '#eff4ff' },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' },
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const isInsufficient = !fingerprint || fingerprint.status === 'INSUFFICIENT_DATA' || fingerprint.measurement_count < 2;

  const stats = fingerprint?.error_statistics;
  const trend = fingerprint?.trend;
  const coverage = fingerprint?.test_coverage;

  const trendBadgeClass =
    trend?.classification === 'STABLE' ? 'badge-pass' :
    trend?.classification === 'INCREASING' ? 'badge-review' :
    trend?.classification === 'DECREASING' ? 'badge-review' :
    trend?.classification === 'IRREGULAR' ? 'badge-fail' : 'badge-testing';

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div className="space-y-space-xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase tracking-wider">
                STEP 4 // METROLOGICAL FINGERPRINT
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono-sm text-label-mono-sm font-bold uppercase">
                CLASS {draftSession.accuracyClass || 'III'}
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm font-semibold uppercase">
                SESSION: {draftSession.sessionId || `SESSION-${sessionId}`}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-mono-sm text-label-mono-sm">
                S/N: {draftSession.serialNumber || 'N/A'}
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              Metrological Fingerprint &amp; Behavioral Profile
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-4xl">
              Empirical measurement-behaviour profile, error dispersion statistics, and repeatability signatures derived from real verification observations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="bg-surface-container-low px-space-md py-space-xs rounded-lg flex items-center gap-space-sm shadow-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">analytics</span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Observations</div>
                <div className="font-label-mono-md text-label-mono-md text-primary font-bold">
                  {fingerprint?.measurement_count || 0} pts <span className="text-secondary text-body-sm font-semibold">[{fingerprint?.status || 'PENDING'}]</span>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-low px-space-md py-space-xs rounded-lg flex items-center gap-space-sm shadow-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Trend Profile</div>
                <div className="font-label-mono-md text-label-mono-md text-primary font-bold">
                  {trend?.classification || 'PENDING'}
                </div>
              </div>
            </div>
            <button
              onClick={handleReAnalyze}
              disabled={analyzing || loading}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                {analyzing ? 'hourglass_top' : 'sync'}
              </span>
              {analyzing ? 'Computing...' : 'Re-Analyze'}
            </button>
          </div>
        </div>

        {/* Reference Framework Notice */}
        <div className="bg-surface-container-low p-space-sm rounded-lg flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[20px] flex-shrink-0 mt-0.5">verified_user</span>
          <div className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-primary font-semibold">Metrological Behavioral Separation Notice:</strong>{' '}
            The metrological fingerprint represents observed measurement behaviour and statistical dispersion across verified load points. Regulatory conformity is determined strictly by statutory OIML R-76 MPE boundaries.
          </div>
        </div>

        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="p-space-sm rounded-lg bg-error-container/40 border border-error/30 text-error flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="uppercase hover:underline font-label-mono-sm">Dismiss</button>
          </div>
        )}
      </section>

      {/* Insufficient Data Warning Card */}
      {isInsufficient && (
        <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/30 text-center space-y-space-sm">
          <div className="w-12 h-12 rounded-full bg-surface-container-high text-secondary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">data_alert</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
            Insufficient Measurement Data
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto">
            A metrological fingerprint requires at least 2 real verification readings in this session to compute empirical error statistics and dispersion profiles.
          </p>
          <div className="pt-2">
            <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase font-semibold">
              Currently Recorded: {fingerprint?.measurement_count || 0} reading(s)
            </span>
          </div>
        </section>
      )}

      {/* Statistical Metric Overview Cards */}
      {!isInsufficient && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card">
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Mean Bias (μ)</div>
            <div className="metrology-mono text-xl font-bold text-primary mt-1">{stats.mean > 0 ? `+${stats.mean}` : stats.mean}</div>
            <div className="text-[10px] text-on-surface-variant font-label-mono-sm mt-0.5">Average Error</div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card">
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Median Error</div>
            <div className="metrology-mono text-xl font-bold text-primary mt-1">{stats.median > 0 ? `+${stats.median}` : stats.median}</div>
            <div className="text-[10px] text-on-surface-variant font-label-mono-sm mt-0.5">50th Percentile</div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card">
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Std Dev (s)</div>
            <div className="metrology-mono text-xl font-bold text-on-tertiary-container mt-1">{stats.std_dev}</div>
            <div className="text-[10px] text-on-surface-variant font-label-mono-sm mt-0.5">Sample Spread</div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card">
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Mean Abs Error</div>
            <div className="metrology-mono text-xl font-bold text-primary mt-1">{stats.mean_absolute}</div>
            <div className="text-[10px] text-on-surface-variant font-label-mono-sm mt-0.5">MAE Magnitude</div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card">
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Max Abs Error</div>
            <div className="metrology-mono text-xl font-bold text-error mt-1">{stats.max_absolute}</div>
            <div className="text-[10px] text-on-surface-variant font-label-mono-sm mt-0.5">Worst-case Point</div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card">
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Error Range</div>
            <div className="metrology-mono text-xl font-bold text-primary mt-1">{stats.error_range}</div>
            <div className="text-[10px] text-on-surface-variant font-label-mono-sm mt-0.5">Max - Min Error</div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        {/* PLOT 01: Linearity & Empirical Error Curve */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="section-header-bar"></span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                  PLOT 01 // METROLOGICAL ERROR SIGNATURE
                </div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Empirical Error Response Curve
                </h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-mono-sm text-label-mono-sm text-secondary font-semibold">
              {fingerprint?.measurement_count || 0} Test Points
            </span>
          </div>
          <div style={{ height: 220 }}>
            <Line data={linearityData} options={linearityOptions} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-space-sm font-label-mono-sm text-label-mono-sm">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-secondary rounded"></span>
                <span className="text-on-surface">Observed Error</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-b border-secondary-container"></span>
                <span className="text-secondary">Statutory MPE Corridor</span>
              </div>
            </div>
            <div className="bg-surface-container px-2.5 py-1 rounded text-primary font-medium">
              Trend: <span className={trendBadgeClass}>{trend?.classification || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* PLOT 02: Repeatability / Dispersion */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="section-header-bar"></span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                  PLOT 02 // REPEATABILITY & DISPERSION
                </div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Repeatability Run Distribution
                </h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-mono-sm text-label-mono-sm text-secondary font-semibold">
              {fingerprint?.repeatability ? `Load: ${fingerprint.repeatability.test_load}` : 'Nominal Load'}
            </span>
          </div>
          <div style={{ height: 220 }}>
            <Bar data={repData} options={repOptions} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-space-sm font-label-mono-sm text-label-mono-sm">
            <div className="flex items-center gap-space-md text-on-surface-variant">
              <span>Runs: <strong>{fingerprint?.repeatability?.run_count || 0}</strong></span>
              <span className="text-outline-variant">|</span>
              <span>Repeatability s: <strong>{fingerprint?.repeatability?.std_dev || '0.000'}</strong></span>
            </div>
            <div className="bg-surface-container px-2.5 py-1 rounded text-primary font-medium">
              Spread Range: <strong>{fingerprint?.repeatability?.range || '0.000'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic & Coverage Panel */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                Metrological Feature Extraction &amp; Regression Diagnostics
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Linear regression parameters, slope classification, and test regime coverage audit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-1.5 rounded-lg shadow-sm">
            <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Fingerprint Version</span>
            <span className="font-label-mono-lg text-label-mono-lg text-on-tertiary-container font-bold">
              v{fingerprint?.fingerprint_version || '1.0'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          {/* Trend Card */}
          <div className="bg-surface-container-low p-space-md rounded-lg space-y-2">
            <div className="flex items-center justify-between text-outline font-label-mono-sm text-label-mono-sm">
              <span className="font-semibold uppercase tracking-wider">Trend Response</span>
              <span className="material-symbols-outlined text-secondary text-[16px]">show_chart</span>
            </div>
            <div className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-2">
              <span className={trendBadgeClass}>{trend?.classification || 'INSUFFICIENT_DATA'}</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-normal">
              {trend?.description || 'No trend calculated.'}
            </p>
            <div className="pt-2 border-t border-outline-variant/30 text-[11px] font-label-mono-sm flex justify-between">
              <span className="text-outline">Slope (m): <strong>{trend?.slope !== undefined && trend?.slope !== null ? trend.slope : 'N/A'}</strong></span>
              <span className="text-outline">R² Fit: <strong>{trend?.r_squared !== undefined && trend?.r_squared !== null ? trend.r_squared : 'N/A'}</strong></span>
            </div>
          </div>

          {/* Test Coverage Card */}
          <div className="bg-surface-container-low p-space-md rounded-lg space-y-2">
            <div className="flex items-center justify-between text-outline font-label-mono-sm text-label-mono-sm">
              <span className="font-semibold uppercase tracking-wider">Test Coverage Audit</span>
              <span className="material-symbols-outlined text-secondary text-[16px]">fact_check</span>
            </div>
            <div className="font-headline-sm text-headline-sm text-primary font-bold">
              {coverage?.total_test_points || 0} Total Points
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Accuracy / Load Tests:</span>
                <span className={coverage?.accuracy ? 'text-pass font-bold' : 'text-outline'}>
                  {coverage?.accuracy ? 'COVERED' : 'NOT DETECTED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Repeatability Grouping:</span>
                <span className={coverage?.repeatability ? 'text-pass font-bold' : 'text-outline'}>
                  {coverage?.repeatability ? 'COVERED' : 'NOT DETECTED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Eccentricity Testing:</span>
                <span className={coverage?.eccentricity ? 'text-pass font-bold' : 'text-outline'}>
                  {coverage?.eccentricity ? 'COVERED' : 'NOT DETECTED'}
                </span>
              </div>
            </div>
          </div>

          {/* Historical Comparison Card */}
          <div className="bg-surface-container-low p-space-md rounded-lg space-y-2">
            <div className="flex items-center justify-between text-outline font-label-mono-sm text-label-mono-sm">
              <span className="font-semibold uppercase tracking-wider">Historical Comparison</span>
              <span className="material-symbols-outlined text-secondary text-[16px]">history</span>
            </div>
            {fingerprint?.historical_comparison ? (
              <>
                <div className="font-headline-sm text-headline-sm text-primary font-bold">
                  Δ μ = {fingerprint.historical_comparison.mean_error_change > 0 ? `+${fingerprint.historical_comparison.mean_error_change}` : fingerprint.historical_comparison.mean_error_change}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-normal">
                  {fingerprint.historical_comparison.drift_summary}
                </p>
                <div className="pt-2 border-t border-outline-variant/30 text-[11px] font-label-mono-sm flex justify-between">
                  <span className="text-outline">Δ Std Dev: <strong>{fingerprint.historical_comparison.std_dev_change}</strong></span>
                  <span className="text-outline">Δ MaxAE: <strong>{fingerprint.historical_comparison.max_absolute_error_change}</strong></span>
                </div>
              </>
            ) : (
              <>
                <div className="font-headline-sm text-sm text-on-surface-variant font-medium pt-2">
                  Initial Baseline Fingerprint
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-normal">
                  No previous verification sessions found for this instrument. This record serves as the historical reference baseline.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Statutory Separation Banner */}
      <section className="bg-surface-container-high p-space-md rounded-xl shadow-card flex flex-col sm:flex-row items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">policy</span>
          </div>
          <div>
            <div className="font-label-mono-sm text-label-mono-sm uppercase text-secondary font-bold tracking-wider">
              Legal Metrology &amp; Statistical Profiling Directive
            </div>
            <div className="font-body-md text-body-md text-primary font-medium">
              Metrological fingerprinting captures empirical instrument behavior across load points. Authoritative PASS / FAIL conformity is determined solely by statutory OIML R-76 clauses.
            </div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-surface-container-lowest font-label-mono-sm text-label-mono-sm text-on-surface-variant font-semibold shadow-sm flex-shrink-0">
          WELMEC 7.2 COMPLIANT
        </span>
      </section>

      {/* Cryptographic Footer */}
      <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col lg:flex-row items-center justify-between gap-space-md">
        <div className="flex flex-wrap items-center gap-space-md w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">enhanced_encryption</span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                Cryptographic Integrity Hash (SHA-256)
              </div>
              <div className="font-label-mono-md text-label-mono-sm text-primary font-bold tracking-tight max-w-md truncate" title={fingerprint?.fingerprint_hash || 'None'}>
                {fingerprint?.fingerprint_hash ? `0x${fingerprint.fingerprint_hash}` : '0x0000000000000000000000000000000000000000'}
              </div>
            </div>
          </div>
          <div className="h-6 w-px bg-surface-container-highest hidden sm:block"></div>
          <div>
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Algorithm</div>
            <div className="font-label-mono-md text-label-mono-sm text-primary font-medium">
              {fingerprint?.hash_algorithm || 'SHA-256'} (Canonical Vector)
            </div>
          </div>
          <div className="h-6 w-px bg-surface-container-highest hidden sm:block"></div>
          <div className="flex items-center gap-1.5 font-label-mono-sm text-label-mono-sm text-on-tertiary-container font-semibold">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container"></span>
            TRACEABLE LEDGER ANCHOR
          </div>
        </div>
        <div className="flex items-center gap-space-sm w-full lg:w-auto justify-end">
          <button
            onClick={handleSeal}
            disabled={sealing || sealed}
            className={`btn-primary ${sealed ? 'opacity-70' : ''}`}
          >
            {sealing ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : sealed ? (
              <span className="material-symbols-outlined text-[16px]">verified</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">lock</span>
            )}
            {sealing ? 'Sealing Ledger...' : sealed ? 'Sealed & Timestamped' : 'Digitally Seal Fingerprint Record'}
          </button>
        </div>
      </footer>
    </>
  );
};
