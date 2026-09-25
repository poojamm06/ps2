import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';
import { fingerprintScenarios, type FingerprintScenario } from '../mock/uvpMockData';
import { fingerprintIdentityApi, type FingerprintIdentityResult } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, ChartTooltip, Legend, Filler, RadialLinearScale);

type Mode = 'ENROL' | 'VERIFY';
type Scenario = 'genuine' | 'swapped';

// Real backend first, deterministic mock fallback on failure. Maps the backend's
// /fingerprint/demo-scenarios/{id}/verify response onto the same shape the mock
// data uses, so the rest of this view doesn't need to know which source it came
// from.
const apiResultToScenario = (api: FingerprintIdentityResult, scenario: Scenario, mockFallback: FingerprintScenario): FingerprintScenario => {
  const normalize = (arr: number[]): number[] => {
    if (arr.length === 0) return [0, 0];
    const max = Math.max(...arr, 0.001);
    const min = Math.min(...arr, 0);
    const range = max - min || 1;
    return arr.map(v => (v - min) / range);
  };
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const pctDelta = (a: number, b: number) => {
    const base = Math.abs(a) < 1e-6 ? 1e-6 : Math.abs(a);
    return ((b - a) / base) * 100;
  };

  const stored = api.stored_feature_vector;
  const current = api.current_feature_vector;
  const isMatch = api.result === 'MATCH';

  const errMeanStored = mean(stored.error_curve);
  const errMeanCurrent = mean(current.error_curve);
  const eccMeanStored = mean(stored.eccentricity_pattern);
  const eccMeanCurrent = mean(current.eccentricity_pattern);

  return {
    id: scenario,
    label: api.label || mockFallback.label,
    instrumentSerial: api.instrument_serial,
    model: api.model,
    manufacturer: api.manufacturer,
    enrolmentDate: mockFallback.enrolmentDate,
    enrolmentCertificate: api.enrolment_certificate || mockFallback.enrolmentCertificate,
    distance: api.distance,
    threshold: api.threshold,
    result: isMatch ? 'MATCH' : 'MISMATCH',
    headline: isMatch
      ? 'Identity Verified — Same Approved Unit'
      : 'Fingerprint Mismatch — This May NOT Be the Approved Unit',
    narrative: isMatch
      ? `Computed live by the backend: distance ${api.distance.toFixed(4)} is within the ${api.threshold.toFixed(2)} threshold. The error curve, eccentricity pattern and repeatability spread fall within the enrolled fingerprint envelope.`
      : `Computed live by the backend: distance ${api.distance.toFixed(4)} exceeds the ${api.threshold.toFixed(2)} threshold. The error curve, eccentricity pattern and repeatability spread diverge from the enrolled baseline — this unit is likely not the one originally approved.`,
    curveLabels: stored.error_curve.map((_, i) => `Pt ${i + 1}`),
    storedCurve: stored.error_curve,
    currentCurve: current.error_curve,
    storedHash: api.stored_hash,
    currentHash: api.current_hash,
    operator: mockFallback.operator,
    matchTimestamp: new Date().toLocaleString(),
    features: [
      {
        key: 'error_curve',
        label: 'Error Curve Shape',
        storedValue: `${errMeanStored >= 0 ? '+' : ''}${errMeanStored.toFixed(3)}e mean`,
        currentValue: `${errMeanCurrent >= 0 ? '+' : ''}${errMeanCurrent.toFixed(3)}e mean`,
        unit: 'nonlinearity',
        sparkline: normalize(stored.error_curve),
        sparklineCurrent: normalize(current.error_curve),
        deltaPercent: pctDelta(errMeanStored, errMeanCurrent),
      },
      {
        key: 'eccentricity',
        label: 'Eccentricity Pattern',
        storedValue: stored.eccentricity_pattern.length ? `${eccMeanStored >= 0 ? '+' : ''}${eccMeanStored.toFixed(3)}e mean` : 'Not tested',
        currentValue: current.eccentricity_pattern.length ? `${eccMeanCurrent >= 0 ? '+' : ''}${eccMeanCurrent.toFixed(3)}e mean` : 'Not tested',
        unit: '5-position',
        sparkline: normalize(stored.eccentricity_pattern),
        sparklineCurrent: normalize(current.eccentricity_pattern),
        deltaPercent: pctDelta(eccMeanStored, eccMeanCurrent),
      },
      {
        key: 'repeatability',
        label: 'Repeatability Spread',
        storedValue: `σ = ${stored.repeatability_std.toFixed(4)}e`,
        currentValue: `σ = ${current.repeatability_std.toFixed(4)}e`,
        unit: 'hysteresis + ADC noise',
        sparkline: [stored.repeatability_std, stored.repeatability_std * 1.05, stored.repeatability_std * 0.95],
        sparklineCurrent: [current.repeatability_std, current.repeatability_std * 1.05, current.repeatability_std * 0.95],
        deltaPercent: pctDelta(stored.repeatability_std, current.repeatability_std),
      },
      {
        key: 'creep',
        label: 'Creep / Recovery Profile',
        storedValue: stored.creep_profile.length ? `${mean(stored.creep_profile).toFixed(3)}e` : 'Not tested this cycle',
        currentValue: current.creep_profile.length ? `${mean(current.creep_profile).toFixed(3)}e` : 'Not tested this cycle',
        unit: 'device-specific decay',
        sparkline: stored.creep_profile.length ? normalize(stored.creep_profile) : [0.5, 0.5],
        sparklineCurrent: current.creep_profile.length ? normalize(current.creep_profile) : [0.5, 0.5],
        deltaPercent: stored.creep_profile.length && current.creep_profile.length ? pctDelta(mean(stored.creep_profile), mean(current.creep_profile)) : 0,
      },
    ],
  };
};

const Sparkline: React.FC<{ stored: number[]; current: number[]; mismatch: boolean }> = ({ stored, current, mismatch }) => {
  const w = 120, h = 32, pad = 2;
  const toPath = (arr: number[]) => {
    const max = Math.max(...stored, ...current, 0.001);
    const min = Math.min(...stored, ...current, 0);
    const range = max - min || 1;
    return arr
      .map((v, i) => {
        const x = pad + (i / (arr.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <path d={toPath(stored)} fill="none" stroke="#C7B8FF" strokeWidth={1.5} strokeDasharray="3,2" />
      <path d={toPath(current)} fill="none" stroke={mismatch ? '#DC2626' : '#4A3AFF'} strokeWidth={2} />
    </svg>
  );
};

export const FingerprintView: React.FC = () => {
  const { draftSession, activeBackendSessionId } = useVerification();
  const [mode, setMode] = useState<Mode>('VERIFY');
  const [scenario, setScenario] = useState<Scenario>('genuine');
  const [sealed, setSealed] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [enrolResult, setEnrolResult] = useState<{ hash: string; count: number } | null>(null);
  const [liveScenario, setLiveScenario] = useState<FingerprintScenario | null>(null);
  const [isLive, setIsLive] = useState(false);

  const mockFp = fingerprintScenarios[scenario];
  const fp = liveScenario || mockFp;
  const isMatch = fp.result === 'MATCH';

  const runVerification = useCallback(async (targetScenario: Scenario) => {
    setChecking(true);
    try {
      // Real backend first — deterministic demo scenario computed server-side.
      const apiResult = await fingerprintIdentityApi.runDemoScenario(targetScenario);
      setLiveScenario(apiResultToScenario(apiResult, targetScenario, fingerprintScenarios[targetScenario]));
      setIsLive(true);
    } catch (err) {
      console.warn('Fingerprint verify backend unavailable, using mock scenario:', err);
      setLiveScenario(null);
      setIsLive(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'VERIFY') {
      runVerification(scenario);
    }
  }, [mode, scenario, runVerification]);

  const handleEnrol = async () => {
    setSealing(true);
    if (activeBackendSessionId) {
      try {
        const result = await fingerprintIdentityApi.enrol(activeBackendSessionId);
        setEnrolResult({ hash: result.fingerprint_hash, count: result.measurement_count });
        setSealing(false);
        setSealed(true);
        return;
      } catch (err) {
        console.warn('Fingerprint enrol backend unavailable, using mock baseline:', err);
      }
    }
    // Deterministic mock fallback — no active backend session to enrol from.
    setTimeout(() => {
      setSealing(false);
      setSealed(true);
    }, 1100);
  };

  const handleRunVerify = () => {
    runVerification(scenario);
  };

  const overlayData = useMemo(() => ({
    labels: fp.curveLabels,
    datasets: [
      {
        label: 'Enrolled Fingerprint (Approved Unit)',
        data: fp.storedCurve,
        borderColor: '#C7B8FF',
        backgroundColor: 'rgba(147,204,255,0.08)',
        borderDash: [5, 4],
        pointRadius: 3,
        pointBackgroundColor: '#A78BFA',
        tension: 0.25,
      },
      {
        label: mode === 'ENROL' ? 'Live Enrolment Capture' : 'Current Verification Reading',
        data: fp.currentCurve,
        borderColor: isMatch ? '#4A3AFF' : '#DC2626',
        backgroundColor: isMatch ? 'rgba(74,58,255,0.10)' : 'rgba(220,38,38,0.10)',
        pointRadius: 3,
        pointBackgroundColor: isMatch ? '#4A3AFF' : '#DC2626',
        tension: 0.25,
        fill: mode === 'VERIFY',
      },
    ],
  }), [fp, mode, isMatch]);

  const overlayOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { grid: { color: '#F4F2FF' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#8B8AA3' }, title: { display: true, text: 'Error (× e)', font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#8B8AA3' }, title: { display: true, text: 'Load (% of Max)', font: { size: 10 } } },
    },
    plugins: {
      legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 }, color: '#5A5A72' } },
    },
  };

  const radarData = useMemo(() => {
    const norm = (v: number, ref: number) => Math.min(2, v / ref);
    return {
      labels: ['Error Curve', 'Eccentricity', 'Repeatability', 'Creep Profile'],
      datasets: [
        {
          label: 'Enrolled Baseline',
          data: [1, 1, 1, 1],
          borderColor: '#C7B8FF',
          backgroundColor: 'rgba(147,204,255,0.15)',
          borderDash: [4, 3],
          pointRadius: 2,
        },
        {
          label: 'Current Reading',
          data: fp.features.map(f => norm(1 + f.deltaPercent / 100, 1)),
          borderColor: isMatch ? '#4A3AFF' : '#DC2626',
          backgroundColor: isMatch ? 'rgba(74,58,255,0.20)' : 'rgba(220,38,38,0.22)',
          pointRadius: 3,
          pointBackgroundColor: isMatch ? '#4A3AFF' : '#DC2626',
        },
      ],
    };
  }, [fp, isMatch]);

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        suggestedMax: 2,
        ticks: { display: false },
        grid: { color: '#EEEBFF' },
        angleLines: { color: '#EEEBFF' },
        pointLabels: { font: { family: 'JetBrains Mono', size: 10 }, color: '#5A5A72' },
      },
    },
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 } } },
    },
  };

  // Gauge geometry: semicircle from -90deg to +90deg, needle position by distance/maxScale
  const gaugeMax = Math.max(fp.threshold * 2.2, fp.distance * 1.1, 1);
  const gaugePct = Math.min(1, fp.distance / gaugeMax);
  const needleAngle = -90 + gaugePct * 180;
  const thresholdAngle = -90 + Math.min(1, fp.threshold / gaugeMax) * 180;

  return (
    <div className="fade-in space-y-space-md">
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div className="space-y-space-xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase tracking-wider">
                UVP 1 // INSTRUMENT IDENTITY VERIFICATION
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm font-semibold uppercase">
                S/N: {fp.instrumentSerial}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-mono-sm text-label-mono-sm">
                CERT: {fp.enrolmentCertificate}
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              Metrological Fingerprinting
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Every load-cell assembly behaves slightly differently because of unavoidable manufacturing variation.
              We treat that behaviour as an unforgeable identity signature — proving this is the <em>same physical unit</em> that was approved, independent of the serial sticker or seal.
            </p>
            <p className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">
              Instrument: {draftSession.manufacturer || fp.manufacturer} {draftSession.model || fp.model} · S/N: {draftSession.serialNumber || fp.instrumentSerial} · Class {draftSession.accuracyClass}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex flex-col items-end gap-space-sm">
            <div className="inline-flex rounded-xl bg-surface-container-low p-1 shadow-sm">
              {(['ENROL', 'VERIFY'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-lg font-label-mono-sm text-label-mono-sm font-bold uppercase tracking-wider transition-all ${
                    mode === m ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {m === 'ENROL' ? 'Enrol Fingerprint' : 'Verify Identity'}
                </button>
              ))}
            </div>
            {mode === 'VERIFY' && (
              <div className="inline-flex rounded-xl bg-surface-container-low p-1 shadow-sm">
                {(['genuine', 'swapped'] as Scenario[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={`px-3 py-1.5 rounded-lg font-label-mono-sm text-label-mono-sm font-semibold uppercase tracking-wider transition-all ${
                      scenario === s
                        ? s === 'genuine' ? 'bg-on-tertiary-container text-white shadow-sm' : 'bg-error text-on-error shadow-sm'
                        : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {s === 'genuine' ? 'Demo: Genuine Unit' : 'Demo: Swapped Unit'}
                  </button>
                ))}
              </div>
            )}
            {mode === 'VERIFY' && !checking && (
              <span className={`self-end px-2 py-0.5 rounded-full font-label-mono-sm text-[10px] font-bold uppercase tracking-wider ${
                isLive ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-surface-container text-outline'
              }`}>
                {isLive ? 'Live Backend Computation' : 'Offline Demo Data'}
              </span>
            )}
          </div>
        </div>
      </section>

      {mode === 'ENROL' ? (
        <>
          {/* ENROL MODE */}
          <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
            <div className="flex items-center gap-2">
              <span className="section-header-bar"></span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Baseline Capture</div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Enrol Instrument Fingerprint at Type Approval</h2>
              </div>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              The full R-76 test suite for {draftSession.manufacturer || fp.manufacturer} {draftSession.model || fp.model} already produces
              the data required. We extract a normalised feature vector — error curve, eccentricity pattern, repeatability spread, and creep profile —
              and bind it cryptographically to this instrument's serial number, model, and approval date.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md">
              {fp.features.map(f => (
                <div key={f.key} className="bg-surface-container-low p-space-md rounded-lg space-y-1">
                  <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">{f.label}</div>
                  <div className="metrology-mono text-lg font-bold text-primary">{f.storedValue}</div>
                  <div className="text-[10px] text-on-surface-variant">{f.unit}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 240 }}>
              <Line
                data={{
                  labels: fp.curveLabels,
                  datasets: [{
                    label: 'Captured Error Curve',
                    data: fp.storedCurve,
                    borderColor: '#4A3AFF',
                    backgroundColor: 'rgba(74,58,255,0.10)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 4,
                    pointBackgroundColor: '#4A3AFF',
                  }],
                }}
                options={overlayOptions}
              />
            </div>
          </section>

          <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col lg:flex-row items-center justify-between gap-space-md">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">enhanced_encryption</span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                  {enrolResult ? 'Baseline Fingerprint Hash (SHA-256) — Live Session' : 'Baseline Fingerprint Hash (SHA-256)'}
                </div>
                <div className="font-label-mono-md text-label-mono-sm text-primary font-bold tracking-tight max-w-md truncate">
                  0x{enrolResult?.hash || fp.storedHash}
                </div>
                {enrolResult && (
                  <div className="text-[10px] text-on-surface-variant mt-0.5">{enrolResult.count} real readings enrolled from active session</div>
                )}
              </div>
            </div>
            <button onClick={handleEnrol} disabled={sealing || sealed} className={`btn-primary ${sealed ? 'opacity-70' : ''}`}>
              {sealing
                ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                : sealed
                ? <span className="material-symbols-outlined text-[16px]">verified</span>
                : <span className="material-symbols-outlined text-[16px]">fingerprint</span>}
              {sealing ? 'Enrolling & Sealing...' : sealed ? 'Fingerprint Enrolled & Sealed' : 'Enrol & Seal Baseline Fingerprint'}
            </button>
          </footer>
        </>
      ) : (
        <>
          {/* VERIFY MODE */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-md">
            {/* Distance Gauge + Verdict */}
            <div className="xl:col-span-1 bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md flex flex-col">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Fingerprint Distance</h2>
              </div>
              <div className="relative flex flex-col items-center justify-center py-space-sm">
                <svg viewBox="0 0 200 120" className="w-full max-w-[260px]">
                  <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#EEEBFF" strokeWidth="16" strokeLinecap="round" />
                  <path
                    d="M 20 110 A 80 80 0 0 1 180 110"
                    fill="none"
                    stroke={isMatch ? '#16A34A' : '#DC2626'}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={`${gaugePct * 251.2} 251.2`}
                  />
                  {/* threshold marker */}
                  <line
                    x1={100 + 80 * Math.cos((thresholdAngle * Math.PI) / 180)}
                    y1={110 + 80 * Math.sin((thresholdAngle * Math.PI) / 180)}
                    x2={100 + 65 * Math.cos((thresholdAngle * Math.PI) / 180)}
                    y2={110 + 65 * Math.sin((thresholdAngle * Math.PI) / 180)}
                    stroke="#5A5A72"
                    strokeWidth="3"
                  />
                  {/* needle */}
                  <line
                    x1="100" y1="110"
                    x2={100 + 68 * Math.cos((needleAngle * Math.PI) / 180)}
                    y2={110 + 68 * Math.sin((needleAngle * Math.PI) / 180)}
                    stroke="#1A1A2E"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="100" cy="110" r="6" fill="#1A1A2E" />
                </svg>
                <div className="text-center -mt-2">
                  <div className={`metrology-mono text-3xl font-bold ${isMatch ? 'text-on-tertiary-container' : 'text-error'}`}>
                    {fp.distance.toFixed(2)}
                  </div>
                  <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                    Distance vs. Threshold {fp.threshold.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-space-md text-center space-y-1 ${isMatch ? 'bg-on-tertiary-container/10 border border-on-tertiary-container/40' : 'bg-error-container/40 border border-error/40'}`}>
                <div className={`flex items-center justify-center gap-2 font-headline-sm text-headline-sm font-bold ${isMatch ? 'text-on-tertiary-container' : 'text-error'}`}>
                  <span className="material-symbols-outlined text-[24px]">{isMatch ? 'verified_user' : 'gpp_bad'}</span>
                  {isMatch ? 'MATCH' : 'MISMATCH'}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{fp.headline}</p>
              </div>

              <button onClick={handleRunVerify} disabled={checking} className="btn-primary justify-center">
                {checking
                  ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  : <span className="material-symbols-outlined text-[16px]">sync</span>}
                {checking ? 'Computing Distance...' : 'Re-run 5-Minute Verification Subset'}
              </button>
            </div>

            {/* Overlay Chart */}
            <div className="xl:col-span-2 bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="section-header-bar"></span>
                  <div>
                    <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">STORED VS. CURRENT</div>
                    <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Error Curve Overlay</h2>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded font-label-mono-sm text-label-mono-sm font-semibold ${isMatch ? 'badge-pass' : 'badge-fail'}`}>
                  {isMatch ? 'CURVES OVERLAP' : 'CURVES DIVERGE'}
                </span>
              </div>
              <div style={{ height: 260 }}>
                <Line data={overlayData} options={overlayOptions} />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{fp.narrative}</p>
            </div>
          </div>

          {/* Feature Vector Cards */}
          <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Feature Vector Comparison</h2>
              </div>
              <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Dashed = enrolled · Solid = current</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
              {fp.features.map(f => {
                const mismatch = Math.abs(f.deltaPercent) > 20;
                return (
                  <div key={f.key} className={`p-space-md rounded-lg border ${mismatch ? 'border-error/40 bg-error-container/10' : 'border-outline-variant/20 bg-surface-container-low'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">{f.label}</span>
                      <span className={`font-label-mono-sm text-[10px] font-bold ${mismatch ? 'text-error' : 'text-on-tertiary-container'}`}>
                        Δ{f.deltaPercent > 0 ? '+' : ''}{f.deltaPercent.toFixed(1)}%
                      </span>
                    </div>
                    <Sparkline stored={f.sparkline} current={f.sparklineCurrent} mismatch={mismatch} />
                    <div className="mt-2 flex items-center justify-between text-[11px] metrology-mono">
                      <span className="text-outline">{f.storedValue}</span>
                      <span className={mismatch ? 'text-error font-bold' : 'text-primary font-bold'}>{f.currentValue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Radar */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Behavioral Signature Radar</h2>
              </div>
              <div style={{ height: 260 }}>
                <Radar data={radarData} options={radarOptions} />
              </div>
            </div>

            {/* Fraud pattern reference table */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">What This Catches That R-76 Cannot</h2>
              </div>
              <table className="nawi-table">
                <thead>
                  <tr>
                    <th>Fraud Pattern</th>
                    <th>Standard R-76</th>
                    <th>With Fingerprinting</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-body-sm">Replica scale, copied serial + reused seal</td>
                    <td><span className="badge-pass">PASS</span></td>
                    <td><span className="badge-fail">MISMATCH</span></td>
                  </tr>
                  <tr>
                    <td className="font-body-sm">Manipulation chip inserted (behaving)</td>
                    <td><span className="badge-pass">PASS</span></td>
                    <td><span className="badge-fail">MISMATCH</span></td>
                  </tr>
                  <tr>
                    <td className="font-body-sm">Undeclared recalibration / span shift</td>
                    <td><span className="badge-pass">PASS</span></td>
                    <td><span className="badge-fail">MISMATCH</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Footer */}
          <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col lg:flex-row items-center justify-between gap-space-md">
            <div className="flex flex-wrap items-center gap-space-md w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">enhanced_encryption</span>
                <div>
                  <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Cryptographic Seal Comparison (SHA-256)</div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="font-label-mono-md text-label-mono-sm text-outline font-medium tracking-tight max-w-md truncate">
                      Enrolled: 0x{fp.storedHash}
                    </div>
                    <div className={`font-label-mono-md text-label-mono-sm font-bold tracking-tight max-w-md truncate ${isMatch ? 'text-on-tertiary-container' : 'text-error'}`}>
                      Current: 0x{fp.currentHash}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-space-sm w-full lg:w-auto justify-end text-right">
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Verified By</div>
                <div className="font-body-md font-semibold text-primary">{fp.operator}</div>
                <div className="text-[10px] text-on-surface-variant">{fp.matchTimestamp}</div>
              </div>
            </div>
          </footer>
        </>
      )}

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
              Metrological fingerprinting identifies the physical device. Authoritative PASS / FAIL conformity is determined solely by statutory OIML R-76 clauses.
            </div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-surface-container-lowest font-label-mono-sm text-label-mono-sm text-on-surface-variant font-semibold shadow-sm flex-shrink-0">
          ADVISORY — NOT A STATUTORY R-76 TEST
        </span>
      </section>
    </div>
  );
};
