import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import { ObservationGrid } from '../components/ObservationGrid';
import { readingsApi } from '../services/api';
import type { StaticWeighingPoint } from '../types';
import { defaultDemoStaticPoints } from '../context/VerificationContext';

interface DataAcquisitionViewProps {
  onBack?: () => void;
  onContinue?: () => void;
}

export const DataAcquisitionView: React.FC<DataAcquisitionViewProps> = ({ onBack, onContinue }) => {
  const { 
    draftSession, 
    updateDraft, 
    proceedToStep, 
    setCurrentView,
    activeBackendSessionId,
    backendConnected,
    databaseConnected,
    createBackendSession
  } = useVerification();

  // Local state initialized from draftSession.staticWeighingPoints or defaults
  const [points, setPoints] = useState<StaticWeighingPoint[]>(() => {
    if (draftSession.staticWeighingPoints && draftSession.staticWeighingPoints.length > 0) {
      return draftSession.staticWeighingPoints;
    }
    return defaultDemoStaticPoints;
  });

  const [testDirection, setTestDirection] = useState<'increasing' | 'decreasing'>(
    draftSession.testDirection || 'increasing'
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [dbPersistedCount, setDbPersistedCount] = useState<number>(0);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);

  // Metrological constants
  const unit = draftSession.unit || 'g';
  const maxCapacity = draftSession.maxCapacity || 2100;
  const minCapacity = draftSession.minCapacity || 0.5;
  const e = draftSession.verificationScaleInterval_e || 0.1;
  const d = draftSession.actualScaleInterval_d || 0.01;
  const accuracyClass = draftSession.accuracyClass || 'II';
  const calculatedN = useMemo(() => {
    return e > 0 ? Math.round(maxCapacity / e) : 0;
  }, [maxCapacity, e]);

  // Load existing readings from PostgreSQL on mount / session change
  const loadDatabaseReadings = useCallback(async () => {
    if (!activeBackendSessionId || !backendConnected) return;
    try {
      const serverReadings = await readingsApi.getSessionReadings(activeBackendSessionId);
      if (serverReadings && serverReadings.length > 0) {
        const mappedPoints: StaticWeighingPoint[] = serverReadings.map((r, idx) => ({
          id: `db_rd_${r.id}`,
          pointNumber: idx + 1,
          appliedLoad: String(r.reference_value),
          indication: String(r.indicated_value),
          additionalLoadDeltaL: (0.5 * e).toFixed(2),
          zeroErrorE0: '0.00',
          isDemo: false,
        }));
        setPoints(mappedPoints);
        setDbPersistedCount(serverReadings.length);
        setLastSavedTimestamp(new Date().toLocaleTimeString());
        updateDraft({ staticWeighingPoints: mappedPoints });
      }
    } catch (err) {
      console.warn('Could not load readings from PostgreSQL:', err);
    }
  }, [activeBackendSessionId, backendConnected, e, updateDraft]);

  useEffect(() => {
    loadDatabaseReadings();
  }, [loadDatabaseReadings]);

  // Point management handlers
  const handleUpdatePoint = (id: string, field: keyof StaticWeighingPoint, value: string) => {
    setPoints(prev => {
      const updated = prev.map(pt => (pt.id === id ? { ...pt, [field]: value } : pt));
      updateDraft({ staticWeighingPoints: updated });
      return updated;
    });
  };

  const handleAddPoint = () => {
    const nextNum = points.length + 1;
    const lastLoad = points.length > 0 ? parseFloat(points[points.length - 1].appliedLoad) || 0 : 0;
    const suggestedLoad = (lastLoad + 100 <= maxCapacity ? lastLoad + 100 : lastLoad + 50).toFixed(2);
    const suggestedInd = (parseFloat(suggestedLoad) + 0.04).toFixed(2);

    const newPoint: StaticWeighingPoint = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      pointNumber: nextNum,
      appliedLoad: suggestedLoad,
      indication: suggestedInd,
      additionalLoadDeltaL: (0.5 * e).toFixed(2),
      zeroErrorE0: '0.00',
      isDemo: false,
    };

    const updated = [...points, newPoint];
    setPoints(updated);
    updateDraft({ staticWeighingPoints: updated });
    setToastMessage(`Observation point #${nextNum} added.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDeletePoint = async (id: string) => {
    if (points.length <= 1) {
      setToastMessage('At least one observation point must remain.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // If point was saved in PostgreSQL, delete from backend
    if (id.startsWith('db_rd_')) {
      const readingId = parseInt(id.replace('db_rd_', ''), 10);
      try {
        await readingsApi.deleteReading(readingId);
        setToastMessage(`Reading #${readingId} deleted from PostgreSQL.`);
      } catch (err) {
        console.warn('Could not delete reading from database:', err);
      }
    }

    const filtered = points
      .filter(pt => pt.id !== id)
      .map((pt, idx) => ({ ...pt, pointNumber: idx + 1 }));
    setPoints(filtered);
    updateDraft({ staticWeighingPoints: filtered });
  };

  const handleDuplicatePoint = (id: string) => {
    const target = points.find(pt => pt.id === id);
    if (!target) return;

    const duplicated: StaticWeighingPoint = {
      ...target,
      id: `pt_dup_${Date.now()}`,
      pointNumber: points.length + 1,
    };

    const updated = [...points, duplicated];
    setPoints(updated);
    updateDraft({ staticWeighingPoints: updated });
    setToastMessage(`Point duplicated as #${points.length + 1}.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleResetDemo = () => {
    setPoints(defaultDemoStaticPoints);
    updateDraft({ staticWeighingPoints: defaultDemoStaticPoints });
    setToastMessage('Reset to standard 5-point demo observation dataset.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfirmClear = () => {
    const emptyRow: StaticWeighingPoint = {
      id: `pt_empty_${Date.now()}`,
      pointNumber: 1,
      appliedLoad: '',
      indication: '',
      additionalLoadDeltaL: (0.5 * e).toFixed(2),
      zeroErrorE0: '0.00',
    };
    setPoints([emptyRow]);
    updateDraft({ staticWeighingPoints: [emptyRow] });
    setShowClearModal(false);
    setToastMessage('All observation rows cleared.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDirectionChange = (dir: 'increasing' | 'decreasing') => {
    setTestDirection(dir);
    updateDraft({ testDirection: dir });
  };

  // Persist all valid points to PostgreSQL
  const handleSaveToDatabase = async (): Promise<boolean> => {
    const validPoints = points.filter(
      pt => pt.appliedLoad.trim() !== '' && !isNaN(parseFloat(pt.appliedLoad)) &&
            pt.indication.trim() !== '' && !isNaN(parseFloat(pt.indication))
    );

    if (validPoints.length === 0) {
      setToastMessage('Please enter at least one valid observation with Applied Load and Indication.');
      setTimeout(() => setToastMessage(null), 3500);
      return false;
    }

    setIsSavingDb(true);
    try {
      // Ensure backend session exists
      let sid = activeBackendSessionId;
      if (!sid) {
        await createBackendSession();
        sid = draftSession.backendSessionId || activeBackendSessionId;
      }

      if (!sid) {
        setToastMessage('Saved locally in session draft.');
        setTimeout(() => setToastMessage(null), 3000);
        return true;
      }

      // Fetch existing readings to avoid duplicates
      const existing = await readingsApi.getSessionReadings(sid).catch(() => []);
      const existingRefLoads = new Set(existing.map(r => `${r.reference_value}_${r.indicated_value}`));

      let savedCount = existing.length;
      for (const pt of validPoints) {
        const refVal = parseFloat(pt.appliedLoad);
        const indVal = parseFloat(pt.indication);
        const key = `${refVal}_${indVal}`;

        if (!existingRefLoads.has(key)) {
          // Calculate MPE roughly or pass 0 for statutory calculation in backend
          await readingsApi.createReading({
            session_id: sid,
            test_point: `Weighing Performance (${refVal} ${unit})`,
            reference_value: refVal,
            indicated_value: indVal,
            mpe: 0, // backend automatically computes Table 6 statutory MPE
            unit: unit,
          });
          savedCount++;
        }
      }

      setDbPersistedCount(savedCount);
      setLastSavedTimestamp(new Date().toLocaleTimeString());
      setToastMessage(`✓ Successfully persisted ${savedCount} readings in PostgreSQL.`);
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    } catch (err: any) {
      console.warn('Save to PostgreSQL notice:', err);
      setToastMessage(`Persisted in local session draft (${err.message || 'offline'}).`);
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleProceedToCompliance = async () => {
    const validPoints = points.filter(
      pt => pt.appliedLoad.trim() !== '' && !isNaN(parseFloat(pt.appliedLoad)) &&
            pt.indication.trim() !== '' && !isNaN(parseFloat(pt.indication))
    );

    if (validPoints.length === 0) {
      setToastMessage('Please enter at least one valid observation before proceeding.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    updateDraft({ 
      staticWeighingPoints: points,
      testDirection: testDirection 
    });

    // Auto-save to database prior to advancing
    await handleSaveToDatabase();

    if (onContinue) {
      onContinue();
    } else {
      proceedToStep(4);
      setCurrentView('compliance');
    }
  };

  const handleGoBack = () => {
    if (onBack) {
      onBack();
    } else {
      proceedToStep(2);
      setCurrentView('test-session');
    }
  };

  // Metrics
  const filledPointsCount = points.filter(
    pt => pt.appliedLoad.trim() !== '' && pt.indication.trim() !== ''
  ).length;

  const maxTestedLoad = useMemo(() => {
    const validLoads = points
      .map(p => parseFloat(p.appliedLoad))
      .filter(l => !isNaN(l) && l > 0);
    return validLoads.length > 0 ? Math.max(...validLoads) : null;
  }, [points]);

  return (
    <div className="space-y-space-md">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant shadow-elevated text-primary text-body-sm animate-fade-in">
          <span className="material-symbols-outlined text-[18px] text-secondary">info</span>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-dialog border border-outline-variant/30 p-space-lg max-w-md w-full space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-error">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="font-headline-sm text-headline-sm font-bold">Clear All Observations?</h3>
            </div>
            <p className="text-body-md text-on-surface-variant">
              This will remove all currently recorded observation points from this test session. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setShowClearModal(false)} 
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmClear} 
                className="btn-primary text-xs !bg-error hover:!bg-error/90 !text-white"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Context Summary Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1.5">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold uppercase tracking-wider">
                STEP 3 OF 6 // OBSERVATION &amp; DATA ENTRY
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                OIML R-76 CLAUSE 3.5.1
              </span>
              {databaseConnected && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-[11px] font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
                  POSTGRESQL READINGS ACTIVE
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              Observation &amp; Measurement Data Entry
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Record applied loads and observed indications. Error calculations ($E = I - L$) and statutory MPE limits are computed in real time.
            </p>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSavingDb}
              className="btn-secondary text-xs h-[42px] px-4 font-semibold"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">save</span>
              {isSavingDb ? 'Saving to Database...' : 'Save to PostgreSQL'}
            </button>
            <button
              type="button"
              onClick={handleProceedToCompliance}
              className="btn-primary text-xs h-[42px] px-5 font-semibold"
            >
              Proceed to Compliance Engine →
            </button>
          </div>
        </div>

        {/* Metrological Specifications Pill Bar */}
        <div className="mt-space-md pt-space-md border-t border-outline-variant/30 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-sm font-mono text-xs">
          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Instrument</span>
            <span className="font-bold text-primary truncate block" title={`${draftSession.manufacturer} ${draftSession.model}`}>
              {draftSession.manufacturer} {draftSession.model}
            </span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Accuracy Class</span>
            <span className="font-bold text-secondary text-sm">Class {accuracyClass}</span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Max Capacity</span>
            <span className="font-bold text-primary">{maxCapacity} {unit}</span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Scale Interval (e / d)</span>
            <span className="font-bold text-secondary">{e} / {d} {unit}</span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Resolution (n)</span>
            <span className="font-bold text-primary">{calculatedN.toLocaleString()} e</span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">PostgreSQL Status</span>
            <span className="font-bold text-on-tertiary-container flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
              {dbPersistedCount > 0 ? `${dbPersistedCount} in DB` : 'Draft Ready'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Main Work Area: Grid + Sidebars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        {/* Left / Center: Observation Grid (8 or 9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-space-sm">
          {/* Table Toolbar */}
          <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-card border border-outline-variant/20 flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="font-label-mono-sm text-xs text-outline uppercase font-semibold pl-2">
                TEST DIRECTION:
              </span>
              <div className="inline-flex rounded-lg bg-surface-container p-0.5 border border-outline-variant/30 text-xs">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('increasing')}
                  className={`px-3 py-1 rounded-md transition-all font-semibold ${
                    testDirection === 'increasing'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  ▲ Increasing Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('decreasing')}
                  className={`px-3 py-1 rounded-md transition-all font-semibold ${
                    testDirection === 'decreasing'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  ▼ Decreasing Load
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddPoint}
                className="btn-secondary text-xs h-[34px] px-3 font-semibold text-secondary hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                + Add Point
              </button>
            </div>

            <div className="flex items-center gap-space-xs flex-wrap">
              <button
                type="button"
                onClick={handleResetDemo}
                className="px-2.5 py-1 text-xs text-outline hover:text-primary rounded hover:bg-surface-container transition-colors"
                title="Populate 5 standard OIML demonstration points"
              >
                Reset Standard Points
              </button>
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="px-2.5 py-1 text-xs text-error hover:bg-error-container/20 rounded transition-colors"
                title="Clear all rows"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* TanStack Observation Grid */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 overflow-hidden">
            <ObservationGrid
              points={points}
              unit={unit}
              maxCapacity={maxCapacity}
              minCapacity={minCapacity}
              verificationScaleInterval_e={e}
              accuracyClass={accuracyClass}
              onUpdatePoint={handleUpdatePoint}
              onDeletePoint={handleDeletePoint}
              onDuplicatePoint={handleDuplicatePoint}
            />
          </div>
        </div>

        {/* Right Sidebar: Context Cards (4 or 3 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-space-md">
          {/* Card 1: Session Progress Summary */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md space-y-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider">OBSERVATION METRICS</span>
              <span className="material-symbols-outlined text-[18px] text-primary">speed</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Active Session</span>
                <span className="font-mono font-bold text-primary">{draftSession.sessionId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Direction</span>
                <span className="font-semibold text-secondary capitalize">{testDirection}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Recorded Points</span>
                <span className="font-bold text-primary font-mono">{points.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Completed Points</span>
                <span className="font-bold text-on-tertiary-container font-mono">{filledPointsCount} / {points.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Peak Test Load</span>
                <span className="font-bold text-primary font-mono">{maxTestedLoad !== null ? `${maxTestedLoad} ${unit}` : '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">PostgreSQL Persistence</span>
                <span className="px-1.5 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-mono text-[10px] font-bold">
                  {dbPersistedCount > 0 ? `${dbPersistedCount} Stored` : 'Pending Commit'}
                </span>
              </div>
            </div>

            {lastSavedTimestamp && (
              <div className="pt-1 text-[10px] text-outline text-right font-mono">
                Last DB Sync: {lastSavedTimestamp}
              </div>
            )}
          </div>

          {/* Card 2: OIML R-76 Statutory Formulas Reference */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md space-y-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider">OIML R-76 FORMULAS</span>
              <span className="material-symbols-outlined text-[18px] text-primary">functions</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-secondary font-bold">E = I − L</div>
                <div className="text-outline text-[10px]">Error of indication (Clause 3.5.1)</div>
              </div>

              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-secondary font-bold">P = I + 0.5e − ΔL</div>
                <div className="text-outline text-[10px]">Turning-point indication (A.4.4.3)</div>
              </div>

              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-primary font-bold">m = L / e</div>
                <div className="text-outline text-[10px]">Verification scale interval index</div>
              </div>
            </div>
          </div>

          {/* Card 3: Class MPE Step Limits */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md space-y-2">
            <div className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider border-b border-outline-variant/30 pb-2">
              MPE TABLE 6 (CLASS {accuracyClass})
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-outline font-mono">0 ≤ m ≤ 5,000</span>
                <span className="font-bold text-primary font-mono">±0.5 e (±{(0.5 * e).toFixed(3)} {unit})</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-outline font-mono">5,000 &lt; m ≤ 20,000</span>
                <span className="font-bold text-primary font-mono">±1.0 e (±{(1.0 * e).toFixed(3)} {unit})</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-outline font-mono">20,000 &lt; m ≤ 100,000</span>
                <span className="font-bold text-primary font-mono">±1.5 e (±{(1.5 * e).toFixed(3)} {unit})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-card border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <button
          type="button"
          onClick={handleGoBack}
          className="btn-secondary text-xs h-[42px] justify-center"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          ← Back to Test Session
        </button>

        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={isSavingDb}
            className="btn-secondary text-xs h-[42px] justify-center font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save to PostgreSQL
          </button>
          <button
            type="button"
            onClick={handleProceedToCompliance}
            className="btn-primary text-xs h-[42px] justify-center px-6 font-semibold"
          >
            Proceed to Compliance Engine →
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
