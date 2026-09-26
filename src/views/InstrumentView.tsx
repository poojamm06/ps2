import React, { useState, useEffect } from 'react';
import { useVerification } from '../context/VerificationContext';
import { instrumentsApi, type ApiInstrumentCreate } from '../services/api';
import { mockInstruments } from '../mock/mockData';
import type { Instrument } from '../types';

// Numeric fields are kept as raw strings while editing (never coerced to a
// number mid-keystroke) so the field never silently snaps back to a default
// value while the user is typing or backspacing — that snap-back was forcing
// a re-click to keep editing. Parsed to numbers only on submit.
interface RegisterFormState {
  manufacturer: string;
  model: string;
  serial_number: string;
  functional_type: string;
  accuracy_class: string;
  max_capacity: string;
  min_capacity: string;
  unit: string;
  verification_scale_interval_e: string;
  actual_scale_interval_d: string;
  software_applicable: boolean;
  approval_certificate_number: string;
}

const blankRegisterForm: RegisterFormState = {
  manufacturer: '',
  model: '',
  serial_number: '',
  functional_type: '',
  accuracy_class: '',
  max_capacity: '',
  min_capacity: '',
  unit: 'g',
  verification_scale_interval_e: '',
  actual_scale_interval_d: '',
  software_applicable: false,
  approval_certificate_number: '',
};

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

const fieldLabel = 'block font-body-sm text-body-sm font-semibold text-on-surface-variant mb-1.5';
const fieldInput = 'nawi-input';

export const InstrumentView: React.FC = () => {
  const {
    instruments,
    selectInstrument,
    refreshBackendData,
    databaseConnected,
    draftSession,
  } = useVerification();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstId, setSelectedInstId] = useState<string>(
    draftSession.backendInstrumentId ? String(draftSession.backendInstrumentId) : ''
  );

  // Deterministic local fallback: instruments registered while the backend was
  // unreachable are held here so the demo never dead-ends on a failed API call.
  const [locallyAddedInstruments, setLocallyAddedInstruments] = useState<Instrument[]>([]);

  // Inline registration panel state
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<RegisterFormState>(blankRegisterForm);

  // Demo-safety net: fall back to rich mock inventory when the backend is offline,
  // always including anything registered locally this session.
  const displayInstruments = [
    ...(instruments.length > 0 ? instruments : mockInstruments),
    ...locallyAddedInstruments,
  ];

  // Filtered instruments
  const filteredInstruments = displayInstruments.filter(inst => {
    const q = searchQuery.toLowerCase();
    return (
      inst.serialNumber.toLowerCase().includes(q) ||
      inst.manufacturer.toLowerCase().includes(q) ||
      inst.model.toLowerCase().includes(q) ||
      inst.accuracyClass.toLowerCase().includes(q)
    );
  });

  // Automatically select first instrument if none selected
  useEffect(() => {
    if (!selectedInstId && displayInstruments.length > 0) {
      setSelectedInstId(displayInstruments[0].id);
    }
  }, [displayInstruments, selectedInstId]);

  const selectedInstrument = displayInstruments.find(i => i.id === selectedInstId) || displayInstruments[0];

  const handleSelectAndContinue = (inst: Instrument) => {
    selectInstrument(inst);
  };

  const toggleRegisterForm = () => {
    setErrorMsg(null);
    setShowRegisterForm(v => {
      const opening = !v;
      if (opening) setNewForm(blankRegisterForm);
      return opening;
    });
  };

  const handleRegisterNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.serial_number.trim()) {
      setErrorMsg('Serial number is required.');
      return;
    }
    if (!newForm.manufacturer || !newForm.functional_type || !newForm.accuracy_class) {
      setErrorMsg('Please select a manufacturer, functional type, and accuracy class.');
      return;
    }

    const maxCap = parseFloat(newForm.max_capacity);
    const minCap = parseFloat(newForm.min_capacity);
    const eVal = parseFloat(newForm.verification_scale_interval_e);
    const dVal = parseFloat(newForm.actual_scale_interval_d);
    if ([maxCap, minCap, eVal, dVal].some(v => isNaN(v))) {
      setErrorMsg('Please enter valid numeric values for Max, Min, e, and d.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const normalizedClass = newForm.accuracy_class.startsWith('Class ')
      ? newForm.accuracy_class
      : `Class ${newForm.accuracy_class}`;

    const payload: ApiInstrumentCreate = {
      manufacturer: newForm.manufacturer,
      model: newForm.model,
      serial_number: newForm.serial_number,
      functional_type: newForm.functional_type,
      accuracy_class: normalizedClass,
      max_capacity: maxCap,
      min_capacity: minCap,
      unit: newForm.unit,
      verification_scale_interval_e: eVal,
      actual_scale_interval_d: dVal,
      software_applicable: newForm.software_applicable,
      approval_certificate_number: newForm.approval_certificate_number || undefined,
    };

    try {
      // Real backend first.
      const created = await instrumentsApi.createInstrument(payload);

      await refreshBackendData();
      setShowRegisterForm(false);

      const mappedInst: Instrument = {
        id: String(created.id),
        serialNumber: created.serial_number,
        manufacturer: created.manufacturer,
        model: created.model,
        accuracyClass: (created.accuracy_class.replace(/^Class\s+/i, '').trim() || 'II') as any,
        maxCapacity: created.max_capacity,
        minCapacity: created.min_capacity,
        unit: (created.unit || 'g') as any,
        verificationScaleInterval_e: created.verification_scale_interval_e,
        actualScaleInterval_d: created.actual_scale_interval_d,
        instrumentType: created.functional_type as any,
        softwareApplicable: created.software_applicable,
        approvalCertificateNumber: created.approval_certificate_number || undefined,
        location: '',
      };

      setSelectedInstId(mappedInst.id);
      selectInstrument(mappedInst);
      setSuccessToast(`${mappedInst.manufacturer} ${mappedInst.model} registered and saved to PostgreSQL.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      // Deterministic local fallback — the backend is unreachable, so register the
      // instrument locally for this session instead of dead-ending the demo.
      console.warn('Instrument registration API unavailable, using local fallback:', err?.message);

      const localInst: Instrument = {
        id: `local_${Date.now()}`,
        serialNumber: newForm.serial_number,
        manufacturer: newForm.manufacturer,
        model: newForm.model,
        accuracyClass: (normalizedClass.replace(/^Class\s+/i, '').trim() || 'II') as any,
        maxCapacity: maxCap,
        minCapacity: minCap,
        unit: (newForm.unit || 'g') as any,
        verificationScaleInterval_e: eVal,
        actualScaleInterval_d: dVal,
        instrumentType: newForm.functional_type as any,
        softwareApplicable: newForm.software_applicable ?? false,
        approvalCertificateNumber: newForm.approval_certificate_number || undefined,
        location: '',
      };

      setLocallyAddedInstruments(prev => [...prev, localInst]);
      setShowRegisterForm(false);
      setSelectedInstId(localInst.id);
      selectInstrument(localInst);
      setSuccessToast(`Demo Mode — ${localInst.manufacturer} ${localInst.model} registered locally (backend unreachable).`);
      setTimeout(() => setSuccessToast(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-space-lg">
      {/* Step Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-card border border-outline-variant/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-xs mb-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold tracking-wider uppercase">
                STEP 1 OF 6 // INSTRUMENT
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                OIML R-76 METROLOGY
              </span>
              {databaseConnected && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-[11px] font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
                  POSTGRESQL CONNECTED
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              Instrument Selection &amp; Registration
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Select an existing weighing instrument from the statutory registry or register a new device under test.
            </p>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <button
              onClick={toggleRegisterForm}
              className={showRegisterForm ? 'btn-secondary text-xs h-[42px] px-4' : 'btn-primary text-xs h-[42px] px-4'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {showRegisterForm ? 'close' : 'add_circle'}
              </span>
              {showRegisterForm ? 'Close' : 'Register New Instrument'}
            </button>
          </div>
        </div>
      </section>

      {successToast && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#DCFCE7] text-[#15803D] font-body-sm text-body-sm fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Inline Registration Panel — expands above the list/spec columns */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          showRegisterForm ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-xl">
          <div className="mb-space-lg">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Register New Weighing Instrument
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Enter the instrument's metrological specifications.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 mb-space-lg rounded-xl bg-[#FEE2E2]">
              <span className="material-symbols-outlined text-[18px] text-error flex-shrink-0 mt-0.5">error</span>
              <span className="font-body-md text-body-sm text-error">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegisterNew} className="space-y-space-xl">
            {/* Identification */}
            <div className="space-y-space-md">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Identification</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div>
                  <label className={fieldLabel}>Manufacturer</label>
                  <select
                    required
                    value={newForm.manufacturer}
                    onChange={(e) => setNewForm({ ...newForm, manufacturer: e.target.value })}
                    className="nawi-select"
                  >
                    <option value="" disabled>Select manufacturer…</option>
                    {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>Model Name</label>
                  <input
                    type="text"
                    required
                    value={newForm.model}
                    onChange={(e) => setNewForm({ ...newForm, model: e.target.value })}
                    className={fieldInput}
                    placeholder="e.g. Excellence XP-600"
                  />
                </div>

                <div>
                  <label className={fieldLabel}>Unique Serial Number</label>
                  <input
                    type="text"
                    required
                    value={newForm.serial_number}
                    onChange={(e) => setNewForm({ ...newForm, serial_number: e.target.value })}
                    className={fieldInput}
                    placeholder="e.g. SN-2026-9901"
                  />
                </div>

                <div>
                  <label className={fieldLabel}>Functional Type</label>
                  <select
                    required
                    value={newForm.functional_type}
                    onChange={(e) => setNewForm({ ...newForm, functional_type: e.target.value })}
                    className="nawi-select"
                  >
                    <option value="" disabled>Select functional type…</option>
                    {INSTRUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Metrological Parameters */}
            <div className="space-y-space-md">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Metrological Parameters</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div>
                  <label className={fieldLabel}>Accuracy Class (OIML R-76)</label>
                  <select
                    required
                    value={newForm.accuracy_class}
                    onChange={(e) => setNewForm({ ...newForm, accuracy_class: e.target.value })}
                    className="nawi-select"
                  >
                    <option value="" disabled>Select accuracy class…</option>
                    <option value="Class I">Class I (Special Accuracy)</option>
                    <option value="Class II">Class II (High Accuracy)</option>
                    <option value="Class III">Class III (Medium Accuracy)</option>
                    <option value="Class IIII">Class IIII (Ordinary Accuracy)</option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>Unit of Measure</label>
                  <select
                    value={newForm.unit}
                    onChange={(e) => setNewForm({ ...newForm, unit: e.target.value })}
                    className="nawi-select"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="mg">Milligrams (mg)</option>
                    <option value="t">Tonnes (t)</option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>Max Capacity (Max)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 2100"
                    value={newForm.max_capacity}
                    onChange={(e) => setNewForm({ ...newForm, max_capacity: e.target.value })}
                    className={`${fieldInput} metrology-mono`}
                  />
                </div>

                <div>
                  <label className={fieldLabel}>Min Capacity (Min)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 0.5"
                    value={newForm.min_capacity}
                    onChange={(e) => setNewForm({ ...newForm, min_capacity: e.target.value })}
                    className={`${fieldInput} metrology-mono`}
                  />
                </div>

                <div>
                  <label className={fieldLabel}>Verification Scale Interval (e)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 0.1"
                    value={newForm.verification_scale_interval_e}
                    onChange={(e) => setNewForm({ ...newForm, verification_scale_interval_e: e.target.value })}
                    className={`${fieldInput} metrology-mono`}
                  />
                </div>

                <div>
                  <label className={fieldLabel}>Actual Scale Interval (d)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 0.01"
                    value={newForm.actual_scale_interval_d}
                    onChange={(e) => setNewForm({ ...newForm, actual_scale_interval_d: e.target.value })}
                    className={`${fieldInput} metrology-mono`}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-space-md border-t border-outline-variant/40 flex justify-end gap-space-sm">
              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-6 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : null}
                {isSubmitting ? 'Registering...' : 'Register & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Main Grid: List on Left, Selected Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left Column: Instruments Table / List (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg space-y-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm border-b border-outline-variant/30">
            <div>
              <h2 className="font-headline-sm text-body-lg font-bold text-primary">Registered Instruments</h2>
              <p className="text-xs text-on-surface-variant">Search or select an instrument to begin verification</p>
            </div>
            <div className="nawi-search-bar w-full sm:w-72">
              <span className="material-symbols-outlined text-outline text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search serial, model, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="nawi-search-input"
              />
              <button className="nawi-search-btn" tabIndex={-1} type="button">
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </button>
            </div>
          </div>

          {filteredInstruments.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-low/40 rounded-xl border border-dashed border-outline-variant/50">
              <span className="material-symbols-outlined text-outline text-4xl mb-2">inventory_2</span>
              <p className="text-sm font-semibold text-primary">No matching instruments found</p>
              <p className="text-xs text-on-surface-variant mt-1">Register a new instrument to proceed with verification.</p>
              <button
                onClick={toggleRegisterForm}
                className="btn-secondary text-xs mt-4"
              >
                + Register Instrument
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {filteredInstruments.map((inst) => {
                const isSelected = selectedInstrument?.id === inst.id;
                const n = inst.verificationScaleInterval_e > 0 ? Math.round(inst.maxCapacity / inst.verificationScaleInterval_e) : 0;
                return (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedInstId(inst.id)}
                    className={`doc-row rounded-xl ${
                      isSelected ? 'bg-[#EEEBFF]' : 'bg-surface-container-lowest border border-outline-variant/40'
                    }`}
                  >
                    <div className={`doc-row-icon ${isSelected ? 'bg-white text-primary' : ''}`}>
                      <span className="material-symbols-outlined text-[18px]">scale</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface truncate">{inst.manufacturer} {inst.model}</span>
                        <span className="oiml-class-ii !py-0.5">Class {inst.accuracyClass}</span>
                      </div>
                      <div className="text-xs font-mono text-on-surface-variant mt-1 flex items-center gap-3 flex-wrap">
                        <span>S/N: <strong className="text-on-surface">{inst.serialNumber}</strong></span>
                        <span>Max: <strong>{inst.maxCapacity} {inst.unit}</strong></span>
                        <span>e: <strong>{inst.verificationScaleInterval_e} {inst.unit}</strong></span>
                        <span>n: <strong>{n.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSelected ? (
                        <span className="badge-pass">SELECTED</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px] text-outline">chevron_right</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Instrument Specification Card (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg space-y-space-md">
          <div className="border-b border-outline-variant/30 pb-space-sm">
            <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider font-bold">
              SELECTED INSTRUMENT SPECIFICATION
            </span>
            <h2 className="font-headline-sm text-lg font-bold text-primary mt-1">
              {selectedInstrument ? `${selectedInstrument.manufacturer} ${selectedInstrument.model}` : 'None Selected'}
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">
              Serial Number: {selectedInstrument?.serialNumber || '—'}
            </p>
          </div>

          {selectedInstrument ? (
            <div className="space-y-space-md">
              {/* Metrological Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <div className="text-outline text-[11px]">Accuracy Class</div>
                  <div className="font-bold text-primary text-sm font-mono mt-0.5">Class {selectedInstrument.accuracyClass}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <div className="text-outline text-[11px]">Functional Type</div>
                  <div className="font-bold text-primary truncate mt-0.5" title={selectedInstrument.instrumentType}>
                    {selectedInstrument.instrumentType}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <div className="text-outline text-[11px]">Max Capacity (Max)</div>
                  <div className="font-bold text-primary text-sm font-mono mt-0.5">
                    {selectedInstrument.maxCapacity} {selectedInstrument.unit}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <div className="text-outline text-[11px]">Min Capacity (Min)</div>
                  <div className="font-bold text-primary text-sm font-mono mt-0.5">
                    {selectedInstrument.minCapacity} {selectedInstrument.unit}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <div className="text-outline text-[11px]">Verif. Scale Interval (e)</div>
                  <div className="font-bold text-secondary text-sm font-mono mt-0.5">
                    {selectedInstrument.verificationScaleInterval_e} {selectedInstrument.unit}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <div className="text-outline text-[11px]">Actual Scale Interval (d)</div>
                  <div className="font-bold text-primary text-sm font-mono mt-0.5">
                    {selectedInstrument.actualScaleInterval_d} {selectedInstrument.unit}
                  </div>
                </div>
              </div>

              {/* Statutory Conformity Meta */}
              <div className="p-3 rounded-lg bg-surface-container-low/60 border border-outline-variant/40 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Scale Division Count (n):</span>
                  <span className="font-bold font-mono text-primary">
                    {selectedInstrument.verificationScaleInterval_e > 0
                      ? Math.round(selectedInstrument.maxCapacity / selectedInstrument.verificationScaleInterval_e).toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Approval Certificate:</span>
                  <span className="font-mono text-secondary font-semibold">
                    {selectedInstrument.approvalCertificateNumber || 'OIML R-76 Compliant'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">PostgreSQL DB ID:</span>
                  <span className="font-mono text-outline">
                    Record #{selectedInstrument.id}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleSelectAndContinue(selectedInstrument)}
                className="w-full btn-primary text-xs h-[46px] justify-center text-sm font-semibold shadow-md"
              >
                Proceed to Test Session with this Instrument →
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-on-surface-variant text-xs">
              Please select an instrument from the list to view specifications.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
