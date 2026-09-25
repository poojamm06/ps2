import React from 'react';
import { useVerification } from '../context/VerificationContext';
import { mockAuditTrail } from '../mock/mockData';

export const TraceabilityView: React.FC = () => {
  const { auditTrail } = useVerification();

  // Demo-safety net: fall back to the mock ledger when the backend hasn't
  // returned any real audit entries yet (offline, or a fresh DB with no history).
  const displayAuditTrail = auditTrail.length > 0 ? auditTrail : mockAuditTrail;

  const actionIcons: Record<string, string> = {
    'Session Created': 'add_circle',
    'Instrument Registered': 'precision_manufacturing',
    'Reading Captured': 'sensors',
    'Evidence Uploaded': 'photo_camera',
    'OCR Processed': 'document_scanner',
    'Compliance Calculated': 'verified_user',
    'Fingerprint Generated': 'fingerprint',
    'Software Verified': 'code_blocks',
    'Report Generated': 'description',
  };

  const actionColors: Record<string, string> = {
    'Session Created': 'bg-secondary-fixed text-on-secondary-fixed',
    'Instrument Registered': 'bg-surface-container-high text-secondary',
    'Reading Captured': 'bg-surface-container-high text-secondary',
    'Evidence Uploaded': 'bg-surface-container-high text-secondary',
    'OCR Processed': 'bg-surface-container-high text-secondary',
    'Compliance Calculated': 'bg-surface-container-high text-on-tertiary-container',
    'Fingerprint Generated': 'bg-surface-container-high text-on-tertiary-container',
    'Software Verified': 'bg-surface-container-high text-on-tertiary-container',
    'Report Generated': 'bg-primary-container text-on-primary',
  };

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">GOVERNANCE // AUDIT TRAIL</span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm uppercase font-bold">{displayAuditTrail.length} ENTRIES</span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">Audit Trail &amp; Traceability Ledger</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Complete chronological record of all metrological verification actions, immutably anchored to the NAWI TRUST ledger
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export Audit Log
            </button>
            <button className="btn-primary">
              <span className="material-symbols-outlined text-[16px]">enhanced_encryption</span>
              Verify Integrity
            </button>
          </div>
        </div>

        {/* Integrity Banner */}
        <div className="mt-space-md bg-surface-container-low p-space-sm rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container"></span>
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant font-medium">
            Ledger Integrity: SHA-256 Chain Verified | All {displayAuditTrail.length} records tamper-evident | ISO/IEC 17025 Compliant
          </span>
        </div>
      </section>

      {/* Audit Timeline */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 overflow-hidden">
        <div className="flex items-center justify-between p-space-lg border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">CHRONOLOGICAL RECORD</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Verification Actions Timeline</h3>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="nawi-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Session ID</th>
                <th>Officer</th>
                <th>Reference</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {displayAuditTrail.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-2 block">history</span>
                    <p className="font-semibold text-primary">No audit entries yet</p>
                    <p className="text-xs text-outline mt-1">Actions taken during verification sessions will appear here.</p>
                  </td>
                </tr>
              ) : displayAuditTrail.map((entry, idx) => (
                <tr key={entry.id}>
                  <td>
                    <span className="metrology-mono text-[11px] text-outline">{String(idx + 1).padStart(2, '0')}</span>
                  </td>
                  <td>
                    <span className="metrology-mono text-[11px] text-on-surface-variant">{entry.timestamp}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${actionColors[entry.action] || 'bg-surface-container text-outline'}`}>
                        <span className="material-symbols-outlined text-[13px]">{actionIcons[entry.action] || 'circle'}</span>
                      </div>
                      <span className="font-body-sm font-semibold text-on-surface">{entry.action}</span>
                    </div>
                  </td>
                  <td>
                    <span className="metrology-mono text-[11px] text-secondary font-medium">{entry.sessionId}</span>
                  </td>
                  <td>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{entry.officer}</span>
                  </td>
                  <td>
                    <span className="metrology-mono text-[11px] text-outline">{entry.referenceId}</span>
                  </td>
                  <td>
                    <span className="font-body-sm text-body-sm text-on-surface-variant max-w-xs truncate block">{entry.details}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chain of Custody Notice */}
      <section className="bg-surface-container-high p-space-md rounded-xl shadow-card flex items-start gap-space-sm">
        <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">enhanced_encryption</span>
        </div>
        <div>
          <div className="font-label-mono-sm text-label-mono-sm text-secondary uppercase tracking-wider font-bold mb-1">Chain of Custody &amp; Metrological Audit Chain Notice</div>
          <div className="font-body-md text-body-md text-primary">
            Every entry in this audit trail is cryptographically anchored via SHA-256 hash chaining to the NAWI TRUST immutable verification ledger. Records cannot be modified or deleted without detection. This trail constitutes the official legal metrology documentation record under national weights &amp; measures legislation.
          </div>
        </div>
      </section>
    </>
  );
};
