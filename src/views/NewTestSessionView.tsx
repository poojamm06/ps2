import React, { useState, useMemo } from 'react';
import { useVerification } from '../context/VerificationContext';
import { DataAcquisitionView } from './DataAcquisitionView';
import { ComplianceView } from './ComplianceView';
import { ResultsView } from './ResultsView';
import { DigitalReportView } from './DigitalReportView';
import type { InstrumentCategory, ReferenceStandard } from '../types';

/* ==========================================================================
   Phase-1 Core 5-Step Workflow Definition
   Per OIML R-76 Master Specification (DoCA Problem Statement 26035)
   ========================================================================== */
const WORKFLOW_STEPS = [
  { step: 1, label: 'Setup & Lab', icon: 'precision_manufacturing', short: '1. Setup & Lab', desc: 'Application & Laboratory Context' },
  { step: 2, label: 'Observation / Data Entry', icon: 'sensors', short: '2. Observation Data', desc: 'Measurement Observations' },
  { step: 3, label: 'Calculation & Compliance', icon: 'verified_user', short: '3. Compliance', desc: 'OIML R-76 MPE Engine' },
  { step: 4, label: 'Results Summary', icon: 'fact_check', short: '4. Results', desc: 'Statutory Verdict & Performance' },
  { step: 5, label: 'Digital Report', icon: 'description', short: '5. Report', desc: 'Official Verification Certificate' },
];

const MANUFACTURERS = [
  'RADWAG',
  'Mettler-Toledo Inc.',
  'Sartorius AG',
  'Bizerba SE & Co. KG',
  'Minebea Intec GmbH',
  'Avery Weigh-Tronix',
  'Ohaus Corporation',
  'KERN & SOHN GmbH',
  'Cardinal Scale Mfg. Co.',
];

const INSTRUMENT_TYPES = [
  'High-Precision Analytical Balance',
  'Precision Top-Pan Scale',
  'Retail Bench Scale',
  'Industrial Platform Scale',
  'Crane & Suspended Scale',
  'Hopper / Silo Weighing System',
  'Vehicle Weighbridge',
];

const LAB_STATIONS = [
  { id: 'LAB-DE-04', label: 'LAB-DE-04 (Central Legal Metrology Testing Lab)' },
  { id: 'LAB-ND-01', label: 'LAB-ND-01 (National Standards Calibration Facility)' },
  { id: 'LAB-MH-02', label: 'LAB-MH-02 (Regional Legal Metrology Station)' },
  { id: 'LAB-KA-03', label: 'LAB-KA-03 (State Precision Testing Centre)' },
];

export const NewTestSessionView: React.FC = () => {
  const { 
    draftSession, 
    createNewSession, 
    proceedToStep 
  } = useVerification();
  
  const [currentStep, setCurrentStep] = useState<number>(draftSession.currentStep || 1);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const handleStepClick = (stepNum: number) => {
    setCurrentStep(stepNum);
    proceedToStep(stepNum);
  };

  const handleSaveAndContinue = () => {
    // Advances from Step 1 to Step 2
    setCurrentStep(2);
    proceedToStep(2);
    setSavedToast('Setup & laboratory context saved. Proceeding to Observation / Data Entry.');
    setTimeout(() => setSavedToast(null), 3500);
  };

  const handleBack = () => {
    const prev = Math.max(1, currentStep - 1);
    setCurrentStep(prev);
    proceedToStep(prev);
  };

  const handleForward = () => {
    const next = Math.min(5, currentStep + 1);
    setCurrentStep(next);
    proceedToStep(next);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 2:
        return (
          <DataAcquisitionView 
            onBack={handleBack} 
            onContinue={() => {
              setCurrentStep(3);
              proceedToStep(3);
            }} 
          />
        );
      case 3:
        return <ComplianceView />;
      case 4:
        return <ResultsView />;
      case 5:
        return <DigitalReportView />;
      default:
        return <SetupLabView onContinue={handleSaveAndContinue} />;
    }
  };

  return (
    <div className="space-y-space-md">
      {/* Workflow Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-semibold uppercase tracking-wider">
                OIML R-76-1:2006 (E)
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-[11px] font-semibold uppercase">
                SESSION: {draftSession.sessionId || 'APP-2026-0899'}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                CLASS {draftSession.accuracyClass || 'II'}
              </span>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-mono-sm text-[11px] font-bold uppercase">
                PHASE-1 CORE PROTOTYPE
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight font-bold">
              NAWI Verification Workflow
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              OIML R-76-Based Verification Workflow — Instrument Evaluation &amp; Laboratory Context
            </p>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <button 
              type="button" 
              onClick={() => {
                createNewSession();
                setCurrentStep(1);
              }} 
              className="btn-secondary text-xs"
            >
              <span className="material-symbols-outlined text-[15px]">add_circle</span>
              + New Session
            </button>
            {currentStep > 1 && (
              <button type="button" onClick={handleBack} className="btn-secondary text-xs">
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                Previous Step
              </button>
            )}
            {currentStep < 5 && currentStep > 1 && (
              <button type="button" onClick={handleForward} className="btn-primary text-xs">
                Step {currentStep + 1}
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        {savedToast && (
          <div className="mt-space-sm flex items-center gap-2 p-2 rounded-lg bg-tertiary-fixed/20 border border-on-tertiary-container/30 text-on-surface text-body-sm animate-fade-in">
            <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">check_circle</span>
            <span>{savedToast}</span>
          </div>
        )}
      </section>

      {/* 5-Step Phase-1 Stepper */}
      <nav aria-label="Verification Workflow Stages" className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md">
        <div className="flex items-center justify-between overflow-x-auto gap-2">
          {WORKFLOW_STEPS.map((stepItem, idx) => {
            const isDone = stepItem.step < currentStep;
            const isActive = stepItem.step === currentStep;
            return (
              <React.Fragment key={stepItem.step}>
                <button
                  type="button"
                  onClick={() => handleStepClick(stepItem.step)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all flex-shrink-0 text-left ${
                    isActive 
                      ? 'bg-primary-container text-on-primary shadow-sm ring-1 ring-primary/20' 
                      : 'hover:bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    isDone 
                      ? 'bg-on-tertiary-container text-white' 
                      : isActive 
                      ? 'bg-secondary text-on-secondary' 
                      : 'bg-surface-container text-outline'
                  }`}>
                    {isDone ? (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    ) : (
                      <span>{stepItem.step}</span>
                    )}
                  </div>
                  <div>
                    <div className={`font-label-mono-sm text-[11px] font-bold whitespace-nowrap ${
                      isActive ? 'text-on-primary' : isDone ? 'text-on-tertiary-container' : 'text-primary'
                    }`}>
                      {stepItem.label}
                    </div>
                    <div className={`font-body-sm text-[10px] hidden sm:block ${
                      isActive ? 'text-on-primary/80' : 'text-outline'
                    }`}>
                      {stepItem.desc}
                    </div>
                  </div>
                </button>

                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[16px] transition-colors ${
                    stepItem.step < currentStep ? 'bg-on-tertiary-container' : 'bg-outline-variant/40'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* Step View Render */}
      {renderStepContent()}
    </div>
  );
};

/* ==========================================================================
   Step 1: Setup & Lab View
   Sections A, B, C, D, E per Master Specification
   ========================================================================== */
interface SetupLabViewProps {
  onContinue: () => void;
}

const SetupLabView: React.FC<SetupLabViewProps> = ({ onContinue }) => {
  const { draftSession, updateDraft, instruments } = useVerification();

  // Registry selection mode
  const [registryMode, setRegistryMode] = useState<'existing' | 'new'>('new');

  // Collapsible Additional Metrological Parameters
  const [showAdditionalParams, setShowAdditionalParams] = useState<boolean>(false);

  // New Reference Standard Modal / Inline Form
  const [showAddStdModal, setShowAddStdModal] = useState<boolean>(false);
  const [newStdType, setNewStdType] = useState<ReferenceStandard['equipmentType']>('Weights');
  const [newStdModel, setNewStdModel] = useState<string>('');
  const [newStdSerial, setNewStdSerial] = useState<string>('');
  const [newStdGrade, setNewStdGrade] = useState<string>('E2');
  const [newStdCert, setNewStdCert] = useState<string>('');
  const [newStdDate, setNewStdDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newStdUncertainty, setNewStdUncertainty] = useState<string>('');

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Calculated n = Max / e
  const calculatedN = useMemo(() => {
    if (draftSession.maxCapacity && draftSession.verificationScaleInterval_e && draftSession.verificationScaleInterval_e > 0) {
      return Math.round(draftSession.maxCapacity / draftSession.verificationScaleInterval_e);
    }
    return 0;
  }, [draftSession.maxCapacity, draftSession.verificationScaleInterval_e]);

  // Derived class requirements for summary & limits preview
  const classLimitsText = useMemo(() => {
    const e = draftSession.verificationScaleInterval_e || 0.1;
    const unit = draftSession.unit || 'g';
    const cls = draftSession.accuracyClass || 'II';

    switch (cls) {
      case 'I':
        return [
          `0 ≤ m ≤ 50,000e: ±0.5e (±${(0.5 * e).toFixed(4)} ${unit})`,
          `50,000e < m ≤ 200,000e: ±1.0e (±${(1.0 * e).toFixed(4)} ${unit})`,
          `m > 200,000e: ±1.5e (±${(1.5 * e).toFixed(4)} ${unit})`,
        ];
      case 'II':
        return [
          `0 ≤ m ≤ 5,000e: ±0.5e (±${(0.5 * e).toFixed(4)} ${unit})`,
          `5,000e < m ≤ 20,000e: ±1.0e (±${(1.0 * e).toFixed(4)} ${unit})`,
          `m > 20,000e: ±1.5e (±${(1.5 * e).toFixed(4)} ${unit})`,
        ];
      case 'III':
        return [
          `0 ≤ m ≤ 500e: ±0.5e (±${(0.5 * e).toFixed(4)} ${unit})`,
          `500e < m ≤ 2,000e: ±1.0e (±${(1.0 * e).toFixed(4)} ${unit})`,
          `m > 2,000e: ±1.5e (±${(1.5 * e).toFixed(4)} ${unit})`,
        ];
      case 'IV':
        return [
          `0 ≤ m ≤ 50e: ±0.5e (±${(0.5 * e).toFixed(4)} ${unit})`,
          `50e < m ≤ 200e: ±1.0e (±${(1.0 * e).toFixed(4)} ${unit})`,
          `m > 200e: ±1.5e (±${(1.5 * e).toFixed(4)} ${unit})`,
        ];
      default:
        return [];
    }
  }, [draftSession.accuracyClass, draftSession.verificationScaleInterval_e, draftSession.unit]);

  // Handle selecting an existing instrument
  const handleSelectExistingInstrument = (serialNumber: string) => {
    const found = instruments.find(i => i.serialNumber === serialNumber);
    if (found) {
      updateDraft({
        manufacturer: found.manufacturer,
        model: found.model,
        serialNumber: found.serialNumber,
        accuracyClass: found.accuracyClass,
        maxCapacity: found.maxCapacity,
        minCapacity: found.minCapacity,
        unit: found.unit,
        verificationScaleInterval_e: found.verificationScaleInterval_e,
        actualScaleInterval_d: found.actualScaleInterval_d,
        instrumentType: found.instrumentType,
        softwareApplicable: found.softwareApplicable,
        testLocation: found.location || draftSession.testLocation,
      });
    }
  };

  // Add Reference Standard to list
  const handleAddStandard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStdModel.trim() || !newStdSerial.trim()) return;

    const newStd: ReferenceStandard = {
      id: `std_${Date.now()}`,
      equipmentType: newStdType,
      modelNumber: newStdModel.trim(),
      serialNumber: newStdSerial.trim(),
      accuracyClassOrGrade: newStdGrade,
      calibrationCertNumber: newStdCert.trim() || `CAL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      calibrationDate: newStdDate,
      measurementUncertainty: newStdUncertainty.trim() || 'U ≤ ⅓ MPE',
    };

    const currentList = draftSession.referenceStandards || [];
    const updated = [...currentList, newStd];
    updateDraft({
      referenceStandards: updated,
      standardsUsed: updated.map(s => `${s.modelNumber} [S/N: ${s.serialNumber}, ${s.accuracyClassOrGrade}]`).join('; '),
    });

    // Reset form
    setNewStdModel('');
    setNewStdSerial('');
    setNewStdCert('');
    setNewStdUncertainty('');
    setShowAddStdModal(false);
  };

  const handleRemoveStandard = (id: string) => {
    const updated = (draftSession.referenceStandards || []).filter(s => s.id !== id);
    updateDraft({
      referenceStandards: updated,
      standardsUsed: updated.map(s => `${s.modelNumber} [S/N: ${s.serialNumber}, ${s.accuracyClassOrGrade}]`).join('; '),
    });
  };

  // Primary action validation & continue
  const handleSaveAndProceed = () => {
    const errors: string[] = [];

    if (!draftSession.sessionId?.trim()) errors.push('Application / Session ID is required.');
    if (!draftSession.verificationDate) errors.push('Evaluation date is required.');
    if (!draftSession.verificationOfficer?.trim()) errors.push('Observer / Evaluator name is required.');
    if (!draftSession.testLocation?.trim()) errors.push('Test location / Laboratory station is required.');

    if (!draftSession.manufacturer?.trim()) errors.push('Instrument Manufacturer is required.');
    if (!draftSession.model?.trim()) errors.push('Model / Pattern Designation is required.');
    if (!draftSession.serialNumber?.trim()) errors.push('Physical Serial Number is required.');

    if (!draftSession.maxCapacity || draftSession.maxCapacity <= 0) {
      errors.push('Maximum Capacity (Max) must be greater than 0.');
    }
    if (!draftSession.minCapacity || draftSession.minCapacity <= 0) {
      errors.push('Minimum Capacity (Min) must be greater than 0.');
    }
    if (draftSession.maxCapacity && draftSession.minCapacity && draftSession.maxCapacity <= draftSession.minCapacity) {
      errors.push('Maximum Capacity (Max) must be strictly greater than Minimum Capacity (Min).');
    }
    if (!draftSession.verificationScaleInterval_e || draftSession.verificationScaleInterval_e <= 0) {
      errors.push('Verification Scale Interval (e) must be greater than 0.');
    }
    if (!draftSession.actualScaleInterval_d || draftSession.actualScaleInterval_d <= 0) {
      errors.push('Actual Scale Interval (d) must be greater than 0.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    onContinue();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md items-start">
      {/* Left 2 Cols: Laboratory Setup Form */}
      <div className="lg:col-span-2 space-y-space-md">
        {/* Purpose Banner */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-card border-l-4 border-primary border border-outline-variant/20 flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0 mt-0.5">assignment_turned_in</span>
          <div>
            <h2 className="font-title-sm text-title-sm text-primary font-bold">
              Laboratory Setup &amp; Test Context
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Set up the instrument evaluation, metrological parameters, traceable reference standards, and laboratory conditions before entering observation data.
            </p>
          </div>
        </div>

        {/* Validation Errors Notice */}
        {validationErrors.length > 0 && (
          <div className="bg-error-container/20 border border-error/30 rounded-xl p-space-md text-on-surface text-body-sm space-y-1">
            <div className="flex items-center gap-2 font-bold text-error">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>Please resolve the following setup validation errors:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-error pl-2">
              {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* ==================================================================
            SECTION A — APPLICATION / TEST INFORMATION
            ================================================================== */}
        <section className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg space-y-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-primary" />
              <div>
                <span className="font-label-mono-sm text-[11px] text-outline uppercase font-semibold">SECTION A</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Application &amp; Test Information</h3>
              </div>
            </div>
            <span className="text-xs font-label-mono-sm px-2 py-0.5 rounded bg-surface-container text-outline">
              OIML R-76 Cl. 8.1
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {/* Application / Session ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="nawi-label mb-0">Application / Session ID</label>
                <span className="text-[10px] text-secondary font-label-mono-sm font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  System-Generated
                </span>
              </div>
              <input
                type="text"
                readOnly
                value={draftSession.sessionId || 'APP-2026-0899'}
                className="nawi-input metrology-mono font-bold text-secondary bg-surface-container-low cursor-not-allowed"
                title="System-generated read-only application identifier"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Unique legal metrology application reference</p>
            </div>

            {/* Evaluation / Verification Date */}
            <div>
              <label className="nawi-label">
                Evaluation / Verification Date <span className="text-error">*</span>
              </label>
              <input
                type="date"
                value={draftSession.verificationDate || new Date().toISOString().split('T')[0]}
                onChange={e => updateDraft({ verificationDate: e.target.value })}
                className="nawi-input metrology-mono"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Scheduled or executed laboratory evaluation date</p>
            </div>

            {/* Observer / Evaluator */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="nawi-label mb-0">
                  Observer / Evaluator <span className="text-error">*</span>
                </label>
                <span className="text-[10px] text-secondary font-label-mono-sm font-semibold">Demo Officer</span>
              </div>
              <input
                type="text"
                value={draftSession.verificationOfficer || 'Insp. Helena Vance'}
                onChange={e => updateDraft({ verificationOfficer: e.target.value })}
                className="nawi-input"
                placeholder="e.g. Insp. Helena Vance"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Authorized testing officer or metrology specialist</p>
            </div>

            {/* Test Location / Laboratory */}
            <div>
              <label className="nawi-label">
                Test Location / Laboratory <span className="text-error">*</span>
              </label>
              <select
                value={draftSession.testLocation || 'LAB-DE-04'}
                onChange={e => updateDraft({ testLocation: e.target.value })}
                className="nawi-select font-medium"
              >
                {LAB_STATIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <p className="font-body-sm text-[11px] text-outline mt-1">Accredited testing facility or environmental station</p>
            </div>

            {/* Verification / Evaluation Type */}
            <div className="sm:col-span-2">
              <label className="nawi-label">
                Verification / Evaluation Type <span className="text-error">*</span>
              </label>
              <select
                value={draftSession.verificationType || 'TYPE_EVALUATION'}
                onChange={e => {
                  const val = e.target.value as 'TYPE_EVALUATION' | 'INITIAL_VERIFICATION' | 'IN_SERVICE_VERIFICATION';
                  updateDraft({
                    verificationType: val,
                    testType: val === 'IN_SERVICE_VERIFICATION' ? 'IN_SERVICE_VERIFICATION' : 'INITIAL_VERIFICATION',
                  });
                }}
                className="nawi-select font-semibold"
              >
                <option value="TYPE_EVALUATION">Pattern / Type Evaluation (OIML R-76-1 Annex A — Table 6 MPE)</option>
                <option value="INITIAL_VERIFICATION">Initial Statutory Verification (Clause 3.5.1 — Table 6 MPE)</option>
                <option value="IN_SERVICE_VERIFICATION">In-Service / Subsequent Verification (Clause 3.5.1 — 2 × Table 6 MPE)</option>
              </select>
              <p className="font-body-sm text-[11px] text-outline mt-1">
                Defines statutory tolerance tiers: Type evaluation &amp; Initial verification apply Table 6 MPE; In-Service verification applies 2× Table 6 MPE.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION B — INSTRUMENT IDENTITY
            ================================================================== */}
        <section className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg space-y-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-space-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-secondary" />
              <div>
                <span className="font-label-mono-sm text-[11px] text-outline uppercase font-semibold">SECTION B</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Instrument Identity</h3>
              </div>
            </div>

            {/* Register New vs Select Existing Toggle */}
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setRegistryMode('new')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  registryMode === 'new'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Register New Instrument
              </button>
              <button
                type="button"
                onClick={() => setRegistryMode('existing')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  registryMode === 'existing'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Select Existing Instrument ({instruments.length})
              </button>
            </div>
          </div>

          {/* Quick Selector Dropdown for Existing Instruments */}
          {registryMode === 'existing' && (
            <div className="p-space-md rounded-lg bg-surface-container-low border border-outline-variant/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-[16px] text-secondary">inventory_2</span>
                <span>Select from Registered Demo Instruments:</span>
              </div>
              <select
                onChange={e => handleSelectExistingInstrument(e.target.value)}
                value={draftSession.serialNumber}
                className="nawi-select w-full text-xs metrology-mono"
              >
                {instruments.map(inst => (
                  <option key={inst.id} value={inst.serialNumber}>
                    {inst.manufacturer} — {inst.model} (S/N: {inst.serialNumber}) | Class {inst.accuracyClass} Max {inst.maxCapacity}{inst.unit} e={inst.verificationScaleInterval_e}{inst.unit}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {/* Manufacturer / OEM */}
            <div>
              <label className="nawi-label">
                Manufacturer / OEM <span className="text-error">*</span>
              </label>
              <select
                value={draftSession.manufacturer || 'RADWAG'}
                onChange={e => updateDraft({ manufacturer: e.target.value })}
                className="nawi-select font-semibold"
              >
                {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <p className="font-body-sm text-[11px] text-outline mt-1">Originating manufacturer of weighing instrument</p>
            </div>

            {/* Model / Designation */}
            <div>
              <label className="nawi-label">
                Model / Pattern Designation <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={draftSession.model || 'PS 2100.R2'}
                onChange={e => updateDraft({ model: e.target.value })}
                placeholder="e.g. PS 2100.R2"
                className="nawi-input font-medium"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Commercial pattern or type designation</p>
            </div>

            {/* Serial Number */}
            <div>
              <label className="nawi-label">
                Serial Number (S/N) <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={draftSession.serialNumber || '597226'}
                onChange={e => updateDraft({ serialNumber: e.target.value })}
                placeholder="e.g. 597226"
                className="nawi-input metrology-mono font-bold text-primary"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Unique physical identifier on rating plate</p>
            </div>

            {/* Instrument Category */}
            <div>
              <label className="nawi-label">
                Instrument Category <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Complete', 'Module', 'Family'] as InstrumentCategory[]).map(cat => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => updateDraft({ instrumentCategory: cat })}
                    className={`py-2 px-1 rounded-lg border font-label-mono-sm text-xs font-semibold text-center transition-colors ${
                      (draftSession.instrumentCategory || 'Complete') === cat
                        ? 'bg-primary-container text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">
                Complete instrument, separately evaluated module, or family
              </p>
            </div>

            {/* Functional Type */}
            <div className="sm:col-span-2">
              <label className="nawi-label">Instrument Functional Type</label>
              <select
                value={draftSession.instrumentType || 'High-Precision Analytical Balance'}
                onChange={e => updateDraft({ instrumentType: e.target.value })}
                className="nawi-select"
              >
                {INSTRUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION C — METROLOGICAL SPECIFICATIONS
            ================================================================== */}
        <section className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg space-y-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-on-tertiary-container" />
              <div>
                <span className="font-label-mono-sm text-[11px] text-outline uppercase font-semibold">SECTION C</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Metrological Specifications</h3>
              </div>
            </div>
            <span className="text-xs font-label-mono-sm px-2 py-0.5 rounded bg-surface-container text-outline">
              OIML R-76 Table 3 &amp; 6
            </span>
          </div>

          {/* Accuracy Class & Indication Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="nawi-label">
                Accuracy Class <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['I', 'II', 'III', 'IV'] as const).map(cls => (
                  <button
                    type="button"
                    key={cls}
                    onClick={() => updateDraft({ accuracyClass: cls })}
                    className={`py-2 px-1 rounded-lg border font-label-mono-sm text-xs font-bold transition-all text-center ${
                      (draftSession.accuracyClass || 'II') === cls
                        ? 'bg-primary-container text-on-primary border-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container'
                    }`}
                  >
                    Class {cls}
                  </button>
                ))}
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">
                {(draftSession.accuracyClass || 'II') === 'I' && 'Special Accuracy (e ≤ 1mg, n > 50,000)'}
                {(draftSession.accuracyClass || 'II') === 'II' && 'High Accuracy (1mg ≤ e ≤ 50mg, 100 ≤ n ≤ 100,000)'}
                {(draftSession.accuracyClass || 'II') === 'III' && 'Medium Accuracy (0.1g ≤ e ≤ 2g, 500 ≤ n ≤ 10,000)'}
                {(draftSession.accuracyClass || 'II') === 'IV' && 'Ordinary Accuracy (e ≥ 5g, 100 ≤ n ≤ 1,000)'}
              </p>
            </div>

            <div>
              <label className="nawi-label">Indication Type</label>
              <select
                value={draftSession.indicationType || 'Digital (Self-Indicating)'}
                onChange={e => updateDraft({ indicationType: e.target.value })}
                className="nawi-select font-medium"
              >
                <option value="Digital (Self-Indicating)">Digital (Electronic Display / LCD)</option>
                <option value="Analog / Mechanical Pointer">Analog (Pointer / Dial Indicator)</option>
                <option value="Semi-Self-Indicating">Semi-Self-Indicating</option>
              </select>
              <p className="font-body-sm text-[11px] text-outline mt-1">Display readout technology &amp; mechanism</p>
            </div>
          </div>

          {/* Primary Metrological Quantities: Max, Min, e, d, and n */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-space-xs">
            {/* Max Capacity */}
            <div>
              <label className="nawi-label">
                Maximum Capacity (Max) <span className="text-error">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={draftSession.maxCapacity !== undefined && draftSession.maxCapacity > 0 ? draftSession.maxCapacity : ''}
                  onChange={e => updateDraft({ maxCapacity: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 2100"
                  className="nawi-input metrology-mono font-bold text-primary flex-1"
                  step="any"
                />
                <select
                  value={draftSession.unit || 'g'}
                  onChange={e => updateDraft({ unit: e.target.value as any })}
                  className="nawi-select w-20 font-bold text-center"
                >
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                </select>
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">Upper statutory weighing range limit</p>
            </div>

            {/* Min Capacity */}
            <div>
              <label className="nawi-label">
                Minimum Capacity (Min) <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draftSession.minCapacity !== undefined && draftSession.minCapacity > 0 ? draftSession.minCapacity : ''}
                  onChange={e => updateDraft({ minCapacity: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 0.5"
                  className="nawi-input metrology-mono font-medium flex-1"
                  step="any"
                />
                <span className="font-label-mono-sm text-xs font-bold text-outline w-10 text-center">
                  {draftSession.unit || 'g'}
                </span>
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">Lower statutory weighing limit</p>
            </div>

            {/* Total Divisions n = Max / e (DERIVED READ-ONLY) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="nawi-label mb-0">Verification Intervals (n)</label>
                <span className="text-[10px] text-secondary font-label-mono-sm font-semibold uppercase">
                  Calculated (Max/e)
                </span>
              </div>
              <div className="nawi-input bg-surface-container-low font-bold metrology-mono text-primary flex items-center justify-between cursor-not-allowed border-secondary/30">
                <span>
                  {calculatedN > 0 ? calculatedN.toLocaleString() : '--'}
                </span>
                <span className="text-xs text-outline font-normal">div</span>
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">
                {calculatedN > 0 ? `n = ${draftSession.maxCapacity} / ${draftSession.verificationScaleInterval_e}` : 'Calculates automatically when Max and e are entered'}
              </p>
            </div>

            {/* Verification Scale Interval (e) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="nawi-label mb-0">
                  Verification Interval (e) <span className="text-error">*</span>
                </label>
                <span className="text-[10px] text-secondary font-label-mono-sm font-semibold">MPE Base</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draftSession.verificationScaleInterval_e !== undefined && draftSession.verificationScaleInterval_e > 0 ? draftSession.verificationScaleInterval_e : ''}
                  onChange={e => updateDraft({ verificationScaleInterval_e: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 0.1"
                  className="nawi-input metrology-mono font-bold text-secondary flex-1"
                  step="any"
                />
                <span className="font-label-mono-sm text-xs font-bold text-outline w-10 text-center">
                  {draftSession.unit || 'g'}
                </span>
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">Value used for MPE determination</p>
            </div>

            {/* Actual Scale Interval (d) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="nawi-label mb-0">
                  Actual Scale Interval (d) <span className="text-error">*</span>
                </label>
                <span className="text-[10px] text-outline font-label-mono-sm font-semibold">Display Readout</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draftSession.actualScaleInterval_d !== undefined && draftSession.actualScaleInterval_d > 0 ? draftSession.actualScaleInterval_d : ''}
                  onChange={e => updateDraft({ actualScaleInterval_d: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 0.01"
                  className="nawi-input metrology-mono font-medium flex-1"
                  step="any"
                />
                <span className="font-label-mono-sm text-xs font-bold text-outline w-10 text-center">
                  {draftSession.unit || 'g'}
                </span>
              </div>
              <p className="font-body-sm text-[11px] text-outline mt-1">Smallest indicated division on display</p>
            </div>

            {/* Scale Interval Relationship Check */}
            <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-center">
              <span className="font-label-mono-sm text-[10px] uppercase text-outline font-semibold">Scale Interval Ratio (d / e)</span>
              <div className="font-label-mono-md text-sm font-bold text-primary mt-0.5">
                {draftSession.verificationScaleInterval_e && draftSession.actualScaleInterval_d
                  ? `d = ${(draftSession.actualScaleInterval_d / draftSession.verificationScaleInterval_e).toFixed(2)} e`
                  : '--'}
              </div>
              <span className="font-body-sm text-[10px] text-on-surface-variant mt-0.5">
                OIML R-76 Cl. 3.1.2: d ≤ e ≤ 10d
              </span>
            </div>
          </div>

          {/* ================================================================
              ADDITIONAL METROLOGICAL PARAMETERS (Collapsible)
              ================================================================ */}
          <div className="border border-outline-variant/30 rounded-xl overflow-hidden mt-space-md">
            <button
              type="button"
              onClick={() => setShowAdditionalParams(!showAdditionalParams)}
              className="w-full flex items-center justify-between p-space-md bg-surface-container-low hover:bg-surface-container transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">
                  {showAdditionalParams ? 'expand_less' : 'expand_more'}
                </span>
                <span className="font-title-sm text-xs text-primary font-bold">
                  Additional Instrument Parameters
                </span>
                <span className="text-[10px] text-outline font-label-mono-sm font-normal">
                  (Multi-interval, Tare type, Voltage, Temperature limits)
                </span>
              </div>
              <span className="text-[11px] text-secondary font-semibold">
                {showAdditionalParams ? 'Collapse' : 'Expand'}
              </span>
            </button>

            {showAdditionalParams && (
              <div className="p-space-lg bg-surface-container-lowest space-y-space-md border-t border-outline-variant/30 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
                  {/* Multi-interval */}
                  <div>
                    <label className="nawi-label">Multi-Interval Instrument</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ additionalParams: { ...draftSession.additionalParams, isMultiInterval: true } })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          draftSession.additionalParams?.isMultiInterval ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ additionalParams: { ...draftSession.additionalParams, isMultiInterval: false } })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          !draftSession.additionalParams?.isMultiInterval ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Multiple Range */}
                  <div>
                    <label className="nawi-label">Multiple-Range Instrument</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ additionalParams: { ...draftSession.additionalParams, isMultipleRange: true } })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          draftSession.additionalParams?.isMultipleRange ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ additionalParams: { ...draftSession.additionalParams, isMultipleRange: false } })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          !draftSession.additionalParams?.isMultipleRange ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Has Zero Setting Device */}
                  <div>
                    <label className="nawi-label">Zero-Setting Device</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ additionalParams: { ...draftSession.additionalParams, hasZeroSettingDevice: true } })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          draftSession.additionalParams?.hasZeroSettingDevice !== false ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ additionalParams: { ...draftSession.additionalParams, hasZeroSettingDevice: false } })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          draftSession.additionalParams?.hasZeroSettingDevice === false ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Tare Type */}
                  <div>
                    <label className="nawi-label">Tare Mechanism Type</label>
                    <select
                      value={draftSession.additionalParams?.tareType || 'Subtractive'}
                      onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, tareType: e.target.value as any } })}
                      className="nawi-select text-xs"
                    >
                      <option value="Subtractive">Subtractive Tare (T = -Max)</option>
                      <option value="Additive">Additive Tare</option>
                      <option value="Preset">Preset Tare Device</option>
                      <option value="None">None</option>
                    </select>
                  </div>

                  {/* Maximum Tare Effect */}
                  <div>
                    <label className="nawi-label">Max Tare Effect (T)</label>
                    <input
                      type="text"
                      value={draftSession.additionalParams?.maxTareEffect || '-2100 g'}
                      onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, maxTareEffect: e.target.value } })}
                      className="nawi-input text-xs metrology-mono"
                      placeholder="e.g. -2100 g"
                    />
                  </div>

                  {/* Temperature Range (Min / Max) */}
                  <div>
                    <label className="nawi-label">Temperature Limits (°C)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={draftSession.additionalParams?.tempMinC || '+10'}
                        onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, tempMinC: e.target.value } })}
                        className="nawi-input text-xs metrology-mono text-center"
                        placeholder="Min"
                      />
                      <span className="text-outline">to</span>
                      <input
                        type="text"
                        value={draftSession.additionalParams?.tempMaxC || '+40'}
                        onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, tempMaxC: e.target.value } })}
                        className="nawi-input text-xs metrology-mono text-center"
                        placeholder="Max"
                      />
                      <span className="text-xs text-outline">°C</span>
                    </div>
                  </div>

                  {/* Voltage (Nominal / Min / Max) */}
                  <div className="sm:col-span-2">
                    <label className="nawi-label">Mains Voltage Range (Nominal / Min / Max)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={draftSession.additionalParams?.voltageNominal || '230 V'}
                        onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, voltageNominal: e.target.value } })}
                        className="nawi-input text-xs metrology-mono text-center"
                        placeholder="Nominal (230V)"
                      />
                      <input
                        type="text"
                        value={draftSession.additionalParams?.voltageMin || '187 V'}
                        onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, voltageMin: e.target.value } })}
                        className="nawi-input text-xs metrology-mono text-center"
                        placeholder="Min (-15%)"
                      />
                      <input
                        type="text"
                        value={draftSession.additionalParams?.voltageMax || '253 V'}
                        onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, voltageMax: e.target.value } })}
                        className="nawi-input text-xs metrology-mono text-center"
                        placeholder="Max (+10%)"
                      />
                    </div>
                  </div>

                  {/* Battery Cutoff Voltage */}
                  <div>
                    <label className="nawi-label">Battery Cutoff Voltage</label>
                    <input
                      type="text"
                      value={draftSession.additionalParams?.batteryCutoffV || '10.2 V'}
                      onChange={e => updateDraft({ additionalParams: { ...draftSession.additionalParams, batteryCutoffV: e.target.value } })}
                      className="nawi-input text-xs metrology-mono"
                      placeholder="e.g. 10.2 V"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ==================================================================
            SECTION D — TEST EQUIPMENT / REFERENCE STANDARDS
            ================================================================== */}
        <section className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg space-y-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-secondary" />
              <div>
                <span className="font-label-mono-sm text-[11px] text-outline uppercase font-semibold">SECTION D</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Test Equipment &amp; Reference Standards
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddStdModal(true)}
              className="btn-secondary text-xs"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              + Add Reference Standard
            </button>
          </div>

          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Document traceable standards and test equipment used for evaluating this instrument (per OIML R-76 test equipment register).
          </p>

          {/* Reference Standards Table */}
          {(!draftSession.referenceStandards || draftSession.referenceStandards.length === 0) ? (
            <div className="p-space-lg text-center border border-dashed border-outline-variant/50 rounded-xl">
              <span className="material-symbols-outlined text-[28px] text-outline mb-1 block">scale</span>
              <p className="font-medium text-xs text-on-surface">No reference standards recorded.</p>
              <button
                type="button"
                onClick={() => setShowAddStdModal(true)}
                className="btn-secondary text-xs mt-2"
              >
                Add Standard Weight Set
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="nawi-table text-xs">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Model / Description</th>
                    <th>S/N</th>
                    <th>Grade</th>
                    <th>Calibration Certificate</th>
                    <th>Date</th>
                    <th>Uncertainty</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draftSession.referenceStandards.map((std) => (
                    <tr key={std.id}>
                      <td>
                        <span className="font-label-mono-sm font-semibold px-2 py-0.5 rounded bg-surface-container text-primary">
                          {std.equipmentType}
                        </span>
                      </td>
                      <td className="font-medium text-on-surface">{std.modelNumber}</td>
                      <td><span className="metrology-mono font-semibold text-secondary">{std.serialNumber}</span></td>
                      <td><span className="font-bold text-on-tertiary-container">{std.accuracyClassOrGrade}</span></td>
                      <td><span className="metrology-mono text-[11px] text-outline">{std.calibrationCertNumber}</span></td>
                      <td><span className="metrology-mono text-[11px] text-outline">{std.calibrationDate}</span></td>
                      <td><span className="metrology-mono text-[11px] text-outline">{std.measurementUncertainty}</span></td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveStandard(std.id)}
                          className="text-error hover:text-error/80 p-1"
                          title="Remove standard"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal / Form for Adding Reference Standard */}
          {showAddStdModal && (
            <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-space-sm animate-fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20">
                <span className="font-title-sm text-xs font-bold text-primary">Add Reference Standard / Test Instrument</span>
                <button type="button" onClick={() => setShowAddStdModal(false)} className="text-outline hover:text-primary">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <form onSubmit={handleAddStandard} className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm text-xs">
                <div>
                  <label className="nawi-label text-[11px]">Equipment Type</label>
                  <select
                    value={newStdType}
                    onChange={e => setNewStdType(e.target.value as any)}
                    className="nawi-select text-xs"
                  >
                    <option value="Weights">Weights (OIML R-111 Standard)</option>
                    <option value="Simulator">Load Cell Simulator</option>
                    <option value="Chamber">Climate / Temp Chamber</option>
                    <option value="EMC Generator">EMC Disturbance Generator</option>
                  </select>
                </div>

                <div>
                  <label className="nawi-label text-[11px]">Model / Name *</label>
                  <input
                    type="text"
                    required
                    value={newStdModel}
                    onChange={e => setNewStdModel(e.target.value)}
                    placeholder="e.g. Troemner Class E2 Weight Set"
                    className="nawi-input text-xs"
                  />
                </div>

                <div>
                  <label className="nawi-label text-[11px]">Serial Number *</label>
                  <input
                    type="text"
                    required
                    value={newStdSerial}
                    onChange={e => setNewStdSerial(e.target.value)}
                    placeholder="e.g. W-8812-E2"
                    className="nawi-input text-xs metrology-mono"
                  />
                </div>

                <div>
                  <label className="nawi-label text-[11px]">Accuracy Class / Grade</label>
                  <select
                    value={newStdGrade}
                    onChange={e => setNewStdGrade(e.target.value)}
                    className="nawi-select text-xs font-bold"
                  >
                    <option value="E1">Class E1 (Primary Standard)</option>
                    <option value="E2">Class E2 (High Precision)</option>
                    <option value="F1">Class F1 (Precision)</option>
                    <option value="F2">Class F2 (Commercial Precision)</option>
                    <option value="M1">Class M1 (Industrial Standard)</option>
                    <option value="Grade A">Grade A</option>
                  </select>
                </div>

                <div>
                  <label className="nawi-label text-[11px]">Calibration Cert No.</label>
                  <input
                    type="text"
                    value={newStdCert}
                    onChange={e => setNewStdCert(e.target.value)}
                    placeholder="e.g. CAL-2026-W-8812"
                    className="nawi-input text-xs metrology-mono"
                  />
                </div>

                <div>
                  <label className="nawi-label text-[11px]">Calibration Date</label>
                  <input
                    type="date"
                    value={newStdDate}
                    onChange={e => setNewStdDate(e.target.value)}
                    className="nawi-input text-xs metrology-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="nawi-label text-[11px]">Expanded Uncertainty (k=2)</label>
                  <input
                    type="text"
                    value={newStdUncertainty}
                    onChange={e => setNewStdUncertainty(e.target.value)}
                    placeholder="e.g. U = 0.015 mg (k=2, 95% confidence)"
                    className="nawi-input text-xs metrology-mono"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button type="submit" className="btn-primary text-xs w-full justify-center">
                    Save Standard
                  </button>
                  <button type="button" onClick={() => setShowAddStdModal(false)} className="btn-secondary text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* ==================================================================
            SECTION E — LABORATORY ENVIRONMENTAL CONDITIONS
            ================================================================== */}
        <section className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg space-y-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-primary" />
              <div>
                <span className="font-label-mono-sm text-[11px] text-outline uppercase font-semibold">SECTION E</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Laboratory Environmental Conditions
                </h3>
              </div>
            </div>
            <span className="text-xs font-label-mono-sm px-2 py-0.5 rounded bg-surface-container text-outline">
              OIML R-76 Cl. 3.9
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-space-md">
            {/* Stage */}
            <div>
              <label className="nawi-label">Log Stage</label>
              <select
                value={draftSession.environmentalStage || 'Start'}
                onChange={e => updateDraft({ environmentalStage: e.target.value as any })}
                className="nawi-select font-semibold text-xs"
              >
                <option value="Start">Start of Test</option>
                <option value="Max / During Test">Max / During Test</option>
                <option value="End">End of Test</option>
              </select>
              <p className="font-body-sm text-[11px] text-outline mt-1">Verification phase</p>
            </div>

            {/* Temperature */}
            <div>
              <label className="nawi-label">
                Temperature (°C) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={draftSession.temperatureC !== null && draftSession.temperatureC !== undefined ? draftSession.temperatureC : ''}
                onChange={e => updateDraft({ temperatureC: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 20.0"
                className="nawi-input metrology-mono font-bold text-primary text-xs"
                step="0.1"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Nominal: 20°C (±2°C)</p>
            </div>

            {/* Relative Humidity */}
            <div>
              <label className="nawi-label">
                Humidity (% RH) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={draftSession.relativeHumidityPct !== null && draftSession.relativeHumidityPct !== undefined ? draftSession.relativeHumidityPct : ''}
                onChange={e => updateDraft({ relativeHumidityPct: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 50.0"
                className="nawi-input metrology-mono font-bold text-primary text-xs"
                step="0.1"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Nominal: 30%–70%</p>
            </div>

            {/* Pressure */}
            <div>
              <label className="nawi-label">
                Pressure (hPa) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={draftSession.atmosphericPressureHpa !== null && draftSession.atmosphericPressureHpa !== undefined ? draftSession.atmosphericPressureHpa : ''}
                onChange={e => updateDraft({ atmosphericPressureHpa: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 1013.2"
                className="nawi-input metrology-mono font-bold text-primary text-xs"
                step="0.1"
              />
              <p className="font-body-sm text-[11px] text-outline mt-1">Std: 1013.25 hPa</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-space-xs border-t border-outline-variant/20">
            {/* Source Indicators */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface">Data Source:</span>
              <div className="flex gap-1.5">
                {(['DEMO', 'MANUAL', 'LIVE'] as const).map(src => (
                  <button
                    type="button"
                    key={src}
                    onClick={() => updateDraft({ environmentSource: src })}
                    className={`px-2.5 py-1 rounded text-[11px] font-label-mono-sm font-bold transition-colors ${
                      (draftSession.environmentSource || 'DEMO') === src
                        ? 'bg-primary-container text-on-primary'
                        : 'bg-surface-container text-outline hover:bg-surface-container-high'
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>

            {/* Timestamp Display */}
            <div className="text-[11px] text-outline font-label-mono-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>Logged At: {draftSession.environmentTimestamp || '14:30:00 UTC'}</span>
            </div>
          </div>
        </section>

        {/* Primary Save & Continue Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSaveAndProceed}
            className="btn-primary w-full justify-center py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            <span>Save &amp; Continue to Observation Data Entry</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Right Column: Verification Parameters Summary Panel */}
      <div className="space-y-space-md sticky top-6">
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
          <div className="flex items-center justify-between mb-space-md border-b border-outline-variant/20 pb-space-xs">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-primary" />
              <h3 className="font-title-sm text-title-sm text-primary font-bold">
                Verification Parameters
              </h3>
            </div>
            <span className="font-label-mono-sm text-[10px] text-outline font-bold">
              SUMMARY
            </span>
          </div>

          {/* Compact summary rows */}
          <div className="space-y-2 text-xs">
            {[
              { label: 'Application ID', value: draftSession.sessionId || '--', mono: true, highlight: true },
              { 
                label: 'Verification Type', 
                value: draftSession.verificationType === 'IN_SERVICE_VERIFICATION' 
                  ? 'In-Service (2× MPE)' 
                  : draftSession.verificationType === 'INITIAL_VERIFICATION' 
                  ? 'Initial Verification' 
                  : 'Pattern / Type Evaluation' 
              },
              { label: 'Manufacturer', value: draftSession.manufacturer || '--' },
              { label: 'Model', value: draftSession.model || '--' },
              { label: 'Serial Number', value: draftSession.serialNumber || '--', mono: true },
              { label: 'Category', value: draftSession.instrumentCategory || 'Complete' },
              { label: 'Accuracy Class', value: `Class ${draftSession.accuracyClass || 'II'}` },
              { 
                label: 'Max Capacity', 
                value: draftSession.maxCapacity ? `${draftSession.maxCapacity} ${draftSession.unit || 'g'}` : '--', 
                mono: true 
              },
              { 
                label: 'Min Capacity', 
                value: draftSession.minCapacity ? `${draftSession.minCapacity} ${draftSession.unit || 'g'}` : '--', 
                mono: true 
              },
              { 
                label: 'Scale Interval (e)', 
                value: draftSession.verificationScaleInterval_e ? `${draftSession.verificationScaleInterval_e} ${draftSession.unit || 'g'}` : '--', 
                mono: true,
                bold: true
              },
              { 
                label: 'Actual Interval (d)', 
                value: draftSession.actualScaleInterval_d ? `${draftSession.actualScaleInterval_d} ${draftSession.unit || 'g'}` : '--', 
                mono: true 
              },
              { 
                label: 'Total Divisions (n)', 
                value: calculatedN > 0 ? `${calculatedN.toLocaleString()} div` : '--', 
                mono: true,
                badge: calculatedN > 0 ? 'Calculated' : undefined
              },
              { 
                label: 'Environment', 
                value: draftSession.temperatureC !== null && draftSession.relativeHumidityPct !== null
                  ? `${draftSession.temperatureC}°C, ${draftSession.relativeHumidityPct}% RH`
                  : 'Not recorded', 
                mono: true 
              },
              { label: 'Evaluator', value: draftSession.verificationOfficer || '--' },
              { label: 'Laboratory', value: draftSession.testLocation || '--' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1 border-b border-outline-variant/15">
                <span className="text-outline font-medium">{item.label}</span>
                <span className={`text-right ${item.mono ? 'metrology-mono' : ''} ${item.bold ? 'font-bold text-secondary' : 'font-semibold text-on-surface'} ${item.highlight ? 'text-primary font-bold' : ''}`}>
                  {item.value}
                  {item.badge && (
                    <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-surface-container text-secondary font-bold">
                      {item.badge}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* OIML R-76 Table 6 Limits Dynamic Preview */}
          <div className="mt-space-md p-space-md rounded-lg bg-surface-container-low border border-outline-variant/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm text-[10px] text-secondary font-bold uppercase">
                OIML R-76 Table 6 MPE Tiers
              </span>
              <span className="text-[10px] font-bold text-primary">Class {draftSession.accuracyClass || 'II'}</span>
            </div>
            <div className="font-body-sm text-[11px] text-on-surface-variant space-y-0.5 pt-1">
              {classLimitsText.map((line, idx) => (
                <div key={idx} className="metrology-mono text-[10px]">• {line}</div>
              ))}
            </div>
          </div>

          {/* Standards Summary */}
          {draftSession.referenceStandards && draftSession.referenceStandards.length > 0 && (
            <div className="mt-space-sm p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs">
              <span className="font-label-mono-sm text-[10px] text-outline uppercase block font-semibold">Active Standards</span>
              <span className="text-on-surface font-medium block truncate mt-0.5">
                {draftSession.referenceStandards[0].modelNumber} ({draftSession.referenceStandards[0].accuracyClassOrGrade})
              </span>
            </div>
          )}

          {/* Action button inside summary */}
          <button
            type="button"
            onClick={handleSaveAndProceed}
            className="btn-primary w-full mt-space-md justify-center text-xs py-2.5 font-bold"
          >
            <span>Save &amp; Continue</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
