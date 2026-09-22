import React, { useState, useEffect } from 'react';
import { useVerification } from '../context/VerificationContext';
import { instrumentsApi, type ApiInstrumentCreate } from '../services/api';
import type { Instrument } from '../types';

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

export const InstrumentView: React.FC = () => {
  const { 
    instruments, 
    selectInstrument, 
    refreshBackendData, 
    databaseConnected,
    draftSession
  } = useVerification();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstId, setSelectedInstId] = useState<string>(
    draftSession.backendInstrumentId ? String(draftSession.backendInstrumentId) : ''
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Instrument Form State
  const [newForm, setNewForm] = useState<ApiInstrumentCreate>({
    manufacturer: 'RADWAG',
    model: 'PS 2100.R2',
    serial_number: '',
    functional_type: 'High-Precision Analytical Balance',
    accuracy_class: 'Class II',
    max_capacity: 2100,
    min_capacity: 0.5,
    unit: 'g',
    verification_scale_interval_e: 0.1,
    actual_scale_interval_d: 0.01,
    software_applicable: false,
    approval_certificate_number: 'OIML-R76-2026-CERT',
  });

  // Filtered instruments
  const filteredInstruments = instruments.filter(inst => {
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
    if (!selectedInstId && instruments.length > 0) {
      setSelectedInstId(instruments[0].id);
    }
  }, [instruments, selectedInstId]);

  const selectedInstrument = instruments.find(i => i.id === selectedInstId) || instruments[0];

  const handleSelectAndContinue = (inst: Instrument) => {
    selectInstrument(inst);
  };

  const handleRegisterNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.serial_number.trim()) {
      setErrorMsg('Serial number is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const created = await instrumentsApi.createInstrument({
        ...newForm,
        accuracy_class: newForm.accuracy_class.startsWith('Class ') 
          ? newForm.accuracy_class 
          : `Class ${newForm.accuracy_class}`,
      });

      await refreshBackendData();
      setShowNewModal(false);

      // Select newly created instrument and proceed
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

      selectInstrument(mappedInst);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register instrument in PostgreSQL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-space-lg">
      {/* Step Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-outline-variant/30">
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
              onClick={() => setShowNewModal(true)}
              className="btn-primary text-xs h-[42px] px-4"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Register New Instrument
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid: List on Left, Selected Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left Column: Instruments Table / List (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/30 p-space-lg space-y-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm border-b border-outline-variant/30">
            <div>
              <h2 className="font-headline-sm text-body-lg font-bold text-primary">Registered Instruments</h2>
              <p className="text-xs text-on-surface-variant">Live inventory from PostgreSQL `instruments` table</p>
            </div>
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search serial, model, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-secondary text-primary"
              />
            </div>
          </div>

          {filteredInstruments.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-low/40 rounded-xl border border-dashed border-outline-variant/50">
              <span className="material-symbols-outlined text-outline text-4xl mb-2">inventory_2</span>
              <p className="text-sm font-semibold text-primary">No matching instruments found</p>
              <p className="text-xs text-on-surface-variant mt-1">Register a new instrument to proceed with verification.</p>
              <button
                onClick={() => setShowNewModal(true)}
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
                    className={`p-space-md rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-container/20 border-secondary shadow-sm ring-1 ring-secondary/40'
                        : 'bg-surface-container-low/40 border-outline-variant/40 hover:bg-surface-container hover:border-outline-variant'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-primary truncate">{inst.manufacturer} {inst.model}</span>
                          <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-secondary font-mono text-[10px] font-bold">
                            Class {inst.accuracyClass}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-on-surface-variant mt-1 flex items-center gap-3 flex-wrap">
                          <span>S/N: <strong className="text-primary">{inst.serialNumber}</strong></span>
                          <span>Max: <strong>{inst.maxCapacity} {inst.unit}</strong></span>
                          <span>e: <strong>{inst.verificationScaleInterval_e} {inst.unit}</strong></span>
                          <span>d: <strong>{inst.actualScaleInterval_d} {inst.unit}</strong></span>
                          <span>n: <strong>{n.toLocaleString()}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSelected ? (
                          <span className="px-2 py-1 rounded bg-secondary text-on-secondary text-[11px] font-bold">
                            SELECTED
                          </span>
                        ) : (
                          <span className="text-xs text-outline group-hover:text-primary">
                            Click to select
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Instrument Specification Card (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/30 p-space-lg space-y-space-md">
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

      {/* Modal: Register New Instrument */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 max-w-2xl w-full p-space-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div>
                <h3 className="font-headline-sm text-lg font-bold text-primary">Register New Weighing Instrument</h3>
                <p className="text-xs text-on-surface-variant">Saves directly into PostgreSQL `instruments` table</p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegisterNew} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Manufacturer</label>
                  <select
                    value={newForm.manufacturer}
                    onChange={(e) => setNewForm({ ...newForm, manufacturer: e.target.value })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary"
                  >
                    {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Model Name</label>
                  <input
                    type="text"
                    required
                    value={newForm.model}
                    onChange={(e) => setNewForm({ ...newForm, model: e.target.value })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary font-mono"
                    placeholder="e.g. Excellence XP-600"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Unique Serial Number</label>
                  <input
                    type="text"
                    required
                    value={newForm.serial_number}
                    onChange={(e) => setNewForm({ ...newForm, serial_number: e.target.value })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary font-mono"
                    placeholder="e.g. SN-2026-9901"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Functional Type</label>
                  <select
                    value={newForm.functional_type}
                    onChange={(e) => setNewForm({ ...newForm, functional_type: e.target.value })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary"
                  >
                    {INSTRUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Accuracy Class (OIML R-76)</label>
                  <select
                    value={newForm.accuracy_class}
                    onChange={(e) => setNewForm({ ...newForm, accuracy_class: e.target.value })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary"
                  >
                    <option value="Class I">Class I (Special Accuracy)</option>
                    <option value="Class II">Class II (High Accuracy)</option>
                    <option value="Class III">Class III (Medium Accuracy)</option>
                    <option value="Class IIII">Class IIII (Ordinary Accuracy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Unit of Measure</label>
                  <select
                    value={newForm.unit}
                    onChange={(e) => setNewForm({ ...newForm, unit: e.target.value })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="mg">Milligrams (mg)</option>
                    <option value="t">Tonnes (t)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Max Capacity (Max)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newForm.max_capacity}
                    onChange={(e) => setNewForm({ ...newForm, max_capacity: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Min Capacity (Min)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newForm.min_capacity}
                    onChange={(e) => setNewForm({ ...newForm, min_capacity: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Verif. Scale Interval (e)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newForm.verification_scale_interval_e}
                    onChange={(e) => setNewForm({ ...newForm, verification_scale_interval_e: parseFloat(e.target.value) || 0.1 })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-semibold mb-1">Actual Scale Interval (d)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newForm.actual_scale_interval_d}
                    onChange={(e) => setNewForm({ ...newForm, actual_scale_interval_d: parseFloat(e.target.value) || 0.01 })}
                    className="w-full p-2 rounded bg-surface-container border border-outline-variant/50 text-primary font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-xs px-6"
                >
                  {isSubmitting ? 'Saving to PostgreSQL...' : 'Register & Continue →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
