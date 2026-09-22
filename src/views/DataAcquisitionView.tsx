import React, { useState, useMemo } from 'react';
import { useVerification } from '../context/VerificationContext';
import { ObservationGrid } from '../components/ObservationGrid';
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
    setCurrentView 
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

  // Metrological constants from Setup & Lab
  const unit = draftSession.unit || 'g';
  const maxCapacity = draftSession.maxCapacity || 2100;
  const minCapacity = draftSession.minCapacity || 0.5;
  const e = draftSession.verificationScaleInterval_e || 0.1;
  const d = draftSession.actualScaleInterval_d || 0.01;
  const accuracyClass = draftSession.accuracyClass || 'II';
  const calculatedN = useMemo(() => {
    return e > 0 ? Math.round(maxCapacity / e) : 0;
  }, [maxCapacity, e]);

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
    // Suggest a realistic incremented load
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

  const handleDeletePoint = (id: string) => {
    if (points.length <= 1) {
      setToastMessage('At least one observation point must remain.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
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

  const handleSaveDraft = () => {
    updateDraft({ 
      staticWeighingPoints: points,
      testDirection: testDirection 
    });
    setToastMessage('Observation draft saved successfully in local session state.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleProceedToCompliance = () => {
    // Validate that at least one point has valid applied load and indication
    const validPoints = points.filter(
      pt => pt.appliedLoad.trim() !== '' && !isNaN(parseFloat(pt.appliedLoad)) &&
            pt.indication.trim() !== '' && !isNaN(parseFloat(pt.indication))
    );

    if (validPoints.length === 0) {
      setToastMessage('Please enter at least one valid observation (Applied Load and Indication).');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    updateDraft({ 
      staticWeighingPoints: points,
      testDirection: testDirection 
    });

    if (onContinue) {
      onContinue();
    } else {
      proceedToStep(3);
      setCurrentView('compliance');
    }
  };

  const handleGoBack = () => {
    if (onBack) {
      onBack();
    } else {
      proceedToStep(1);
      setCurrentView('new-test-session');
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

      {/* 1. Context Summary Header (Carried Forward from Setup & Lab) */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1.5">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-semibold uppercase tracking-wider">
                STEP 2 // OBSERVATION DATA ENTRY
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                SESSION: {draftSession.sessionId || 'APP-2026-0899'}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-mono-sm text-[11px] font-bold uppercase">
                OIML R-76-1:2006 (E)
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-[11px] font-semibold uppercase">
                CLASS {accuracyClass}
              </span>
            </div>
            
            <h1 className="font-display-md text-display-md text-primary tracking-tight font-bold">
              Static Weighing Performance
            </h1>
            
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Clause A.4.4 — Test Data Recording for {draftSession.manufacturer || 'RADWAG'} {draftSession.model || 'PS 2100.R2'} (S/N: {draftSession.serialNumber || '597226'})
            </p>
          </div>

          {/* Instrument Context Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
              <span className="text-outline block text-[10px] uppercase font-mono">Max Capacity</span>
              <span className="font-bold text-primary metrology-mono">{maxCapacity} {unit}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
              <span className="text-outline block text-[10px] uppercase font-mono">Min Capacity</span>
              <span className="font-bold text-primary metrology-mono">{minCapacity} {unit}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
              <span className="text-outline block text-[10px] uppercase font-mono">Scale Intervals</span>
              <span className="font-bold text-primary metrology-mono">e = {e} {unit} | d = {d} {unit}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
              <span className="text-outline block text-[10px] uppercase font-mono">Divisions (n)</span>
              <span className="font-bold text-secondary metrology-mono">{calculatedN > 0 ? `${calculatedN.toLocaleString()} div` : '--'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Test Information & Direction Selector */}
      <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md flex-wrap">
            <div className="flex items-center gap-2">
              <span className="section-header-bar"></span>
              <div>
                <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider block">TEST RUN DIRECTION</span>
                <span className="font-body-md text-xs font-semibold text-primary">Clause A.4.4.1 Test Cycle</span>
              </div>
            </div>

            {/* Test Direction Selector per master specification */}
            <div className="inline-flex rounded-lg border border-outline-variant/40 p-1 bg-surface-container-low">
              <button
                type="button"
                onClick={() => handleDirectionChange('increasing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  testDirection === 'increasing'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                Increasing Load (Ascending)
              </button>
              <button
                type="button"
                onClick={() => handleDirectionChange('decreasing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  testDirection === 'decreasing'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">trending_down</span>
                Decreasing Load (Descending)
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-xs font-label-mono-sm text-outline">
            <div>
              <span className="text-secondary font-bold text-sm metrology-mono">{points.length}</span> Points Configured
            </div>
            <div className="h-4 w-px bg-outline-variant/40" />
            <div>
              <span className="text-primary font-bold text-sm metrology-mono">{filledPointsCount}</span> / {points.length} Recorded
            </div>
            <div className="h-4 w-px bg-outline-variant/40" />
            <div>
              Span: <span className="font-bold text-primary metrology-mono">{maxTestedLoad ? `${maxTestedLoad} ${unit}` : '--'}</span>
            </div>
          </div>
        </div>

        {/* Demo Data Banner */}
        <div className="mt-space-sm p-2.5 rounded-lg bg-secondary-fixed/20 border border-secondary/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-[18px] text-secondary">science</span>
            <div>
              <span className="font-bold text-secondary uppercase font-label-mono-sm mr-1.5">[DEMO DATASET]</span>
              <span>Pre-loaded with 5 realistic Class II observation points (100g – 500g) for prototype evaluation.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDemo}
            className="text-[11px] font-bold text-secondary hover:underline flex items-center gap-1 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">history</span>
            Reset Demo Points
          </button>
        </div>
      </section>

      {/* Main Grid & Side Summary Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-space-md items-start">
        
        {/* Main Column: Observation Table (TanStack Table) */}
        <div className="xl:col-span-3 space-y-space-sm">
          {/* Table Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-lowest p-space-sm px-space-md rounded-xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-label-mono-sm text-xs font-bold text-primary uppercase">
                Metrological Observation Grid
              </span>
              <span className="text-[11px] text-outline font-mono">
                (TanStack Table Engine)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAddPoint}
                className="btn-primary text-xs h-[34px] px-3"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                + Add Observation
              </button>
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="btn-secondary text-xs h-[34px] px-3 !text-error hover:!bg-error/5"
              >
                <span className="material-symbols-outlined text-[16px]">clear_all</span>
                Clear All
              </button>
            </div>
          </div>

          {/* TanStack Table Grid */}
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

          {/* Legend / Guidance Footer */}
          <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-[11px] text-outline space-y-1">
            <div className="flex items-center gap-4 flex-wrap font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-surface-container-lowest border border-outline-variant/50 inline-block"></span>
                <span>White: Laboratory Officer Input</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-surface-container-low/80 border border-outline-variant/40 inline-block"></span>
                <span>Shaded: Calculated Prior-Rounding (P) &amp; Errors (E, Ec)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary/10 border border-primary/20 inline-block"></span>
                <span>Blue Shaded: Corrected Error Ec = E - E₀</span>
              </div>
            </div>
            <p className="font-body-sm text-on-surface-variant">
              * Per OIML R-76-1 Clause A.4.4.3: Changeover weights (ΔL) are added until the indication changes to the next scale interval. If ΔL is not determined, P equals I.
            </p>
          </div>
        </div>

        {/* Right Column: Observation Summary & Verification Parameters */}
        <div className="xl:col-span-1 space-y-space-md">
          {/* Card 1: Observation Status */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md space-y-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider">TEST RUN STATUS</span>
              <span className="material-symbols-outlined text-[18px] text-secondary">fact_check</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Test Name</span>
                <span className="font-semibold text-primary text-right">Static Weighing</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Clause Reference</span>
                <span className="font-mono text-primary font-bold">OIML R-76 A.4.4</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Test Direction</span>
                <span className="font-semibold text-secondary capitalize">{testDirection}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Observation Points</span>
                <span className="font-bold text-primary metrology-mono">{points.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Completed Points</span>
                <span className="font-bold text-on-tertiary-container metrology-mono">{filledPointsCount} / {points.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                <span className="text-outline">Calculation Status</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container text-outline font-mono text-[10px] font-bold">
                  Pending / Prototype
                </span>
              </div>
            </div>

            {/* Overall Verdict: strictly NOT EVALUATED per specification */}
            <div className="pt-2">
              <div className="text-[11px] font-label-mono-sm text-outline uppercase mb-1">OVERALL VERDICT</div>
              <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-center">
                <div className="font-label-mono-sm text-xs font-bold text-on-surface-variant flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-outline"></span>
                  NOT EVALUATED
                </div>
                <div className="text-[10px] text-outline mt-0.5">
                  Compliance calculated in Step 3
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: OIML R-76 Core Formulas Reference */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md space-y-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider">FORMULA ENGINE REF</span>
              <span className="material-symbols-outlined text-[18px] text-primary">functions</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-secondary font-bold">P = I + 0.5e − ΔL</div>
                <div className="text-outline text-[10px]">Indication prior to rounding (A.4.4.3)</div>
              </div>

              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-secondary font-bold">E = P − L</div>
                <div className="text-outline text-[10px]">Raw error prior to rounding</div>
              </div>

              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-primary font-bold">Ec = E − E₀</div>
                <div className="text-outline text-[10px]">Corrected error relative to no-load</div>
              </div>

              <div className="p-2 rounded bg-surface-container-low/60 font-mono text-[11px]">
                <div className="text-primary font-bold">m = L / e</div>
                <div className="text-outline text-[10px]">Verification interval index for MPE</div>
              </div>
            </div>
          </div>

          {/* Card 3: Class II MPE Step Limits */}
          <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md space-y-2">
            <div className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider border-b border-outline-variant/30 pb-2">
              MPE TABLE 6 (CLASS {accuracyClass})
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-outline font-mono">0 ≤ m ≤ 5,000</span>
                <span className="font-bold text-primary metrology-mono">±0.5 e (±0.05 {unit})</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-outline font-mono">5,000 &lt; m ≤ 20,000</span>
                <span className="font-bold text-primary metrology-mono">±1.0 e (±0.10 {unit})</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-outline font-mono">20,000 &lt; m ≤ 100,000</span>
                <span className="font-bold text-primary metrology-mono">±1.5 e (±0.15 {unit})</span>
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
          ← Back to Setup &amp; Lab
        </button>

        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="btn-secondary text-xs h-[42px] justify-center"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleProceedToCompliance}
            className="btn-primary text-xs h-[42px] justify-center px-6"
          >
            Calculate &amp; Evaluate →
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
