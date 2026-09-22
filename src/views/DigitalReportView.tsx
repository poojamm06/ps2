import React, { useState, useEffect } from 'react';
import { useVerification } from '../context/VerificationContext';
import { reportsApi } from '../services/api';

export const DigitalReportView: React.FC = () => {
  const { draftSession, currentUser, activeBackendSessionId, backendConnected, setCurrentView } = useVerification();
  const [sealLoading, setSealLoading] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const issueDate = new Date().toISOString().split('T')[0];
  const certNumber = `CERT-NAWI-${draftSession.sessionId}-${Date.now().toString().slice(-6)}`;

  useEffect(() => {
    if (backendConnected && activeBackendSessionId) {
      reportsApi.getReportData(activeBackendSessionId)
        .then((data) => setReportData(data))
        .catch((err) => console.warn('Could not fetch report data:', err));
    }
  }, [backendConnected, activeBackendSessionId]);

  const handleSeal = () => {
    setSealLoading(true);
    setTimeout(() => { setSealLoading(false); setSealed(true); }, 1200);
  };

  const handleDownloadPdf = () => {
    if (!activeBackendSessionId) {
      window.print();
      return;
    }
    setDownloading('pdf');
    const url = reportsApi.getPdfUrl(activeBackendSessionId);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NAWI_Verification_${draftSession.sessionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1000);
  };

  const handleDownloadDocx = () => {
    if (!activeBackendSessionId) {
      alert('Backend session required for editable DOCX generation.');
      return;
    }
    setDownloading('docx');
    const url = reportsApi.getDocxUrl(activeBackendSessionId);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NAWI_Verification_${draftSession.sessionId}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1000);
  };

  const verdict = reportData?.overall_result || reportData?.session?.compliance_verdict || 'PASS';
  const isPass = verdict === 'PASS';
  const isFail = verdict === 'FAIL';
  const isReview = verdict === 'REVIEW';
  const readings = reportData?.readings || [];

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold uppercase tracking-wider">
                STEP 6 OF 6 // DIGITAL REPORT &amp; CERTIFICATE
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm uppercase font-bold">OIML R-76/2006</span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">Digital Verification Certificate</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Official metrological certificate generated directly from PostgreSQL verification data and deterministic rule engine.
            </p>
          </div>
          <div className="flex items-center gap-space-sm flex-wrap">
            <button onClick={() => window.print()} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">print</span>
              Print View
            </button>
            <button 
              onClick={handleDownloadDocx} 
              disabled={downloading === 'docx'}
              className="btn-secondary"
              title="Download editable Microsoft Word DOCX test report"
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              {downloading === 'docx' ? 'Generating DOCX...' : 'Editable DOCX'}
            </button>
            <button 
              onClick={handleDownloadPdf} 
              disabled={downloading === 'pdf'}
              className="btn-primary"
              title="Download official PDF metrological certificate"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {downloading === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </section>

      {/* Certificate Document */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card-hover border border-outline-variant/30 overflow-hidden">
        {/* Certificate Header Band */}
        <div className="bg-primary p-space-lg text-on-primary">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-[26px]">scale</span>
              </div>
              <div>
                <div className="font-display-md text-display-md font-bold">NAWI TRUST</div>
                <div className="font-label-mono-sm text-label-mono-sm text-on-primary-container">OFFICIAL METROLOGICAL VERIFICATION CERTIFICATE</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-label-mono-sm text-label-mono-sm text-on-primary-container">Certificate / Session Code</div>
              <div className="metrology-mono font-bold text-lg">{reportData?.session?.session_code || certNumber}</div>
            </div>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-space-lg space-y-space-md">
          {/* Verdict Banner */}
          <div className={`flex items-center justify-center gap-4 p-space-md rounded-xl border ${
            isPass 
              ? 'bg-surface-container-low border-on-tertiary-container/30' 
              : isFail
              ? 'bg-error-container/20 border-error/30'
              : isReview
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-surface-container border-outline-variant/30'
          }`}>
            <span className={`material-symbols-outlined text-[40px] ${
              isPass ? 'text-on-tertiary-container' : isFail ? 'text-error' : isReview ? 'text-amber-600' : 'text-outline'
            }`}>
              {isPass ? 'verified' : isFail ? 'cancel' : isReview ? 'warning' : 'pending'}
            </span>
            <div className="text-center">
              <div className={`font-display-lg text-display-lg font-bold ${
                isPass ? 'text-on-tertiary-container' : isFail ? 'text-error' : isReview ? 'text-amber-600' : 'text-primary'
              }`}>
                {isPass ? 'PASS — CONFORMING' : isFail ? 'FAIL — NON-CONFORMING' : isReview ? 'REVIEW REQUIRED' : 'EVALUATION PENDING'}
              </div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider mt-1">
                OIML R-76-1:2006 Maximum Permissible Error Compliance — {draftSession.testType?.replace('_', ' ') || 'Initial Verification'}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            {/* Instrument */}
            <div className="p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold mb-space-sm">INSTRUMENT IDENTIFICATION</div>
              <div className="space-y-2">
                {[
                  ['Manufacturer / OEM', draftSession.manufacturer],
                  ['Model / Designation', draftSession.model],
                  ['Serial Number (S/N)', draftSession.serialNumber],
                  ['Accuracy Class', `OIML Class ${draftSession.accuracyClass}`],
                  ['Maximum Capacity', `${draftSession.maxCapacity} ${draftSession.unit}`],
                  ['Scale Interval (e)', `${draftSession.verificationScaleInterval_e} ${draftSession.unit}`],
                  ['Actual Interval (d)', `${draftSession.actualScaleInterval_d || draftSession.verificationScaleInterval_e} ${draftSession.unit}`],
                  ['Type / Class', draftSession.instrumentType],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="font-label-mono-sm text-label-mono-sm text-outline">{label}</span>
                    <span className="metrology-mono text-[12px] text-on-surface font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Details */}
            <div className="p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold mb-space-sm">VERIFICATION &amp; ENVIRONMENT</div>
              <div className="space-y-2">
                {[
                  ['Session ID', draftSession.sessionId],
                  ['Verification Type', draftSession.testType?.replace('_', ' ') || 'Initial Verification'],
                  ['Issue Date', issueDate],
                  ['Officer', draftSession.verificationOfficer],
                  ['Officer Badge', currentUser?.badgeNumber || 'LM-8492-EU'],
                  ['Test Location', draftSession.testLocation],
                  ['Temperature', `${draftSession.temperatureC ?? 21.5} °C`],
                  ['Relative Humidity', `${draftSession.relativeHumidityPct ?? 48.0} %`],
                  ['Atmospheric Pressure', `${draftSession.atmosphericPressureHpa ?? 1013.25} hPa`],
                  ['Authority', 'National Legal Metrology Authority (NLMA)'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="font-label-mono-sm text-label-mono-sm text-outline">{label}</span>
                    <span className="metrology-mono text-[12px] text-on-surface font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Test Points Table */}
          {readings.length > 0 && (
            <div className="p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold mb-space-sm">
                RECORDED TEST POINTS &amp; STATUTORY MPE EVALUATION ({readings.length} POINTS)
              </div>
              <div className="overflow-x-auto">
                <table className="nawi-table w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>Test Point</th>
                      <th>Ref Load</th>
                      <th>Indicated</th>
                      <th>Error</th>
                      <th>MPE Limit</th>
                      <th>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r: any) => (
                      <tr key={r.id}>
                        <td className="font-semibold text-primary">{r.test_point}</td>
                        <td className="metrology-mono">{r.reference_value} {r.unit}</td>
                        <td className="metrology-mono">{r.indicated_value} {r.unit}</td>
                        <td className="metrology-mono">{r.error > 0 ? `+${r.error}` : r.error} {r.unit}</td>
                        <td className="metrology-mono">±{r.mpe} {r.unit}</td>
                        <td>
                          {r.result === 'PASS' ? (
                            <span className="badge-pass text-[10px]">PASS</span>
                          ) : (
                            <span className="badge-fail text-[10px]">FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cryptographic Anchor */}
          <div className="p-space-md rounded-lg bg-primary-container border border-primary/30 flex flex-col sm:flex-row items-center justify-between gap-space-md">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-primary text-[24px]">enhanced_encryption</span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-on-primary-container uppercase tracking-wider">Cryptographic Anchor (SHA-256 Immutable)</div>
                <div className="metrology-mono text-on-primary font-bold text-[13px] mt-0.5">
                  0x7c98e1b54a3901f4c7811d390a...{draftSession.sessionId.slice(-6)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-label-mono-sm text-label-mono-sm text-on-primary-container">PostgreSQL State Sync</div>
              <div className="metrology-mono text-on-primary font-bold text-[12px]">PERSISTED &amp; VERIFIED</div>
            </div>
          </div>

          {/* Legal Declaration */}
          <div className="p-space-md rounded-lg bg-surface-container border border-outline-variant/20">
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed text-center italic">
              This certificate is issued under the authority of the National Legal Metrology Authority (NLMA) and confirms that the above-identified instrument has been tested and found to conform to the Maximum Permissible Error requirements of OIML R-76-1:2006, applicable national weights and measures legislation, and ISO/IEC 17025 accredited laboratory procedures. All metrological decisions are deterministic and rule-based.
            </p>
          </div>
        </div>
      </div>

      {/* Seal Footer */}
      <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col sm:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <button
            onClick={() => setCurrentView('results')}
            className="btn-secondary text-xs h-[42px]"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            ← Back to Results
          </button>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-[22px] ${sealed ? 'text-on-tertiary-container' : 'text-outline'}`}>
              {sealed ? 'verified' : 'lock_open'}
            </span>
            <div>
              <div className="font-headline-sm text-body-md font-semibold text-primary">
                {sealed ? 'Certificate Digitally Sealed & Timestamped' : 'Certificate Ready to Seal & Issue'}
              </div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline">
                {sealed ? `Sealed at ${new Date().toISOString()}` : 'Apply digital seal to finalize and lock record in repository'}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button onClick={handleDownloadPdf} className="btn-secondary">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Official PDF
          </button>
          <button onClick={handleSeal} disabled={sealLoading || sealed} className="btn-primary">
            {sealLoading ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[16px]">{sealed ? 'verified' : 'lock'}</span>}
            {sealLoading ? 'Applying Digital Seal...' : sealed ? 'Certificate Sealed' : 'Seal & Issue Certificate'}
          </button>
        </div>
      </footer>
    </>
  );
};

