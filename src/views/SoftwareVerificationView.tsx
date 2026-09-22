import React, { useState, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import { softwareVerificationApi, type SoftwareVerificationData } from '../services/api';

const WELMEC_CHECKS = [
  { id: 'sw_01', label: 'Software Identity Verification', desc: 'Software ID and version match OIML approval documentation', icon: 'fingerprint' },
  { id: 'sw_02', label: 'Cryptographic Checksum', desc: 'Hash of installed firmware matches the approved baseline (when baseline is available)', icon: 'enhanced_encryption' },
  { id: 'sw_03', label: 'Protected Parameter Integrity', desc: 'All legally-relevant parameters (e, Max, Min, calibration constants) are write-protected and tamper-evident', icon: 'shield' },
  { id: 'sw_04', label: 'Communication Interface Status', desc: 'All data communication interfaces verified; no unauthorized data channel found', icon: 'usb' },
  { id: 'sw_05', label: 'Parameter Audit Trail Integrity', desc: 'Software event log shows zero unauthorized parameter modifications since last verification', icon: 'history' },
];


export const SoftwareVerificationView: React.FC = () => {
  const { draftSession, activeBackendSessionId, backendConnected } = useVerification();

  const [record, setRecord] = useState<SoftwareVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [applicability, setApplicability] = useState<string>('NOT_APPLICABLE');
  const [softwareId, setSoftwareId] = useState('');
  const [softwareVersion, setSoftwareVersion] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [checksumHash, setChecksumHash] = useState('');
  const [baselineHash, setBaselineHash] = useState('');
  const [protectedParamsOk, setProtectedParamsOk] = useState<boolean | null>(null);
  const [auditTrailClean, setAuditTrailClean] = useState<boolean | null>(null);
  const [commInterface, setCommInterface] = useState('');
  const [notes, setNotes] = useState('');

  const loadRecord = useCallback(async () => {
    if (!activeBackendSessionId || !backendConnected) return;
    setLoading(true);
    try {
      const data = await softwareVerificationApi.get(activeBackendSessionId);
      setRecord(data);
      // Populate form from loaded data
      setApplicability(data.applicability === 'NOT_RECORDED' ? 'NOT_APPLICABLE' : data.applicability);
      setSoftwareId(data.software_id || '');
      setSoftwareVersion(data.software_version || '');
      setFirmwareVersion(data.firmware_version || '');
      setChecksumHash(data.checksum_hash || '');
      setBaselineHash(data.baseline_hash || '');
      setProtectedParamsOk(data.protected_params_verified ?? null);
      setAuditTrailClean(data.audit_trail_clean ?? null);
      setCommInterface(data.communication_interface_status || '');
      setNotes(data.notes || '');
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [activeBackendSessionId, backendConnected]);

  useEffect(() => {
    // Default applicability based on instrument
    if (draftSession.softwareApplicable) {
      setApplicability('APPLICABLE');
    } else {
      setApplicability('NOT_APPLICABLE');
    }
    loadRecord();
  }, [loadRecord, draftSession.softwareApplicable]);

  const handleSave = async () => {
    if (!activeBackendSessionId) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const data = await softwareVerificationApi.create(activeBackendSessionId, {
        applicability,
        software_id: softwareId || undefined,
        software_version: softwareVersion || undefined,
        firmware_version: firmwareVersion || undefined,
        checksum_hash: checksumHash || undefined,
        baseline_hash: baselineHash || undefined,
        hash_algorithm: 'SHA-256',
        protected_params_verified: protectedParamsOk ?? undefined,
        audit_trail_clean: auditTrailClean ?? undefined,
        communication_interface_status: commInterface || undefined,
        notes: notes || undefined,
      });
      setRecord(data);
      setSaved(true);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save software verification record.');
    } finally {
      setSaving(false);
    }
  };

  const getCheckStatus = (checkId: string): 'PASS' | 'PENDING' | 'REVIEW' | 'NA' => {
    if (applicability === 'NOT_APPLICABLE') return 'NA';
    if (!record || record.status === 'NOT_RECORDED') return 'PENDING';
    if (checkId === 'sw_01') return (softwareId && softwareVersion) ? 'PASS' : 'REVIEW';
    if (checkId === 'sw_02') return record.status === 'PASS' ? 'PASS' : record.status === 'MISMATCH' ? 'REVIEW' : 'REVIEW';
    if (checkId === 'sw_03') return protectedParamsOk === true ? 'PASS' : protectedParamsOk === false ? 'REVIEW' : 'PENDING';
    if (checkId === 'sw_04') return commInterface ? 'PASS' : 'PENDING';
    if (checkId === 'sw_05') return auditTrailClean === true ? 'PASS' : auditTrailClean === false ? 'REVIEW' : 'PENDING';
    return 'PENDING';
  };

  const passedChecks = WELMEC_CHECKS.filter(c => getCheckStatus(c.id) === 'PASS').length;

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">STEP 6 // SOFTWARE VERIFICATION</span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm uppercase font-bold">WELMEC 7.2</span>
              <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-mono-sm text-label-mono-sm font-semibold">PROTOTYPE</span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">WELMEC Software Verification</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Legally-relevant software verification for {draftSession.manufacturer || 'the instrument'} {draftSession.model} under WELMEC 7.2 and OIML R-76 criteria
            </p>
          </div>
          {record && (
            <div className={`px-4 py-2 rounded-xl font-label-mono-lg text-label-mono-lg font-bold ${
              record.status === 'PASS' ? 'bg-on-tertiary-container text-white'
              : record.status === 'NOT_APPLICABLE' ? 'bg-surface-container text-outline'
              : record.status === 'MISMATCH' ? 'bg-error text-on-error'
              : 'bg-error-container text-on-error-container'
            }`}>
              {record.status.replace(/_/g, ' ')}
            </div>
          )}
        </div>

        {/* Prototype notice */}
        <div className="bg-error-container/20 p-space-sm rounded-lg flex items-start gap-2 border border-error/20">
          <span className="material-symbols-outlined text-error text-[18px] flex-shrink-0 mt-0.5">info</span>
          <div className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-primary font-semibold">Prototype Notice:</strong>{' '}
            This is a prototype implementation of WELMEC 7.2 software verification. It records software identity and
            performs basic checksum comparison, but does NOT constitute actual WELMEC certification or regulatory approval.
            Results are advisory only.
          </div>
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-xl text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary animate-spin mb-4">progress_activity</span>
          <p className="font-body-md text-body-md text-on-surface-variant">Loading software verification record...</p>
        </div>
      )}

      {/* Applicability Selection */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
        <div className="flex items-center gap-2 mb-space-md">
          <span className="section-header-bar"></span>
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Step 1 — Determine Applicability</h3>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          Instrument registry shows: <strong>software_applicable = {String(draftSession.softwareApplicable)}</strong>.
          {draftSession.softwareApplicable
            ? ' This instrument contains legally-relevant software within WELMEC 7.2 scope.'
            : ' This instrument is registered as not containing legally-relevant software.'}
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'NOT_APPLICABLE', label: 'Not Applicable', desc: 'No legally-relevant software' },
            { value: 'APPLICABLE', label: 'Applicable', desc: 'Software present and verified' },
            { value: 'REVIEW', label: 'Requires Review', desc: 'Applicability uncertain' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setApplicability(opt.value)}
              className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${
                applicability === opt.value
                  ? 'border-secondary bg-secondary-fixed/30'
                  : 'border-outline-variant bg-surface-container hover:border-outline'
              }`}
            >
              <div className="font-body-md font-semibold text-on-surface">{opt.label}</div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Software Identity Fields — only when APPLICABLE */}
      {applicability === 'APPLICABLE' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Step 2 — Software Identity &amp; Cryptographic Record</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {[
              { label: 'Software ID', value: softwareId, setter: setSoftwareId, mono: true, placeholder: 'e.g. SW-XPR205-CORE-v4.7.2' },
              { label: 'Software Version', value: softwareVersion, setter: setSoftwareVersion, mono: true, placeholder: 'e.g. 4.7.2 (Build 20251108)' },
              { label: 'Firmware Version', value: firmwareVersion, setter: setFirmwareVersion, mono: true, placeholder: 'e.g. 2.1.3' },
              { label: 'Communication Interface', value: commInterface, setter: setCommInterface, mono: false, placeholder: 'e.g. RS-232 / USB — Both Validated' },
            ].map(field => (
              <div key={field.label}>
                <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block mb-1">{field.label}</label>
                <input
                  type="text"
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant focus:border-secondary focus:outline-none font-body-md text-on-surface ${field.mono ? 'metrology-mono' : ''}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-space-md grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block mb-1">
                Current Checksum (SHA-256)
              </label>
              <input
                type="text"
                value={checksumHash}
                onChange={e => setChecksumHash(e.target.value)}
                placeholder="e.g. SHA-256: a3f9b2c4d1e8f70529..."
                className="w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant focus:border-secondary focus:outline-none metrology-mono font-body-sm text-on-surface"
              />
            </div>
            <div>
              <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block mb-1">
                Approved Baseline Hash
              </label>
              <input
                type="text"
                value={baselineHash}
                onChange={e => setBaselineHash(e.target.value)}
                placeholder="Leave blank if baseline not available"
                className="w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant focus:border-secondary focus:outline-none metrology-mono font-body-sm text-on-surface"
              />
            </div>
          </div>

          {checksumHash && baselineHash && (
            <div className={`mt-space-md p-space-sm rounded-lg border ${checksumHash.trim() === baselineHash.trim() ? 'border-on-tertiary-container/40 bg-tertiary-fixed/20' : 'border-error/40 bg-error-container/20'}`}>
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${checksumHash.trim() === baselineHash.trim() ? 'text-on-tertiary-container' : 'text-error'}`}>
                  {checksumHash.trim() === baselineHash.trim() ? 'check_circle' : 'cancel'}
                </span>
                <span className="font-body-sm font-semibold">
                  {checksumHash.trim() === baselineHash.trim() ? 'Checksum MATCHES approved baseline' : 'Checksum MISMATCH — hashes do not match'}
                </span>
              </div>
            </div>
          )}

          <div className="mt-space-md grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block mb-2">
                Protected Parameters Verified
              </label>
              <div className="flex gap-2">
                {[{ v: true, l: 'Yes — Verified' }, { v: false, l: 'No — Issues Found' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    onClick={() => setProtectedParamsOk(opt.v)}
                    className={`px-3 py-2 rounded-lg border-2 font-body-sm font-semibold transition-all ${
                      protectedParamsOk === opt.v
                        ? opt.v ? 'border-on-tertiary-container bg-tertiary-fixed/30 text-on-tertiary-container' : 'border-error bg-error-container/30 text-error'
                        : 'border-outline-variant bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block mb-2">
                Parameter Audit Trail Clean
              </label>
              <div className="flex gap-2">
                {[{ v: true, l: 'Clean — No Unauthorized Changes' }, { v: false, l: 'Issues Found' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    onClick={() => setAuditTrailClean(opt.v)}
                    className={`px-3 py-2 rounded-lg border-2 font-body-sm font-semibold transition-all ${
                      auditTrailClean === opt.v
                        ? opt.v ? 'border-on-tertiary-container bg-tertiary-fixed/30 text-on-tertiary-container' : 'border-error bg-error-container/30 text-error'
                        : 'border-outline-variant bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-space-md">
            <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block mb-1">Officer Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes or observations..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant focus:border-secondary focus:outline-none font-body-md text-on-surface"
            />
          </div>
        </div>
      )}

      {/* Verification Checklist */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg space-y-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">WELMEC 7.2 CHECKLIST</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Software Verification Criteria</h3>
            </div>
          </div>
          <div className="text-center p-space-sm rounded-lg bg-surface-container-low">
            <div className="metrology-mono text-xl font-bold text-on-tertiary-container">{passedChecks}/{WELMEC_CHECKS.length}</div>
            <div className="font-label-mono-sm text-[10px] text-outline uppercase">Checks Met</div>
          </div>
        </div>
        <div className="space-y-2">
          {WELMEC_CHECKS.map((check, idx) => {
            const st = getCheckStatus(check.id);
            return (
              <div key={check.id} className="flex items-start gap-3 p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  st === 'PASS' ? 'bg-on-tertiary-container/10' : st === 'REVIEW' ? 'bg-error-container/30' : 'bg-surface-container'
                }`}>
                  <span className={`material-symbols-outlined text-[16px] ${
                    st === 'PASS' ? 'text-on-tertiary-container' : st === 'REVIEW' ? 'text-error' : 'text-outline'
                  }`}>{check.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-body-md font-semibold text-on-surface">{String(idx + 1).padStart(2, '0')}. {check.label}</div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{check.desc}</div>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded font-label-mono-sm text-[11px] font-semibold ${
                      st === 'PASS' ? 'badge-pass' : st === 'NA' ? 'bg-surface-container text-outline' : st === 'REVIEW' ? 'badge-review' : 'badge-testing'
                    }`}>
                      {st === 'NA' ? 'N/A' : st}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      {saveError && (
        <div className="bg-error-container/30 rounded-xl border border-error/30 p-space-md flex items-center gap-2">
          <span className="material-symbols-outlined text-error">error</span>
          <span className="font-body-md text-body-md text-on-surface">{saveError}</span>
        </div>
      )}

      {saved && (
        <div className="bg-tertiary-fixed/20 rounded-xl border border-on-tertiary-container/30 p-space-md flex items-center gap-2">
          <span className="material-symbols-outlined text-on-tertiary-container">check_circle</span>
          <span className="font-body-md text-body-md text-on-surface">Software verification record saved to PostgreSQL. Status: <strong>{record?.status}</strong></span>
        </div>
      )}

      <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col sm:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">enhanced_encryption</span>
          <div>
            <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Software Verification — Prototype Record</div>
            <div className="font-label-mono-md text-label-mono-sm text-primary font-bold metrology-mono">
              {record?.status ? `Status: ${record.status}` : 'Not yet recorded in database'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            onClick={handleSave}
            disabled={saving || !activeBackendSessionId || !backendConnected}
            className="btn-primary"
          >
            {saving
              ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[16px]">{saved ? 'verified' : 'save'}</span>}
            {saving ? 'Saving...' : saved ? 'Saved to DB' : 'Save to PostgreSQL'}
          </button>
        </div>
      </footer>
    </>
  );
};
