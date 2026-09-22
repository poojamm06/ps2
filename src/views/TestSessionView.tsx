import React, { useState } from 'react';
import { useVerification } from '../context/VerificationContext';
import { sessionsGenerateCode } from '../services/api';

const LAB_STATIONS = [
  { id: 'LAB-DE-04', label: 'LAB-DE-04 (Central Legal Metrology Testing Lab)' },
  { id: 'LAB-ND-01', label: 'LAB-ND-01 (National Standards Calibration Facility)' },
  { id: 'LAB-MH-02', label: 'LAB-MH-02 (Regional Legal Metrology Station)' },
  { id: 'LAB-KA-03', label: 'LAB-KA-03 (State Precision Testing Centre)' },
];

export const TestSessionView: React.FC = () => {
  const {
    draftSession,
    updateDraft,
    createBackendSession,
    setCurrentView,
    databaseConnected,
  } = useVerification();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRegenerateCode = async () => {
    try {
      const resp = await sessionsGenerateCode();
      updateDraft({ sessionId: resp.session_code });
      setToastMessage(`Generated new session code: ${resp.session_code}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      // ignore
    }
  };

  const handleSaveAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastMessage(null);

    try {
      const success = await createBackendSession();
      if (success) {
        setToastMessage('Session saved to PostgreSQL. Advancing to Observations.');
        setTimeout(() => {
          setCurrentView('observations');
        }, 600);
      } else {
        // Even if offline/fallback, continue to observations
        setCurrentView('observations');
      }
    } catch (err: any) {
      console.warn('Session save notice:', err);
      setCurrentView('observations');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-space-lg">
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-xs mb-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold tracking-wider uppercase">
                STEP 2 OF 6 // TEST SESSION
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                OIML R-76 VERIFICATION
              </span>
              {databaseConnected && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-[11px] font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
                  POSTGRESQL READY
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              Test Session &amp; Laboratory Setup
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Configure session parameters, inspector authority, environmental conditions, and reference standards before recording observations.
            </p>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentView('instruments')}
              className="btn-secondary text-xs h-[42px]"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Change Instrument
            </button>
          </div>
        </div>
      </section>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {toastMessage}
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSaveAndProceed} className="space-y-space-lg">
        {/* Selected Instrument Summary Ribbon */}
        <div className="bg-surface-container-low p-space-md rounded-xl border border-outline-variant/40 flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[24px]">scale</span>
            </div>
            <div>
              <div className="text-xs text-outline font-label-mono-sm uppercase tracking-wider">Target Instrument Under Test</div>
              <div className="text-sm font-bold text-primary">
                {draftSession.manufacturer} {draftSession.model}
                <span className="ml-2 font-normal font-mono text-outline">(S/N: {draftSession.serialNumber})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-on-surface-variant flex-wrap">
            <div>Class: <strong className="text-secondary">Class {draftSession.accuracyClass}</strong></div>
            <div>Max: <strong className="text-primary">{draftSession.maxCapacity} {draftSession.unit}</strong></div>
            <div>e: <strong className="text-secondary">{draftSession.verificationScaleInterval_e} {draftSession.unit}</strong></div>
            <div>d: <strong>{draftSession.actualScaleInterval_d} {draftSession.unit}</strong></div>
          </div>
        </div>

        {/* Section 1: Session Identification & Officer */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/30 space-y-space-md">
          <h2 className="font-headline-sm text-body-lg font-bold text-primary border-b border-outline-variant/20 pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
            Session Identification &amp; Statutory Authority
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-on-surface-variant font-semibold">Test Session Code</label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-secondary hover:underline font-mono text-[11px]"
                >
                  Generate New
                </button>
              </div>
              <input
                type="text"
                required
                value={draftSession.sessionId}
                onChange={(e) => updateDraft({ sessionId: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-primary font-mono font-bold"
              />
              <p className="text-[11px] text-outline mt-1">Unique statutory verification code stored in PostgreSQL</p>
            </div>

            <div>
              <label className="block text-on-surface-variant font-semibold mb-1">Verification Officer Name</label>
              <input
                type="text"
                required
                value={draftSession.verificationOfficer}
                onChange={(e) => updateDraft({ verificationOfficer: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-primary font-semibold"
              />
              <p className="text-[11px] text-outline mt-1">Authorized metrology enforcement officer</p>
            </div>

            <div>
              <label className="block text-on-surface-variant font-semibold mb-1">Testing Station / Location</label>
              <select
                value={draftSession.testLocation}
                onChange={(e) => updateDraft({ testLocation: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-primary"
              >
                {LAB_STATIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <p className="text-[11px] text-outline mt-1">Designated metrological verification station</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md text-xs pt-2">
            <div>
              <label className="block text-on-surface-variant font-semibold mb-1">Verification Date</label>
              <input
                type="date"
                required
                value={draftSession.verificationDate}
                onChange={(e) => updateDraft({ verificationDate: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-on-surface-variant font-semibold mb-1">Verification Regimen (OIML R-76)</label>
              <select
                value={draftSession.testType}
                onChange={(e) => updateDraft({ testType: e.target.value as any })}
                className="w-full p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-primary font-semibold"
              >
                <option value="INITIAL_VERIFICATION">Initial Verification (MPE = 1.0 × Table 6)</option>
                <option value="IN_SERVICE_VERIFICATION">In-Service Verification (MPE = 2.0 × Table 6)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Environmental Conditions */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h2 className="font-headline-sm text-body-lg font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">thermostat</span>
              Environmental Conditions (OIML R-76 Clause 3.9)
            </h2>
            <span className="px-2 py-0.5 rounded bg-surface-container text-outline font-label-mono-sm text-[10px] font-bold uppercase">
              Standard: 20°C ± 5°C
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md text-xs">
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <label className="block text-on-surface-variant font-semibold mb-1">Ambient Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                required
                value={draftSession.temperatureC ?? 20.0}
                onChange={(e) => updateDraft({ temperatureC: parseFloat(e.target.value) || 20.0 })}
                className="w-full p-2 rounded bg-surface-container-lowest border border-outline-variant/50 text-primary font-mono text-sm font-bold"
              />
              <span className="text-[11px] text-outline mt-1 block">Specified: +10°C to +40°C</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <label className="block text-on-surface-variant font-semibold mb-1">Relative Humidity (% RH)</label>
              <input
                type="number"
                step="0.5"
                required
                value={draftSession.relativeHumidityPct ?? 50.0}
                onChange={(e) => updateDraft({ relativeHumidityPct: parseFloat(e.target.value) || 50.0 })}
                className="w-full p-2 rounded bg-surface-container-lowest border border-outline-variant/50 text-primary font-mono text-sm font-bold"
              />
              <span className="text-[11px] text-outline mt-1 block">Non-condensing (typically ≤ 85%)</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <label className="block text-on-surface-variant font-semibold mb-1">Atmospheric Pressure (hPa)</label>
              <input
                type="number"
                step="0.1"
                required
                value={draftSession.atmosphericPressureHpa ?? 1013.2}
                onChange={(e) => updateDraft({ atmosphericPressureHpa: parseFloat(e.target.value) || 1013.2 })}
                className="w-full p-2 rounded bg-surface-container-lowest border border-outline-variant/50 text-primary font-mono text-sm font-bold"
              />
              <span className="text-[11px] text-outline mt-1 block">Nominal reference 1013.25 hPa</span>
            </div>
          </div>
        </div>

        {/* Section 3: Reference Standards */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/30 space-y-space-md">
          <h2 className="font-headline-sm text-body-lg font-bold text-primary border-b border-outline-variant/20 pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">fitness_center</span>
            Traceable Reference Standards (OIML R 111 Weights)
          </h2>

          <div className="text-xs">
            <label className="block text-on-surface-variant font-semibold mb-1">
              Calibration Equipment &amp; Certificate Reference
            </label>
            <input
              type="text"
              required
              value={draftSession.standardsUsed}
              onChange={(e) => updateDraft({ standardsUsed: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-primary font-mono"
              placeholder="e.g. Radwag Class E2 Precision Set (1mg–2kg) [S/N: W-8812-E2, Cert: CAL-2026-W-8812]"
            />
            <p className="text-[11px] text-outline mt-1">
              Must be calibrated according to ISO/IEC 17025 with expanded uncertainty U ≤ 1/3 of applicable MPE.
            </p>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <button
            type="button"
            onClick={() => setCurrentView('instruments')}
            className="btn-secondary text-xs h-[42px]"
          >
            ← Back to Instruments
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary text-xs h-[46px] px-8 text-sm font-semibold shadow-md"
          >
            {isSubmitting ? 'Saving Session in PostgreSQL...' : 'Save & Proceed to Observations →'}
          </button>
        </div>
      </form>
    </div>
  );
};
