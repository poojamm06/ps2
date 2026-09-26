import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  softwareExamApi,
  softwareVerificationApi,
  sessionsApi,
  type SoftwareExamRunResult,
  type SoftwareExamScenarioSummary,
  type SoftwareVerificationData,
  type SoftwareVerificationCreate,
  type ApiTestSession,
} from '../services/api';
import { mockScenarioSummaries, mockRunScenario } from '../mock/softwareExamScenarios';
import { useVerification } from '../context/VerificationContext';

type ConnectionType = 'USB' | 'RS-232' | 'Demo Simulation';
type Phase = 'CONNECT' | 'EXAM';
type ViewTab = 'PERSISTENCE' | 'TERMINAL_EXAM';

const SUITE_LABELS: Record<string, string> = {
  PROTECTIVE_INTERFACE: 'Protective Interface Testing',
  SOFTWARE_IDENTIFICATION: 'Software Identification & Integrity',
  AUDIT_TRAIL: 'Audit Trail Integrity',
  PROTOCOL_FUZZING: 'Protocol Fuzzing',
};

export const SoftwareVerificationView: React.FC = () => {
  const { instruments, activeBackendSessionId, backendConnected } = useVerification();
  const [activeTab, setActiveTab] = useState<ViewTab>('PERSISTENCE');

  // ==========================================
  // 1. STATUTORY PERSISTENCE STATE (PostgreSQL)
  // ==========================================
  const [sessionsList, setSessionsList] = useState<ApiTestSession[]>([]);
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null);
  const [record, setRecord] = useState<SoftwareVerificationData | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form fields
  const [applicability, setApplicability] = useState<'NOT_APPLICABLE' | 'APPLICABLE' | 'REVIEW'>('APPLICABLE');
  const [softwareId, setSoftwareId] = useState('');
  const [softwareVersion, setSoftwareVersion] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [checksumHash, setChecksumHash] = useState('');
  const [baselineHash, setBaselineHash] = useState('');
  const [hashAlgorithm, setHashAlgorithm] = useState('SHA-256');
  const [protectedParamsVerified, setProtectedParamsVerified] = useState(true);
  const [auditTrailClean, setAuditTrailClean] = useState(true);
  const [communicationInterfaceStatus, setCommunicationInterfaceStatus] = useState('PROTECTED');
  const [notes, setNotes] = useState('');

  // Auto-select session on mount
  useEffect(() => {
    sessionsApi.getSessions()
      .then(list => {
        setSessionsList(list);
        if (list.length > 0 && targetSessionId === null) {
          const match = activeBackendSessionId
            ? list.find(s => s.id === activeBackendSessionId)
            : null;
          setTargetSessionId(match ? match.id : list[0].id);
        }
      })
      .catch(() => {});
  }, [activeBackendSessionId, targetSessionId]);

  const selectedApiSession = useMemo<ApiTestSession | undefined>(() => {
    return sessionsList.find(s => s.id === targetSessionId) || sessionsList[0];
  }, [sessionsList, targetSessionId]);

  const selectedInstrument = useMemo(() => {
    if (!selectedApiSession) return instruments[0];
    return instruments.find(i => Number(i.id) === selectedApiSession.instrument_id) || instruments[0];
  }, [instruments, selectedApiSession]);

  const loadRecord = useCallback(async (sessionId: number) => {
    setLoadingRecord(true);
    setNotice(null);
    try {
      const data = await softwareVerificationApi.get(sessionId);
      setRecord(data);
      if (data.applicability && data.applicability !== 'NOT_RECORDED') {
        setApplicability(data.applicability as any);
        setSoftwareId(data.software_id || '');
        setSoftwareVersion(data.software_version || '');
        setFirmwareVersion(data.firmware_version || '');
        setChecksumHash(data.checksum_hash || '');
        setBaselineHash(data.baseline_hash || '');
        setHashAlgorithm(data.hash_algorithm || 'SHA-256');
        setProtectedParamsVerified(data.protected_params_verified !== false);
        setAuditTrailClean(data.audit_trail_clean !== false);
        setCommunicationInterfaceStatus(data.communication_interface_status || 'PROTECTED');
        setNotes(data.notes || '');
      } else {
        const defaultApp = data.instrument_software_applicable ? 'APPLICABLE' : 'NOT_APPLICABLE';
        setApplicability(defaultApp);
        setSoftwareId('');
        setSoftwareVersion('');
        setFirmwareVersion('');
        setChecksumHash('');
        setBaselineHash('');
        setHashAlgorithm('SHA-256');
        setProtectedParamsVerified(true);
        setAuditTrailClean(true);
        setCommunicationInterfaceStatus('PROTECTED');
        setNotes('');
      }
    } catch (err: any) {
      console.warn('Could not fetch software verification record:', err);
    } finally {
      setLoadingRecord(false);
    }
  }, []);

  useEffect(() => {
    if (targetSessionId !== null && backendConnected) {
      loadRecord(targetSessionId);
    }
  }, [targetSessionId, backendConnected, loadRecord]);

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetSessionId === null) return;
    setSavingRecord(true);
    setNotice(null);

    const payload: SoftwareVerificationCreate = {
      applicability,
      software_id: softwareId.trim() || undefined,
      software_version: softwareVersion.trim() || undefined,
      firmware_version: firmwareVersion.trim() || undefined,
      checksum_hash: checksumHash.trim() || undefined,
      baseline_hash: baselineHash.trim() || undefined,
      hash_algorithm: hashAlgorithm || undefined,
      protected_params_verified: protectedParamsVerified,
      audit_trail_clean: auditTrailClean,
      communication_interface_status: communicationInterfaceStatus.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const saved = await softwareVerificationApi.create(targetSessionId, payload);
      setRecord(saved);
      setNotice({
        type: 'success',
        message: `Software verification saved to PostgreSQL (Record ID #${saved.id}, Status: ${saved.status}).`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: `Failed to save software verification: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setSavingRecord(false);
    }
  };

  const hashComparisonVerdict = useMemo(() => {
    if (applicability === 'NOT_APPLICABLE') return { status: 'NOT_APPLICABLE', label: 'Not Applicable', badgeClass: 'bg-surface-container text-outline' };
    if (!checksumHash.trim()) return { status: 'PENDING', label: 'Awaiting Checksum Entry', badgeClass: 'bg-[#EEEBFF] text-primary' };
    if (!baselineHash.trim()) return { status: 'BASELINE_NOT_AVAILABLE', label: 'Baseline Hash Not Available', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' };
    if (checksumHash.trim().toLowerCase() === baselineHash.trim().toLowerCase()) {
      return { status: 'PASS', label: 'Hashes Match — WELMEC 7.2 Verified', badgeClass: 'bg-[#DCFCE7] text-[#15803D]' };
    }
    return { status: 'MISMATCH', label: 'Hash Mismatch — Integrity Violation', badgeClass: 'bg-[#FEE2E2] text-error' };
  }, [applicability, checksumHash, baselineHash]);

  // ==========================================
  // 2. LIVE EXAMINATION TERMINAL (UVP 2 Simulation)
  // ==========================================
  const [phase, setPhase] = useState<Phase>('CONNECT');
  const [connectionType, setConnectionType] = useState<ConnectionType>('Demo Simulation');
  const [scenarios, setScenarios] = useState<SoftwareExamScenarioSummary[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [run, setRun] = useState<SoftwareExamRunResult | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setScenariosLoading(true);
    softwareExamApi.listScenarios()
      .then(list => {
        if (cancelled) return;
        const finalList = list.length > 0 ? list : mockScenarioSummaries();
        setScenarios(finalList);
        setSelectedScenarioId(finalList[0]?.scenario_id || '');
      })
      .catch(() => {
        if (cancelled) return;
        const mockList = mockScenarioSummaries();
        setScenarios(mockList);
        setSelectedScenarioId(mockList[0]?.scenario_id || '');
      })
      .finally(() => { if (!cancelled) setScenariosLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleStartExamination = async () => {
    if (!selectedScenarioId) return;
    setConnecting(true);
    let result: SoftwareExamRunResult | null = null;
    try {
      result = await softwareExamApi.runScenario(selectedScenarioId);
    } catch (err) {
      console.warn('Software-exam backend unavailable, using local demo scenario:', err);
    }
    if (!result) {
      result = mockRunScenario(selectedScenarioId);
    }
    setConnecting(false);
    if (!result) return;
    setRun(result);
    setVisibleCount(0);
    setPhase('EXAM');
  };

  const handleReset = () => {
    setPhase('CONNECT');
    setRun(null);
    setVisibleCount(0);
  };

  useEffect(() => {
    if (phase !== 'EXAM' || !run) return;
    if (visibleCount >= run.commands.length) return;
    const t = setTimeout(() => setVisibleCount(c => c + 1), 520);
    return () => clearTimeout(t);
  }, [phase, run, visibleCount]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visibleCount]);

  const visibleCommands = run ? run.commands.slice(0, visibleCount) : [];
  const isComplete = !!run && visibleCount >= run.commands.length;
  const [downloadingReport, setDownloadingReport] = useState(false);

  const openPrintableFallback = useCallback((result: SoftwareExamRunResult) => {
    const suiteOrder = ['PROTECTIVE_INTERFACE', 'SOFTWARE_IDENTIFICATION', 'AUDIT_TRAIL', 'PROTOCOL_FUZZING'];
    const rows = (suite: string) => result.commands.filter(c => c.suite === suite);
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const suiteTable = (suite: string) => {
      const items = rows(suite);
      if (items.length === 0) return '';
      return `
        <h2>${SUITE_LABELS[suite]}</h2>
        <table>
          <thead><tr><th>ID</th><th>Description</th><th>Command</th><th>Response</th><th>Rule</th><th>Verdict</th><th>Sev.</th></tr></thead>
          <tbody>
            ${items.map(c => `
              <tr class="${c.verdict === 'FAIL' ? 'fail' : ''}">
                <td>${c.test_id}</td>
                <td>${escapeHtml(c.description)}</td>
                <td class="mono">${escapeHtml(c.command_sent)}</td>
                <td class="mono">${escapeHtml(c.response_received)}</td>
                <td>${escapeHtml(c.rule)}</td>
                <td>${c.verdict}</td>
                <td>${c.severity || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    };

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>NAWI Software Examination Report</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #0F172A; padding: 32px; }
        h1 { font-size: 20px; margin-bottom: 2px; }
        h2 { font-size: 13px; margin-top: 22px; margin-bottom: 6px; }
        .sub { color: #0284C7; font-size: 12px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
        th, td { border: 0.5px solid #CBD5E1; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { background: #E2E8F0; }
        tr.fail { background: #FEE2E2; color: #991B1B; font-weight: bold; }
        .mono { font-family: 'Courier New', monospace; font-size: 9px; }
        .banner { background: ${result.summary.overall_verdict === 'PASS' ? '#059669' : '#DC2626'}; color: #fff; text-align: center; padding: 10px; margin: 16px 0; font-weight: bold; }
        .info td:first-child { font-weight: bold; width: 160px; background: #F8FAFC; }
        .notice { font-size: 9px; color: #475569; margin-top: 20px; border-top: 0.5px solid #CBD5E1; padding-top: 8px; }
        @media print { body { padding: 12px; } }
      </style></head><body>
        <h1>NAWI TRUST — Software Examination Report</h1>
        <div class="sub">OIML R76-1 Cl.5.5 &amp; WELMEC Guide 7.2</div>
        <table class="info">
          <tr><td>Scenario</td><td>${escapeHtml(result.scenario_name)}</td></tr>
          <tr><td>Interface</td><td>${escapeHtml(result.interface)}</td></tr>
          <tr><td>Declared Firmware</td><td class="mono">${escapeHtml(result.declared_firmware)}</td></tr>
          <tr><td>Declared Checksum</td><td class="mono">${escapeHtml(result.declared_checksum)}</td></tr>
          <tr><td>Executed</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <div class="banner">OVERALL VERDICT: ${result.summary.overall_verdict} (${result.summary.passed}/${result.summary.total} PASSED)</div>
        ${suiteOrder.map(suiteTable).join('')}
        <div class="notice">Prototype harness — demonstration purposes under WELMEC Guide 7.2 methodology.</div>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 250);
    }
  }, []);

  const handleDownloadReport = useCallback(async () => {
    if (!run) return;
    setDownloadingReport(true);
    try {
      const blob = await softwareExamApi.downloadReportPdf(run);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `software-exam-${run.scenario_id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Software-exam PDF endpoint unavailable, falling back to printable HTML:', err);
      openPrintableFallback(run);
    } finally {
      setDownloadingReport(false);
    }
  }, [run, openPrintableFallback]);

  return (
    <div className="fade-in space-y-space-md">
      {/* Page header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-sm">
        <div className="flex flex-wrap items-center gap-space-xs mb-1">
          <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase tracking-wider">
            WELMEC 7.2 // OIML R76-1 Cl. 5.5
          </span>
          <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm font-semibold uppercase">
            Legally Relevant Software Verification
          </span>
        </div>
        <h1 className="font-display-md text-display-md text-primary tracking-tight">
          Software &amp; Firmware Verification
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
          Statutory verification of legally-relevant software identifiers, firmware checksums, protected parameter seals, and interface isolation under European WELMEC Guide 7.2 principles.
        </p>
      </section>

      {/* Primary Tab Switcher */}
      <div className="flex border-b border-outline-variant/40 gap-4">
        <button
          onClick={() => setActiveTab('PERSISTENCE')}
          className={`pb-3 font-body-md font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'PERSISTENCE'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">verified</span>
          Statutory Verification Record (PostgreSQL)
        </button>
        <button
          onClick={() => setActiveTab('TERMINAL_EXAM')}
          className={`pb-3 font-body-md font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'TERMINAL_EXAM'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">terminal</span>
          Automated Examination Terminal (UVP 2 Simulation)
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STATUTORY VERIFICATION PERSISTENCE (POSTGRESQL)    */}
      {/* ========================================================= */}
      {activeTab === 'PERSISTENCE' && (
        <div className="space-y-space-md">
          {/* Session Selector & Context Bar */}
          <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-card space-y-space-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm flex-1">
                <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider flex-shrink-0">
                  Select Session
                </label>
                <select
                  value={targetSessionId || ''}
                  onChange={(e) => setTargetSessionId(Number(e.target.value))}
                  className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-1.5 font-body-md text-body-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {sessionsList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.session_code} — {s.status} ({s.verification_date || 'No Date'})
                    </option>
                  ))}
                </select>
              </div>

              {record && (
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded font-label-mono-sm text-xs font-bold uppercase tracking-wider ${
                    record.status === 'PASS' ? 'bg-[#DCFCE7] text-[#15803D]' :
                    record.status === 'MISMATCH' ? 'bg-[#FEE2E2] text-error' :
                    record.status === 'NOT_APPLICABLE' ? 'bg-surface-container text-outline' :
                    'bg-[#FEF3C7] text-[#B45309]'
                  }`}>
                    Status: {record.status}
                  </span>
                  {record.id && (
                    <span className="font-label-mono-sm text-xs text-outline">
                      PostgreSQL ID #{record.id}
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedApiSession && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-2 border-t border-outline-variant/20">
                <div className="bg-surface-container-low rounded-lg p-2 text-center">
                  <div className="font-label-mono-sm text-[10px] text-outline uppercase">Instrument</div>
                  <div className="font-body-sm font-bold text-primary truncate">{selectedInstrument?.manufacturer} {selectedInstrument?.model}</div>
                </div>
                <div className="bg-surface-container-low rounded-lg p-2 text-center">
                  <div className="font-label-mono-sm text-[10px] text-outline uppercase">Serial Number</div>
                  <div className="metrology-mono text-sm font-bold text-primary">{selectedInstrument?.serialNumber}</div>
                </div>
                <div className="bg-surface-container-low rounded-lg p-2 text-center">
                  <div className="font-label-mono-sm text-[10px] text-outline uppercase">Accuracy Class</div>
                  <div className="font-body-sm font-bold text-primary">Class {selectedInstrument?.accuracyClass}</div>
                </div>
                <div className="bg-surface-container-low rounded-lg p-2 text-center">
                  <div className="font-label-mono-sm text-[10px] text-outline uppercase">Software Relevant</div>
                  <div className={`font-body-sm font-bold ${record?.instrument_software_applicable !== false ? 'text-primary' : 'text-outline'}`}>
                    {record?.instrument_software_applicable !== false ? 'Yes (Applicable)' : 'No (Mechanical/Simple)'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {notice && (
            <div className={`p-space-md rounded-xl text-body-sm font-medium flex items-center gap-2 ${
              notice.type === 'success' ? 'bg-[#DCFCE7] text-[#15803D] border border-[#16A34A]/30' : 'bg-[#FEE2E2] text-error border border-error/30'
            }`}>
              <span className="material-symbols-outlined text-[18px]">
                {notice.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{notice.message}</span>
            </div>
          )}

          {/* Form Card */}
          <form onSubmit={handleSaveVerification} className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card space-y-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-space-sm">
              <div className="flex items-center gap-2">
                <span className="section-header-bar"></span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Statutory Software &amp; Firmware Parameters
                </h2>
              </div>
              <span className={`px-2.5 py-1 rounded font-label-mono-sm text-xs font-semibold ${hashComparisonVerdict.badgeClass}`}>
                {hashComparisonVerdict.label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
              {/* Applicability */}
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Applicability State *
                </label>
                <select
                  value={applicability}
                  onChange={(e) => setApplicability(e.target.value as any)}
                  className="nawi-select w-full"
                >
                  <option value="APPLICABLE">APPLICABLE (Legally Relevant Software Present)</option>
                  <option value="NOT_APPLICABLE">NOT_APPLICABLE (No Embedded Software)</option>
                  <option value="REVIEW">REVIEW (Applicability Uncertain)</option>
                </select>
              </div>

              {/* Software ID */}
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Software ID
                </label>
                <input
                  type="text"
                  value={softwareId}
                  onChange={(e) => setSoftwareId(e.target.value)}
                  placeholder="e.g. SW-LEG-01 / RAD-APP"
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-input w-full"
                />
              </div>

              {/* Software Version */}
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Software Version
                </label>
                <input
                  type="text"
                  value={softwareVersion}
                  onChange={(e) => setSoftwareVersion(e.target.value)}
                  placeholder="e.g. 2.4.1"
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
              {/* Firmware Version */}
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Firmware Version
                </label>
                <input
                  type="text"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                  placeholder="e.g. FW-1.09-REV2"
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-input w-full"
                />
              </div>

              {/* Hash Algorithm */}
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Integrity Hash Algorithm
                </label>
                <select
                  value={hashAlgorithm}
                  onChange={(e) => setHashAlgorithm(e.target.value)}
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-select w-full"
                >
                  <option value="SHA-256">SHA-256 (OIML R-76 &amp; WELMEC Recommended)</option>
                  <option value="SHA-1">SHA-1 (Legacy Type Approval)</option>
                  <option value="CRC32">CRC-32 (Standard Checksum)</option>
                  <option value="MD5">MD5 (Legacy)</option>
                </select>
              </div>

              {/* Interface Status */}
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Communication Interface Status
                </label>
                <select
                  value={communicationInterfaceStatus}
                  onChange={(e) => setCommunicationInterfaceStatus(e.target.value)}
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-select w-full"
                >
                  <option value="PROTECTED">PROTECTED (Commands isolated by firmware gate)</option>
                  <option value="SECURE">SECURE (Authenticated &amp; Encrypted)</option>
                  <option value="UNRESTRICTED">UNRESTRICTED (Open Interface)</option>
                  <option value="DISABLED">DISABLED (Physically Isolated)</option>
                </select>
              </div>
            </div>

            {/* Hashes Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Inspected Device Checksum Hash
                </label>
                <input
                  type="text"
                  value={checksumHash}
                  onChange={(e) => setChecksumHash(e.target.value)}
                  placeholder="Computed checksum hash from instrument firmware"
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-input w-full metrology-mono text-xs"
                />
                <span className="text-[11px] text-on-surface-variant mt-1 block">
                  Extracted via test interface or declared in instrument display menu.
                </span>
              </div>

              <div>
                <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                  Type Approval Baseline Hash
                </label>
                <input
                  type="text"
                  value={baselineHash}
                  onChange={(e) => setBaselineHash(e.target.value)}
                  placeholder="Baseline hash recorded in Type Examination Certificate"
                  disabled={applicability === 'NOT_APPLICABLE'}
                  className="nawi-input w-full metrology-mono text-xs"
                />
                <span className="text-[11px] text-on-surface-variant mt-1 block">
                  Authoritative reference from legal metrology register.
                </span>
              </div>
            </div>

            {/* Checkbox Seals */}
            <div className="bg-surface-container-low rounded-xl p-space-md space-y-space-sm">
              <label className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider block">
                Statutory Integrity Checks
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                <label className="flex items-center gap-2 text-body-sm text-primary font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={protectedParamsVerified}
                    onChange={(e) => setProtectedParamsVerified(e.target.checked)}
                    disabled={applicability === 'NOT_APPLICABLE'}
                    className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                  />
                  <span>Protected parameters verified (No unauthorized calibration adjustment)</span>
                </label>

                <label className="flex items-center gap-2 text-body-sm text-primary font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={auditTrailClean}
                    onChange={(e) => setAuditTrailClean(e.target.checked)}
                    disabled={applicability === 'NOT_APPLICABLE'}
                    className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                  />
                  <span>Audit trail counter clean (Continuous sequential calibration log)</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mb-1">
                Verification Examination Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes on software examination, interface security, or deviations observed..."
                className="nawi-input w-full text-body-sm"
              />
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-sm border-t border-outline-variant/30">
              <div className="text-xs text-on-surface-variant">
                {record?.created_at && (
                  <span>Stored: {new Date(record.created_at).toLocaleString()}</span>
                )}
                {record?.updated_at && (
                  <span className="ml-2">· Updated: {new Date(record.updated_at).toLocaleString()}</span>
                )}
              </div>

              <div className="flex items-center gap-space-sm w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => targetSessionId && loadRecord(targetSessionId)}
                  disabled={loadingRecord || savingRecord}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  Refresh
                </button>
                <button
                  type="submit"
                  disabled={savingRecord || loadingRecord || !targetSessionId}
                  className="btn-primary"
                >
                  {savingRecord ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">save</span>
                  )}
                  {savingRecord ? 'Persisting to PostgreSQL...' : 'Save Software Verification'}
                </button>
              </div>
            </div>
          </form>

          {/* WELMEC Prototype notice */}
          <div className="bg-surface-container-high rounded-xl p-space-md flex items-start gap-space-sm text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-[18px] flex-shrink-0 mt-0.5">policy</span>
            <p>
              <strong className="text-primary font-semibold">WELMEC Guide 7.2 Prototype:</strong> Software verification persists firmware IDs and checksums to the PostgreSQL database table <code className="metrology-mono text-primary font-bold">software_verifications</code>. This prototype validates identity, version control, and cryptographic hash equivalence.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LIVE EXAMINATION TERMINAL (UVP 2 Simulation)       */}
      {/* ========================================================= */}
      {activeTab === 'TERMINAL_EXAM' && (
        <div className="space-y-space-md">
          {phase === 'CONNECT' && (
            <div className="max-w-xl mx-auto w-full">
              <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-xl space-y-space-lg">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-[#EEEBFF] text-primary flex items-center justify-center mx-auto mb-space-md">
                    <span className="material-symbols-outlined text-[28px]">usb</span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Connect to Instrument</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Select a connection type and scenario to begin the live examination.
                  </p>
                </div>

                <div>
                  <label className="block font-body-sm text-body-sm font-semibold text-on-surface-variant mb-1.5">
                    Connection Type
                  </label>
                  <select
                    value={connectionType}
                    onChange={e => setConnectionType(e.target.value as ConnectionType)}
                    className="nawi-select w-full"
                  >
                    <option value="Demo Simulation">Demo Simulation (no hardware required)</option>
                    <option value="USB">USB</option>
                    <option value="RS-232">RS-232 Serial</option>
                  </select>
                </div>

                {connectionType === 'Demo Simulation' && (
                  <div>
                    <label className="block font-body-sm text-body-sm font-semibold text-on-surface-variant mb-1.5">
                      Simulated Instrument
                    </label>
                    {scenariosLoading ? (
                      <div className="skeleton h-10 w-full" />
                    ) : (
                      <select
                        value={selectedScenarioId}
                        onChange={e => setSelectedScenarioId(e.target.value)}
                        className="nawi-select w-full"
                      >
                        {scenarios.map(s => (
                          <option key={s.scenario_id} value={s.scenario_id}>
                            {s.scenario_name} — {s.interface}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {connectionType !== 'Demo Simulation' && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEF3C7]">
                    <span className="material-symbols-outlined text-[18px] text-[#B45309] flex-shrink-0 mt-0.5">info</span>
                    <span className="font-body-sm text-body-sm text-[#B45309]">
                      No live {connectionType} device detected. Switch to Demo Simulation to run the examination now, or connect real hardware and retry.
                    </span>
                  </div>
                )}

                <button
                  onClick={handleStartExamination}
                  disabled={connecting || (connectionType === 'Demo Simulation' && !selectedScenarioId)}
                  className="btn-primary w-full justify-center py-3 disabled:opacity-60"
                >
                  {connecting ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  )}
                  {connecting ? 'Connecting…' : 'Start Examination'}
                </button>
              </div>

              <div className="mt-space-md bg-surface-container-high rounded-2xl p-space-md flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[18px] flex-shrink-0 mt-0.5">info</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface font-semibold">Prototype Notice:</strong>{' '}
                  This harness demonstrates the OIML R-76 Cl.5.5 / WELMEC 7.2 examination methodology against deterministic demo scenarios. It does not constitute WELMEC certification.
                </p>
              </div>
            </div>
          )}

          {phase === 'EXAM' && run && (
            <div className="space-y-space-md">
              {/* Instrument info bar */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-md">
                  <div className="w-10 h-10 rounded-full bg-[#EEEBFF] text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">usb</span>
                  </div>
                  <div>
                    <div className="font-body-md font-semibold text-on-surface">{run.scenario_name}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">
                      {run.interface} · FW {run.declared_firmware} · CRC {run.declared_checksum}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-space-sm">
                  <button onClick={handleReset} className="btn-secondary text-body-sm">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Terminal window */}
              <div className="bg-[#0B0F19] rounded-2xl p-space-lg shadow-card border border-slate-800 text-slate-100 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 font-body-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                    <span className="ml-2 metrology-mono text-[11px] text-slate-300">WELMEC 7.2 PENETRATION HARNESS v1.0</span>
                  </div>
                  <span className="text-[11px] metrology-mono text-slate-400">
                    {visibleCount}/{run.commands.length} commands executed
                  </span>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 pt-2 pr-1">
                  {visibleCommands.map(c => (
                    <div key={c.test_id} className="p-2 rounded bg-slate-900/60 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] font-bold">[{c.suite}] {c.test_id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.verdict === 'PASS' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                          {c.verdict}
                        </span>
                      </div>
                      <div className="text-slate-300">{c.description}</div>
                      <div className="text-cyan-400 text-[11px]">&gt; {c.command_sent}</div>
                      <div className="text-slate-400 text-[11px]">&lt; {c.response_received}</div>
                      <div className="text-[10px] text-slate-500">Rule: {c.rule}</div>
                    </div>
                  ))}
                  <div ref={feedEndRef} />
                </div>
              </div>

              {/* Summary if complete */}
              {isComplete && (
                <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg space-y-space-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Examination Summary</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {run.summary.passed} of {run.summary.total} commands passed
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full font-label-mono-sm text-sm font-bold uppercase tracking-wider ${
                      run.summary.overall_verdict === 'PASS' ? 'badge-pass' : 'badge-fail'
                    }`}>
                      Overall: {run.summary.overall_verdict}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-space-sm pt-space-sm border-t border-outline-variant/30">
                    <button onClick={handleDownloadReport} disabled={downloadingReport} className="btn-secondary">
                      {downloadingReport ? (
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">download</span>
                      )}
                      {downloadingReport ? 'Generating Report…' : 'Download Examination Report'}
                    </button>
                    <button onClick={handleReset} className="btn-primary">
                      <span className="material-symbols-outlined text-[16px]">replay</span>
                      Run Another Scenario
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
