import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  softwareExamApi,
  type SoftwareExamCommand,
  type SoftwareExamRunResult,
  type SoftwareExamScenarioSummary,
} from '../services/api';
import { mockScenarioSummaries, mockRunScenario } from '../mock/softwareExamScenarios';

type ConnectionType = 'USB' | 'RS-232' | 'Demo Simulation';
type Phase = 'CONNECT' | 'EXAM';

const SUITE_LABELS: Record<string, string> = {
  PROTECTIVE_INTERFACE: 'Protective Interface Testing',
  SOFTWARE_IDENTIFICATION: 'Software Identification & Integrity',
  AUDIT_TRAIL: 'Audit Trail Integrity',
  PROTOCOL_FUZZING: 'Protocol Fuzzing',
};

const severityClass = (sev: SoftwareExamCommand['severity']): string => {
  switch (sev) {
    case 'CRITICAL': return 'sev-critical';
    case 'HIGH': return 'sev-high';
    case 'MEDIUM': return 'sev-medium';
    case 'LOW': return 'sev-low';
    default: return 'sev-pass';
  }
};

export const SoftwareVerificationView: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('CONNECT');

  // Connection panel state
  const [connectionType, setConnectionType] = useState<ConnectionType>('Demo Simulation');
  const [scenarios, setScenarios] = useState<SoftwareExamScenarioSummary[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  // Live examination state
  const [run, setRun] = useState<SoftwareExamRunResult | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // Load scenario list — real backend first, deterministic mock fallback on failure.
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

  // Stream commands in one at a time.
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

  // Fallback used only when the backend PDF endpoint is unreachable — a
  // printable HTML document with the same layout/content as the PDF.
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

    const criticalRows = result.commands.filter(c => c.verdict === 'FAIL');

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
          <tr><td>Declared Firmware</td><td>${escapeHtml(result.declared_firmware)}</td></tr>
          <tr><td>Declared Checksum</td><td class="mono">${escapeHtml(result.declared_checksum)}</td></tr>
        </table>
        ${suiteOrder.map(suiteTable).join('')}
        <div class="banner">
          SOFTWARE EXAMINATION: ${result.summary.overall_verdict}<br/>
          <span style="font-weight:normal;font-size:11px;">${result.summary.total} tests completed — ${result.summary.passed} passed, ${result.summary.failed} failed</span>
        </div>
        ${criticalRows.length > 0 ? `
          <h2>Critical Findings</h2>
          <table>
            <thead><tr><th>ID</th><th>Description</th><th>Severity</th><th>Reason</th></tr></thead>
            <tbody>${criticalRows.map(c => `<tr class="fail"><td>${c.test_id}</td><td>${escapeHtml(c.description)}</td><td>${c.severity || '—'}</td><td>${escapeHtml(c.response_received)}</td></tr>`).join('')}</tbody>
          </table>` : ''}
        <div class="notice">PROTOTYPE NOTICE: This is a prototype demonstration harness modeled on OIML R-76 Cl.5.5 / Annex G and WELMEC Guide 7.2 methodology. It does not constitute actual WELMEC certification. Not for statutory use.</div>
        <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }, []);

  const handleDownloadReport = useCallback(async () => {
    if (!run) return;
    setDownloadingReport(true);
    try {
      // Real backend first — a proper generated PDF.
      const blob = await softwareExamApi.downloadReportPdf(run);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `NAWI_SoftwareExam_${run.scenario_id}_${dateStr}.pdf`;
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
    <div className="fade-in space-y-space-lg">
      {/* Page header */}
      <section>
        <div className="flex flex-wrap items-center gap-space-xs mb-1.5">
          <span className="badge-testing">UVP 2 — Automated Software Examination</span>
          <span className="oiml-class-iii !py-1">WELMEC 7.2 + R76-1 Cl.5.5</span>
        </div>
        <h1 className="font-display-md text-display-md text-on-surface tracking-tight">
          Legally-Relevant Software Penetration Test
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
          Connect to the instrument's interface to begin automated examination.
        </p>
      </section>

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
                className="nawi-select"
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
                    className="nawi-select"
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
                  {run.interface} · Firmware {run.declared_firmware} · Checksum {run.declared_checksum}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="metrology-mono text-lg font-bold text-primary">{visibleCount}/{run.commands.length}</div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">commands executed</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(visibleCount / run.commands.length) * 100}%` }}
            />
          </div>

          {/* Live command feed */}
          <div className="space-y-space-sm max-h-[560px] overflow-y-auto pr-1">
            {visibleCommands.map((cmd, idx) => {
              const prevSuite = idx > 0 ? visibleCommands[idx - 1].suite : null;
              const showDivider = cmd.suite !== prevSuite;
              const isFail = cmd.verdict === 'FAIL';
              return (
                <React.Fragment key={cmd.test_id}>
                  {showDivider && (
                    <div className="flex items-center gap-3 pt-space-sm">
                      <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold whitespace-nowrap">
                        {SUITE_LABELS[cmd.suite] || cmd.suite}
                      </span>
                      <div className="flex-1 h-px bg-outline-variant" />
                    </div>
                  )}
                  <div
                    className={`fade-in rounded-2xl border p-space-md ${
                      isFail ? 'bg-[#FEE2E2]/40 border-error/30' : 'bg-[#DCFCE7]/40 border-[#16A34A]/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-space-sm mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-label-mono-sm text-label-mono-sm text-outline flex-shrink-0">{cmd.test_id}</span>
                        <span className="font-body-md font-semibold text-on-surface truncate">{cmd.description}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {cmd.severity && <span className={severityClass(cmd.severity)}>{cmd.severity}</span>}
                        {isFail ? <span className="badge-fail">FAIL ✗</span> : <span className="badge-pass">PASS ✓</span>}
                      </div>
                    </div>
                    <div className="metrology-mono text-xs space-y-1">
                      <div className="text-on-surface-variant">→ Sent: <span className="text-on-surface">{cmd.command_sent}</span></div>
                      <div className="text-on-surface-variant">← Received: <span className={isFail ? 'text-error font-semibold' : 'text-on-surface'}>{cmd.response_received}</span></div>
                    </div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                      <span className="font-semibold text-on-surface">Rule:</span> {cmd.rule}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {!isComplete && (
              <div className="flex items-center gap-2 p-space-md text-on-surface-variant font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Executing {run.commands[visibleCount]?.test_id}…
              </div>
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Summary — appended once the feed finishes */}
          {isComplete && (
            <div className="fade-in space-y-space-md">
              <div className={`rounded-2xl shadow-card p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md ${
                run.summary.overall_verdict === 'PASS' ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'
              }`}>
                <div className="flex items-center gap-space-md">
                  <span className={`material-symbols-outlined text-[40px] ${run.summary.overall_verdict === 'PASS' ? 'text-[#15803D]' : 'text-error'}`}>
                    {run.summary.overall_verdict === 'PASS' ? 'verified_user' : 'gpp_bad'}
                  </span>
                  <div>
                    <div className={`font-display-md text-display-md font-bold ${run.summary.overall_verdict === 'PASS' ? 'text-[#15803D]' : 'text-error'}`}>
                      SOFTWARE EXAMINATION: {run.summary.overall_verdict}
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {run.summary.total} tests completed: {run.summary.passed} passed, {run.summary.failed} failed
                      {run.summary.failed > 0 && (
                        <> ({run.commands.filter(c => c.severity === 'CRITICAL').length} critical, {run.commands.filter(c => c.severity === 'HIGH').length} high)</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {run.summary.failed > 0 && (
                <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-space-md">Critical Findings</h3>
                  <div className="space-y-2">
                    {run.commands.filter(c => c.verdict === 'FAIL').map(c => (
                      <div key={c.test_id} className="flex items-center gap-space-sm p-space-sm rounded-xl bg-[#FEE2E2]/40">
                        <span className="font-label-mono-sm text-label-mono-sm text-outline flex-shrink-0">{c.test_id}</span>
                        <span className="font-body-sm font-semibold text-on-surface flex-1 min-w-0 truncate">{c.description}</span>
                        {c.severity && <span className={severityClass(c.severity)}>{c.severity}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-space-sm">
                <button onClick={handleDownloadReport} disabled={downloadingReport} className="btn-secondary disabled:opacity-60">
                  {downloadingReport
                    ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-[16px]">download</span>}
                  {downloadingReport ? 'Generating PDF…' : 'Download Examination Report'}
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
  );
};
