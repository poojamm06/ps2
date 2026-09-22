import React, { useState, useEffect, useCallback } from 'react';
import { useVerification } from '../context/VerificationContext';
import {
  repositoryApi,
  reportsApi,
  type RepositoryItem,
  type InstrumentHistoryResponse,
} from '../services/api';

export const DigitalRepositoryView: React.FC = () => {
  const { selectSession, databaseConnected } = useVerification();
  const [items, setItems] = useState<RepositoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<string>('');

  // Selected instrument history modal
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [instrumentHistory, setInstrumentHistory] = useState<InstrumentHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchRepository = useCallback(async () => {
    setLoading(true);
    try {
      const res = await repositoryApi.search({
        q: searchQuery || undefined,
        accuracy_class: classFilter || undefined,
        status_filter: statusFilter || undefined,
        verdict_filter: verdictFilter || undefined,
      });
      setItems(res.items || []);
    } catch (err) {
      console.warn('Could not fetch repository from backend:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, classFilter, statusFilter, verdictFilter]);

  useEffect(() => {
    fetchRepository();
  }, [fetchRepository]);

  const handleOpenHistory = async (instrumentId: number) => {
    setSelectedInstrumentId(instrumentId);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const hist = await repositoryApi.getInstrumentHistory(instrumentId);
      setInstrumentHistory(hist);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load instrument history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setSelectedInstrumentId(null);
    setInstrumentHistory(null);
  };

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">
                CORE MODULE // DIGITAL REPOSITORY
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono-sm text-label-mono-sm uppercase font-bold">
                TRACEABILITY ARCHIVE
              </span>
              {databaseConnected && (
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-label-mono-sm font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                  POSTGRESQL SOURCE OF TRUTH
                </span>
              )}
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              National Metrological Digital Repository
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Centralized register of verified Non-Automatic Weighing Instruments (NAWI), multi-session verification history, and official certificates.
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button onClick={fetchRepository} disabled={loading} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">{loading ? 'refresh' : 'sync'}</span>
              Refresh Registry
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-space-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-sm">
          <div className="lg:col-span-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search S/N, Model, Make, or Officer..."
                className="nawi-input pl-9 text-[13px]"
              />
              <span className="material-symbols-outlined text-outline absolute left-2.5 top-2.5 text-[18px]">
                search
              </span>
            </div>
          </div>

          <div>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="nawi-select text-[12px]"
            >
              <option value="">All Accuracy Classes</option>
              <option value="Class I">Class I (Special)</option>
              <option value="Class II">Class II (High)</option>
              <option value="Class III">Class III (Medium)</option>
              <option value="Class IV">Class IV (Ordinary)</option>
            </select>
          </div>

          <div>
            <select
              value={verdictFilter}
              onChange={e => setVerdictFilter(e.target.value)}
              className="nawi-select text-[12px]"
            >
              <option value="">All Verdicts</option>
              <option value="PASS">PASS (Conforming)</option>
              <option value="FAIL">FAIL (Non-Conforming)</option>
              <option value="REVIEW">REVIEW Required</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="nawi-select text-[12px]"
            >
              <option value="">All Session Statuses</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
        </div>
      </section>

      {/* Instruments Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex items-center justify-between p-space-lg border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">
                REGISTERED NAWI INSTRUMENTS
              </div>
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                Instrument Registry &amp; Verification Status
              </h2>
            </div>
          </div>
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant font-medium">
            {items.length} Registered Instrument(s) Found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="nawi-table">
            <thead>
              <tr>
                <th>Instrument / Designation</th>
                <th>Serial Number (S/N)</th>
                <th>Manufacturer</th>
                <th>Accuracy Class &amp; Capacity</th>
                <th>Latest Session</th>
                <th>Total Sessions</th>
                <th>Latest Verdict</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-on-surface-variant">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[20px] text-secondary">
                          progress_activity
                        </span>
                        <span>Loading Digital Repository from PostgreSQL...</span>
                      </div>
                    ) : (
                      <div>
                        <span className="material-symbols-outlined text-[36px] text-outline mb-2 block">
                          inventory_2
                        </span>
                        <p className="font-semibold text-primary">No instruments matching criteria</p>
                        <p className="text-xs text-outline mt-1">
                          Register a new instrument or adjust your search filters.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const inst = item.instrument;
                  const latest = item.latest_session;
                  const verdict = item.overall_verdict;
                  const verdictBadgeClass =
                    verdict === 'PASS'
                      ? 'badge-pass'
                      : verdict === 'FAIL'
                      ? 'badge-fail'
                      : verdict === 'REVIEW'
                      ? 'badge-review'
                      : 'badge-testing';

                  return (
                    <tr key={inst.id} className="hover:bg-surface-container-lowest/70 transition-colors">
                      <td>
                        <div>
                          <span className="font-body-md font-semibold text-primary block">
                            {inst.model}
                          </span>
                          <span className="text-[11px] text-outline block">{inst.functional_type}</span>
                        </div>
                      </td>
                      <td>
                        <span className="metrology-mono text-[12px] font-bold text-secondary">
                          {inst.serial_number}
                        </span>
                      </td>
                      <td>
                        <span className="font-body-sm text-body-sm text-on-surface">
                          {inst.manufacturer}
                        </span>
                      </td>
                      <td>
                        <div className="text-[12px]">
                          <span className="font-semibold text-primary block">
                            {inst.accuracy_class}
                          </span>
                          <span className="metrology-mono text-outline text-[11px]">
                            Max {inst.max_capacity} {inst.unit} (e={inst.verification_scale_interval_e} {inst.unit})
                          </span>
                        </div>
                      </td>
                      <td>
                        {latest ? (
                          <div className="text-[12px]">
                            <span className="metrology-mono font-medium text-primary block">
                              {latest.session_code}
                            </span>
                            <span className="text-[11px] text-outline block">
                              {latest.verification_date} • {latest.officer_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-outline text-[11px]">No sessions</span>
                        )}
                      </td>
                      <td>
                        <span className="metrology-mono text-[12px] font-bold px-2 py-0.5 rounded bg-surface-container text-primary">
                          {item.total_sessions} session(s)
                        </span>
                      </td>
                      <td>
                        <span className={verdictBadgeClass}>{verdict}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenHistory(inst.id)}
                            className="btn-secondary px-2 py-1 text-[11px]"
                            title="View multi-session history"
                          >
                            <span className="material-symbols-outlined text-[14px]">history</span>
                            History
                          </button>
                          {latest && (
                            <button
                              onClick={() => selectSession(latest.session_code)}
                              className="btn-ghost px-2 py-1 text-[11px]"
                              title="Open session in verification workspace"
                            >
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                              Open
                            </button>
                          )}
                          {latest && (
                            <a
                              href={reportsApi.getPdfUrl(latest.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-outline hover:text-secondary hover:bg-surface-container transition-colors"
                              title="Download Official PDF Certificate"
                            >
                              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instrument History Modal / Drawer */}
      {selectedInstrumentId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-space-lg bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[22px]">history</span>
                </div>
                <div>
                  <h3 className="font-display-md text-lg font-bold">Instrument Lifecycle &amp; Verification History</h3>
                  <p className="text-xs text-on-primary-container">
                    {instrumentHistory?.instrument.manufacturer} {instrumentHistory?.instrument.model} — S/N: {instrumentHistory?.instrument.serial_number}
                  </p>
                </div>
              </div>
              <button
                onClick={closeHistory}
                className="w-8 h-8 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/40 flex items-center justify-center text-on-primary"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-space-lg overflow-y-auto flex-1 space-y-space-md">
              {historyLoading ? (
                <div className="py-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-[28px] text-secondary">
                    progress_activity
                  </span>
                  <span>Loading full instrument session logs from PostgreSQL...</span>
                </div>
              ) : historyError ? (
                <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm">
                  {historyError}
                </div>
              ) : instrumentHistory && instrumentHistory.history.length === 0 ? (
                <div className="py-8 text-center text-outline">
                  No verification sessions recorded for this instrument yet.
                </div>
              ) : (
                instrumentHistory?.history.map((sess, idx) => (
                  <div
                    key={sess.session_id}
                    className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold">
                          SESSION #{instrumentHistory.history.length - idx}
                        </span>
                        <span className="metrology-mono text-[13px] font-bold text-primary">
                          {sess.session_code}
                        </span>
                        <span className="text-xs text-outline">
                          ({sess.verification_date})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={sess.compliance_verdict === 'PASS' ? 'badge-pass' : 'badge-fail'}>
                          {sess.compliance_verdict || 'PENDING'}
                        </span>
                        <a
                          href={reportsApi.getPdfUrl(sess.session_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary py-1 px-2.5 text-[11px]"
                        >
                          <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                          PDF Certificate
                        </a>
                        <button
                          onClick={() => {
                            selectSession(sess.session_code);
                            closeHistory();
                          }}
                          className="btn-primary py-1 px-2.5 text-[11px]"
                        >
                          Open Session
                        </button>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-outline block">Officer:</span>
                        <span className="font-semibold text-on-surface">{sess.officer_name}</span>
                      </div>
                      <div>
                        <span className="text-outline block">Location:</span>
                        <span className="font-semibold text-on-surface">{sess.test_location}</span>
                      </div>
                      <div>
                        <span className="text-outline block">Environment:</span>
                        <span className="metrology-mono text-on-surface">
                          {sess.temperature_c ? `${sess.temperature_c}°C` : '21.4°C'}, {sess.relative_humidity_pct ? `${sess.relative_humidity_pct}% RH` : '48% RH'}
                        </span>
                      </div>
                      <div>
                        <span className="text-outline block">Test Points:</span>
                        <span className="metrology-mono text-on-surface font-bold">
                          {sess.readings_count} recorded ({sess.passed_readings} PASS, {sess.failed_readings} FAIL)
                        </span>
                      </div>
                    </div>

                    {/* Observations mini table */}
                    {sess.readings.length > 0 && (
                      <div className="mt-2 bg-surface-container-lowest rounded-lg p-2 border border-outline-variant/20 overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-outline text-left border-b border-outline-variant/20 font-label-mono-sm">
                              <th className="pb-1">Test Point</th>
                              <th className="pb-1">Ref Load</th>
                              <th className="pb-1">Indicated</th>
                              <th className="pb-1">Error</th>
                              <th className="pb-1">MPE</th>
                              <th className="pb-1 text-right">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10">
                            {sess.readings.map(r => (
                              <tr key={r.id}>
                                <td className="py-1">{r.test_point}</td>
                                <td className="py-1 metrology-mono">{r.reference_value.toFixed(4)} {r.unit}</td>
                                <td className="py-1 metrology-mono">{r.indicated_value.toFixed(4)} {r.unit}</td>
                                <td className="py-1 metrology-mono font-semibold">
                                  {r.error >= 0 ? '+' : ''}{r.error.toFixed(4)} {r.unit}
                                </td>
                                <td className="py-1 metrology-mono">±{r.mpe.toFixed(4)} {r.unit}</td>
                                <td className="py-1 text-right">
                                  <span className={r.result === 'PASS' ? 'text-pass font-bold' : 'text-fail font-bold'}>
                                    {r.result}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-space-md bg-surface-container-low border-t border-outline-variant/20 flex justify-end">
              <button onClick={closeHistory} className="btn-secondary">
                Close Repository View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
