import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVerification } from '../context/VerificationContext';
import { ObservationGrid } from '../components/ObservationGrid';
import { readingsApi } from '../services/api';
import type { StaticWeighingPoint } from '../types';
import { defaultDemoStaticPoints } from '../context/VerificationContext';
import { getMpeForLoad } from '../utils/oimlMpe';

interface ObservationsViewProps {
  onBack?: () => void;
  onContinue?: () => void;
}

export const ObservationsView: React.FC<ObservationsViewProps> = ({ onBack, onContinue }) => {
  const { 
    draftSession, 
    updateDraft, 
    setCurrentView,
    activeBackendSessionId,
    backendConnected,
    databaseConnected,
  } = useVerification();

  // Local state initialized from draftSession.staticWeighingPoints or defaults
  const [points, setPoints] = useState<StaticWeighingPoint[]>(() => {
    if (draftSession.staticWeighingPoints && draftSession.staticWeighingPoints.length > 0) {
      return draftSession.staticWeighingPoints;
    }
    return defaultDemoStaticPoints;
  });

  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

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

  // Keep points in sync if updated externally (e.g. from Data Acquisition page)
  useEffect(() => {
    if (draftSession.staticWeighingPoints && draftSession.staticWeighingPoints.length > 0) {
      setPoints(draftSession.staticWeighingPoints);
    }
  }, [draftSession.staticWeighingPoints]);

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
          source: 'MANUAL',
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

  // Point management handlers — all stable via useCallback + functional setState
  const handleUpdatePoint = useCallback((id: string, field: keyof StaticWeighingPoint, value: string) => {
    setPoints(prev => {
      const updated = prev.map(pt => {
        if (pt.id !== id) return pt;
        if (field === 'indication') {
          return { ...pt, [field]: value, source: 'MANUAL' as const };
        }
        return { ...pt, [field]: value };
      });
      updateDraft({ staticWeighingPoints: updated });
      return updated;
    });
  }, [updateDraft]);

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
      source: 'MANUAL',
    };

    const updated = [...points, newPoint];
    setPoints(updated);
    updateDraft({ staticWeighingPoints: updated });
    setToastMessage(`Observation point #${nextNum} added.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDeletePoint = useCallback(async (id: string) => {
    if (pointsRef.current.length <= 1) {
      setToastMessage('At least one observation point must remain.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (id.startsWith('db_rd_')) {
      const readingId = parseInt(id.replace('db_rd_', ''), 10);
      try {
        await readingsApi.deleteReading(readingId);
        setToastMessage(`Reading #${readingId} deleted from PostgreSQL.`);
      } catch (err) {
        console.warn('Could not delete reading from database:', err);
      }
    }

    setPoints(prev => {
      const filtered = prev.filter(pt => pt.id !== id).map((pt, idx) => ({ ...pt, pointNumber: idx + 1 }));
      updateDraft({ staticWeighingPoints: filtered });
      return filtered;
    });
    setToastMessage('Point removed.');
    setTimeout(() => setToastMessage(null), 2500);
  }, [updateDraft]);

  const handleDuplicatePoint = (id: string) => {
    const src = points.find(pt => pt.id === id);
    if (!src) return;
    const nextNum = points.length + 1;
    const duplicated: StaticWeighingPoint = {
      ...src,
      id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      pointNumber: nextNum,
      source: src.source || 'MANUAL',
    };
    const updated = [...points, duplicated];
    setPoints(updated);
    updateDraft({ staticWeighingPoints: updated });
    setToastMessage(`Duplicated Point #${src.pointNumber} as #${nextNum}.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleResetDemo = () => {
    setPoints(defaultDemoStaticPoints);
    updateDraft({ staticWeighingPoints: defaultDemoStaticPoints });
    setToastMessage('Reset to standard 5-point demo observation dataset.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfirmClear = () => {
    const singleEmptyPoint: StaticWeighingPoint = {
      id: `pt_${Date.now()}_init`,
      pointNumber: 1,
      appliedLoad: '0.00',
      indication: '',
      additionalLoadDeltaL: (0.5 * e).toFixed(2),
      zeroErrorE0: '0.00',
      isDemo: false,
      source: 'MANUAL',
    };
    setPoints([singleEmptyPoint]);
    updateDraft({ staticWeighingPoints: [singleEmptyPoint] });
    setShowClearModal(false);
    setToastMessage('All observation rows cleared.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDirectionChange = (dir: 'increasing' | 'decreasing') => {
    setTestDirection(dir);
    updateDraft({ testDirection: dir });
  };

  const handleSaveToDatabase = async () => {
    if (!activeBackendSessionId) {
      setToastMessage('No active backend session found. Please create or load a session first.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const validPoints = points.filter(
      pt => pt.appliedLoad.trim() !== '' && pt.indication.trim() !== '' && !isNaN(parseFloat(pt.appliedLoad)) && !isNaN(parseFloat(pt.indication))
    );

    if (validPoints.length === 0) {
      setToastMessage('Please enter at least one valid observation with Applied Load and Indication.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setIsSavingDb(true);
    let savedCount = 0;
    try {
      for (const pt of validPoints) {
        if (!pt.id.startsWith('db_rd_')) {
          const loadNum = parseFloat(pt.appliedLoad);
          const indNum = parseFloat(pt.indication);
          const mpeVal = getMpeForLoad(loadNum, e, accuracyClass, unit).limitValue;
          await readingsApi.createReading({
            session_id: activeBackendSessionId,
            test_point: `Point ${pt.pointNumber} (${loadNum}${unit})`,
            reference_value: loadNum,
            indicated_value: indNum,
            mpe: mpeVal,
            unit,
          });
          savedCount++;
        }
      }
      await loadDatabaseReadings();
      setToastMessage(`Successfully persisted ${savedCount} observation points to PostgreSQL database.`);
    } catch (err: unknown) {
      const error = err as Error;
      setToastMessage(`Error saving readings to database: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSavingDb(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleProceedToCompliance = async () => {
    const validPoints = points.filter(
      pt => pt.appliedLoad.trim() !== '' && pt.indication.trim() !== '' && !isNaN(parseFloat(pt.appliedLoad)) && !isNaN(parseFloat(pt.indication))
    );

    if (validPoints.length === 0) {
      setToastMessage('Please enter at least one valid observation before proceeding.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (activeBackendSessionId && backendConnected) {
      try {
        await handleSaveToDatabase();
      } catch {
        // Proceed even if auto-save had an issue
      }
    }

    if (onContinue) {
      onContinue();
    } else {
      setCurrentView('compliance');
    }
  };

  const handleGoBack = () => {
    if (onBack) {
      onBack();
    } else {
      setCurrentView('test-session');
    }
  };

  // Metrics summary
  const filledPointsCount = useMemo(() => {
    return points.filter(p => p.appliedLoad.trim() !== '' && p.indication.trim() !== '').length;
  }, [points]);

  const maxTestedLoad = useMemo(() => {
    const loads = points.map(p => parseFloat(p.appliedLoad)).filter(l => !isNaN(l));
    return loads.length > 0 ? Math.max(...loads) : null;
  }, [points]);

  const usbCapturedCount = useMemo(() => {
    return points.filter(p => p.source === 'USB' || p.source === 'RS-232').length;
  }, [points]);

  return (
    <div className="space-y-space-md max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white text-xs px-4 py-3 rounded-xl shadow-card flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-card border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center gap-space-sm text-error">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="font-headline-sm text-headline-sm font-bold">Clear All Observations?</h3>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              This will remove all currently recorded observation points from this test session. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-space-sm pt-space-xs">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="btn-secondary text-xs h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="btn-primary bg-error hover:bg-error/90 text-white text-xs h-[36px]"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Context Summary Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-card border border-outline-variant/40">
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
              onClick={() => setCurrentView('data-acquisition')}
              className="btn-secondary text-xs h-[42px] px-3.5 font-semibold text-primary border-primary/30 hover:bg-[#EEEBFF]"
              title="Open hardware acquisition console to connect USB / RS-232 scale"
            >
              <span className="material-symbols-outlined text-[18px]">cable</span>
              Acquire via Scale (USB/RS-232)
            </button>
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
        {/* Left / Center: Observation Grid */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-space-sm">
          {/* Table Toolbar */}
          <div className="bg-surface-container-lowest p-space-sm rounded-2xl shadow-card border border-outline-variant/40 flex flex-wrap items-center justify-between gap-space-sm">
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
              {usbCapturedCount > 0 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#EEEBFF] text-primary font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">cable</span>
                  {usbCapturedCount} via USB
                </span>
              )}
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
          <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 overflow-hidden">
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

        {/* Right Sidebar: Context Cards */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-space-md">
          {/* Card 1: Session Progress Summary */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-md space-y-space-sm">
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
          <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-md space-y-space-sm">
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
          <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-md space-y-2">
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
      <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-card border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
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
