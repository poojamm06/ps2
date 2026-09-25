import React, { useState, useEffect, useRef } from 'react';
import { useVerification } from '../context/VerificationContext';
import { evidenceApi } from '../services/api';
import type { ApiEvidenceItem } from '../services/api';
import type { EvidenceCardItem } from '../types';

const defaultEvidenceSlots: EvidenceCardItem[] = [
  {
    id: 'slot_nameplate',
    type: 'nameplate',
    title: 'Metrological Nameplate / Type Approval Label',
    timestamp: '—',
    evidenceId: 'EVD-REQ-01',
    status: 'Missing',
  },
  {
    id: 'slot_display',
    type: 'display',
    title: 'Instrument Display Panel & Weight Readout',
    timestamp: '—',
    evidenceId: 'EVD-REQ-02',
    status: 'Missing',
  },
  {
    id: 'slot_seal',
    type: 'seal',
    title: 'Lead Verification Seal & Housing Integrity',
    timestamp: '—',
    evidenceId: 'EVD-REQ-03',
    status: 'Missing',
  },
  {
    id: 'slot_setup',
    type: 'setup',
    title: 'Test Setup Overview & Level Indicator',
    timestamp: '—',
    evidenceId: 'EVD-REQ-04',
    status: 'Missing',
  },
  {
    id: 'slot_test',
    type: 'test',
    title: 'Reference Weight Set & Traceability Stickers',
    timestamp: '—',
    evidenceId: 'EVD-REQ-05',
    status: 'Missing',
  },
];

const statusBadgeClasses: Record<string, string> = {
  'MATCH': 'badge-pass',
  'Verified': 'badge-pass',
  'COMPLETE': 'badge-pass',
  'REVIEW': 'badge-review',
  'Pending Review': 'badge-review',
  'Captured': 'badge-testing',
  'NOT_PROCESSED': 'badge-testing',
  'NOT_DETECTED': 'badge-testing',
  'MISMATCH': 'badge-fail',
  'Missing': 'badge-fail',
  'FAILED': 'badge-fail',
};

const typeIcons: Record<string, string> = {
  'display': 'monitor',
  'nameplate': 'label',
  'seal': 'security',
  'setup': 'settings',
  'test': 'science',
  'document': 'description',
};

export const EvidenceCaptureView: React.FC = () => {
  const { draftSession, setCurrentView } = useVerification();
  const [serverEvidence, setServerEvidence] = useState<ApiEvidenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [processingOcrId, setProcessingOcrId] = useState<number | null>(null);
  const [activeSlotType, setActiveSlotType] = useState<string>('nameplate');
  const [selectedItem, setSelectedItem] = useState<ApiEvidenceItem | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionId = draftSession.backendSessionId;


  // Fetch session evidence items
  const loadEvidence = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setApiError(null);
      const items = await evidenceApi.getSessionEvidence(sessionId);
      setServerEvidence(items);
    } catch (err: any) {
      // Backend may be offline or session doesn't have evidence yet
      console.warn('Could not fetch server evidence:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [sessionId]);

  // Handle file selection and upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!sessionId) {
      setApiError('No active backend session yet — create or resume a test session before capturing evidence.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setUploading(true);
      setApiError(null);
      const refCode = `EVD-${sessionId}-${activeSlotType.toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const uploaded = await evidenceApi.uploadEvidence(
        file,
        sessionId,
        activeSlotType,
        refCode,
        true // auto-OCR
      );
      setServerEvidence(prev => [uploaded, ...prev.filter(x => x.id !== uploaded.id)]);
      setSelectedItem(uploaded);
    } catch (err: any) {
      console.warn('Evidence upload failed:', err?.message);
      setApiError('Could not reach the backend to upload this image. Check your connection and try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Trigger OCR on an item
  const handleTriggerOcr = async (evidenceId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setProcessingOcrId(evidenceId);
      setApiError(null);
      const ocrResult = await evidenceApi.triggerOcr(evidenceId);
      setServerEvidence(prev =>
        prev.map(item =>
          item.id === evidenceId
            ? {
                ...item,
                ocr_status: ocrResult.ocr_status,
                ocr_confidence: ocrResult.ocr_confidence,
                ocr_raw_text: ocrResult.ocr_raw_text,
                ocr_data: ocrResult.ocr_data,
                consistency_status: ocrResult.consistency_status,
                consistency_details: ocrResult.consistency_details,
              }
            : item
        )
      );
      if (selectedItem?.id === evidenceId) {
        setSelectedItem(prev => prev ? {
          ...prev,
          ocr_status: ocrResult.ocr_status,
          ocr_confidence: ocrResult.ocr_confidence,
          ocr_raw_text: ocrResult.ocr_raw_text,
          ocr_data: ocrResult.ocr_data,
          consistency_status: ocrResult.consistency_status,
          consistency_details: ocrResult.consistency_details,
        } : null);
      }
    } catch (err: any) {
      setApiError(err.message || 'OCR execution failed');
    } finally {
      setProcessingOcrId(null);
    }
  };

  const startEditingField = (fieldName: string, currentValue: string | null) => {
    setEditingField(fieldName);
    setEditingValue(currentValue || '');
  };

  const cancelEditingField = () => {
    setEditingField(null);
    setEditingValue('');
  };

  const handleSaveCorrection = async (evidenceId: number, fieldName: string) => {
    if (!editingValue.trim()) return;
    try {
      setSavingField(fieldName);
      const updated = await evidenceApi.correctField(evidenceId, fieldName, editingValue.trim());
      setServerEvidence(prev => prev.map(item => item.id === evidenceId ? updated : item));
      setSelectedItem(prev => prev && prev.id === evidenceId ? updated : prev);
      setEditingField(null);
      setEditingValue('');
    } catch (err: any) {
      console.warn('Could not save field correction:', err?.message);
      setApiError('Could not save this correction — check your connection and try again.');
    } finally {
      setSavingField(null);
    }
  };

  const triggerUploadFor = (type: string) => {
    setActiveSlotType(type);
    fileInputRef.current?.click();
  };

  // Merge default slots with server evidence for rich display
  const displayItems = defaultEvidenceSlots.map(slot => {
    const matchedServer = serverEvidence.find(se => se.evidence_type === slot.type);
    if (matchedServer) {
      return {
        id: matchedServer.id.toString(),
        serverItem: matchedServer,
        type: matchedServer.evidence_type,
        title: slot.title,
        timestamp: new Date(matchedServer.created_at).toLocaleString(),
        evidenceId: matchedServer.evidence_reference || `EVD-${matchedServer.id}`,
        status: matchedServer.consistency_status === 'MATCH' ? 'Verified' :
                matchedServer.consistency_status === 'REVIEW' ? 'Pending Review' :
                matchedServer.consistency_status === 'MISMATCH' ? 'Mismatch' : 'Captured',
        ocrData: matchedServer.ocr_data ? {
          manufacturer: matchedServer.ocr_data.manufacturer?.value || undefined,
          model: matchedServer.ocr_data.model?.value || undefined,
          serialNumber: matchedServer.ocr_data.serial_number?.value || undefined,
          max: matchedServer.ocr_data.max_capacity?.value ? `${matchedServer.ocr_data.max_capacity.value} ${matchedServer.ocr_data.unit?.value || 'kg'}` : undefined,
          min: matchedServer.ocr_data.min_capacity?.value ? `${matchedServer.ocr_data.min_capacity.value} ${matchedServer.ocr_data.unit?.value || 'kg'}` : undefined,
          e: matchedServer.ocr_data.verification_scale_interval_e?.value ? `${matchedServer.ocr_data.verification_scale_interval_e.value} ${matchedServer.ocr_data.unit?.value || 'kg'}` : undefined,
          d: matchedServer.ocr_data.actual_scale_interval_d?.value ? `${matchedServer.ocr_data.actual_scale_interval_d.value} ${matchedServer.ocr_data.unit?.value || 'kg'}` : undefined,
          confidence: matchedServer.ocr_confidence || 0,
        } : undefined,
      };
    }
    return {
      ...slot,
      serverItem: undefined,
    };
  });

  const capturedCount = displayItems.filter(e => e.status !== 'Missing').length;
  const verifiedCount = displayItems.filter(e => e.status === 'Verified').length;

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/tiff,image/bmp"
        className="hidden"
      />

      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">
                STEP 3 // EVIDENCE CAPTURE & OCR
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono-sm text-label-mono-sm uppercase font-bold">
                SESSION: {draftSession.sessionId || (sessionId ? `SESSION-${sessionId}` : 'No active session')}
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">Digital Evidence Vault</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Photographic evidence capture, automated OpenCV/Neural OCR parameter extraction, and OIML R-76 consistency checks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="text-center px-space-md py-space-sm bg-surface-container-low rounded-lg border border-outline-variant/30">
              <div className="metrology-mono text-2xl font-bold text-on-tertiary-container">{verifiedCount}/{displayItems.length}</div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase">Verified</div>
            </div>
            <button
              onClick={() => triggerUploadFor('nameplate')}
              disabled={uploading}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                {uploading ? 'hourglass_top' : 'add_a_photo'}
              </span>
              {uploading ? 'Processing Image...' : 'Capture Photo'}
            </button>
            <button
              onClick={loadEvidence}
              disabled={loading}
              className="btn-secondary"
            >
              <span className="material-symbols-outlined text-[16px]">
                {loading ? 'refresh' : 'sync'}
              </span>
              Refresh Vault
            </button>
          </div>
        </div>

        {/* API Error Notification */}
        {apiError && (
          <div className="mt-space-md p-space-sm rounded-lg bg-error-container/40 border border-error/30 text-error flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="text-sm font-medium">{apiError}</span>
            </div>
            <button onClick={() => setApiError(null)} className="text-xs uppercase hover:underline">Dismiss</button>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-space-md">
          <div className="flex items-center justify-between mb-1">
            <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">Evidence Capture & Verification Progress</span>
            <span className="font-label-mono-sm text-label-mono-sm text-secondary font-bold">{capturedCount}/{displayItems.length} items</span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded overflow-hidden">
            <div className="bg-secondary h-full transition-all" style={{ width: `${(capturedCount / displayItems.length) * 100}%` }}></div>
          </div>
        </div>
      </section>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
        {displayItems.map(item => {
          const isUploaded = !!item.serverItem;
          const serverId = item.serverItem?.id;
          const fileUrl = serverId ? evidenceApi.getFileUrl(serverId) : null;
          const isProcessing = processingOcrId === serverId;

          return (
            <div
              key={item.id}
              onClick={() => item.serverItem && setSelectedItem(selectedItem?.id === serverId ? null : item.serverItem)}
              className={`bg-surface-container-lowest rounded-xl shadow-card border cursor-pointer transition-all hover:shadow-card-hover flex flex-col justify-between ${
                selectedItem?.id === serverId ? 'border-secondary shadow-card-hover' : 'border-outline-variant/20'
              }`}
            >
              <div>
                {/* Image Container / Preview */}
                <div className={`w-full h-44 rounded-t-xl relative overflow-hidden flex flex-col items-center justify-center ${
                  item.status === 'Missing'
                    ? 'bg-error-container/20 border-b border-error/20'
                    : 'bg-surface-container-low border-b border-outline-variant/20'
                }`}>
                  {isUploaded && fileUrl ? (
                    <img
                      src={fileUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : item.status === 'Missing' ? (
                    <>
                      <span className="material-symbols-outlined text-[32px] text-error/60">image_not_supported</span>
                      <span className="font-label-mono-sm text-label-mono-sm text-error mt-2 font-semibold">NOT YET CAPTURED</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[32px] text-on-primary-container">{typeIcons[item.type]}</span>
                      <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant mt-2 uppercase">{item.type}</span>
                    </>
                  )}

                  {/* Evidence Type Badge overlay */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-surface-container-highest/90 backdrop-blur-sm text-on-surface font-label-mono-sm text-[10px] uppercase font-bold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-[12px]">{typeIcons[item.type]}</span>
                    {item.type}
                  </span>
                </div>

                {/* Card Info */}
                <div className="p-space-md">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-body-md font-semibold text-on-surface text-sm leading-tight">{item.title}</div>
                    <span className={statusBadgeClasses[item.status] || 'badge-testing'}>{item.status}</span>
                  </div>
                  <div className="font-label-mono-sm text-label-mono-sm text-outline mb-2">{item.evidenceId} • {item.timestamp}</div>

                  {/* OCR Data if available */}
                  {item.ocrData && (
                    <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/30 mt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">document_scanner</span>
                          OCR Extracted
                        </span>
                        <span className="font-label-mono-sm text-label-mono-sm text-on-tertiary-container font-bold">
                          {item.ocrData.confidence}% conf.
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {[
                          ['OEM', item.ocrData.manufacturer],
                          ['Model', item.ocrData.model],
                          ['S/N', item.ocrData.serialNumber],
                          ['Max', item.ocrData.max],
                          ['e', item.ocrData.e],
                          ['d', item.ocrData.d],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div key={k} className="flex gap-1 truncate">
                            <span className="font-label-mono-sm text-label-mono-sm text-outline">{k}:</span>
                            <span className="metrology-mono text-[11px] text-on-surface font-medium truncate">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-space-md pt-0">
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-outline-variant/20">
                  <button
                    onClick={() => triggerUploadFor(item.type)}
                    className="btn-ghost flex-1 justify-center text-[11px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    {item.status === 'Missing' ? 'Capture' : 'Retake'}
                  </button>
                  {isUploaded && serverId && (
                    <button
                      onClick={(e) => handleTriggerOcr(serverId, e)}
                      disabled={isProcessing}
                      className="btn-ghost flex-1 justify-center text-[11px]"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isProcessing ? 'hourglass_top' : 'document_scanner'}
                      </span>
                      {isProcessing ? 'Reading...' : 'Run OCR'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Item Detail & Metrological Consistency Panel */}
      {selectedItem && (
        <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card border border-secondary/30 mt-space-md">
          <div className="flex items-center justify-between mb-space-md border-b border-outline-variant/20 pb-space-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-secondary">verified</span>
              <h2 className="font-display-md text-lg text-primary">
                Evidence Details & Consistency Verification: {selectedItem.evidence_reference}
              </h2>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-on-surface-variant hover:text-primary text-xs uppercase font-label-mono-sm"
            >
              Close Panel ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
            {/* Left: Raw OCR Output & Details */}
            <div>
              <h3 className="font-label-mono-sm text-label-mono-sm text-secondary uppercase font-bold mb-2">
                Raw Extracted OCR Text
              </h3>
              <div className="p-space-md bg-surface-container-low rounded-lg border border-outline-variant/30 font-mono text-xs text-on-surface max-h-48 overflow-y-auto whitespace-pre-wrap">
                {selectedItem.ocr_raw_text || 'No raw text extracted.'}
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs font-label-mono-sm text-outline flex-wrap">
                <span>Status: <strong className="text-on-surface">{selectedItem.ocr_status}</strong></span>
                <span>Confidence: <strong className="text-on-tertiary-container">{selectedItem.ocr_confidence || 0}%</strong></span>
                <span>Size: <strong className="text-on-surface">{Math.round((selectedItem.file_size_bytes || 0) / 1024)} KB</strong></span>
                {selectedItem.was_mock_extraction && (
                  <span className="badge-testing">Demo Mode — Simulated Extraction</span>
                )}
              </div>
            </div>

            {/* Right: Metrological Consistency Cross-Check */}
            <div>
              <h3 className="font-label-mono-sm text-label-mono-sm text-secondary uppercase font-bold mb-2">
                OIML R-76 Cross-Check vs Registered Instrument
              </h3>
              <div className="p-space-md bg-surface-container-low rounded-lg border border-outline-variant/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-on-surface">Overall Consistency Status:</span>
                  <span className={statusBadgeClasses[selectedItem.consistency_status] || 'badge-testing'}>
                    {selectedItem.consistency_status}
                  </span>
                </div>

                {/* Field-by-field check details */}
                {selectedItem.consistency_details && (() => {
                  try {
                    const parsed = JSON.parse(selectedItem.consistency_details);
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-on-surface-variant italic mb-2">{parsed.summary}</p>
                        {parsed.field_checks && parsed.field_checks.length > 0 ? (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-outline-variant/30 text-outline text-left font-label-mono-sm">
                                <th className="pb-1">Parameter</th>
                                <th className="pb-1">Extracted</th>
                                <th className="pb-1">Registered</th>
                                <th className="pb-1 text-right">Verdict</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/10">
                              {parsed.field_checks.map((chk: any, idx: number) => (
                                <tr key={idx} className="py-1">
                                  <td className="py-1 font-medium">{chk.label}</td>
                                  <td className="py-1 metrology-mono">{chk.extracted}</td>
                                  <td className="py-1 metrology-mono">{chk.registered}</td>
                                  <td className="py-1 text-right">
                                    <span className={chk.status === 'MATCH' ? 'text-pass font-bold' : 'text-fail font-bold'}>
                                      {chk.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                      </div>
                    );
                  } catch {
                    return <p className="text-xs text-on-surface-variant">{selectedItem.consistency_details}</p>;
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Metrological Fields — Review & Correct */}
          {selectedItem.ocr_data && (
            <div className="mt-space-lg pt-space-md border-t border-outline-variant/20">
              <h3 className="font-label-mono-sm text-label-mono-sm text-secondary uppercase font-bold mb-2">
                Metrological Fields — Review &amp; Correct
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                Inspect each extracted field. If OCR misread a value, correct it below — corrections are tracked separately from the original extraction and re-evaluated against the registered instrument.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  ['manufacturer', 'Manufacturer'],
                  ['model', 'Model'],
                  ['serial_number', 'Serial Number'],
                  ['max_capacity', 'Max Capacity'],
                  ['min_capacity', 'Min Capacity'],
                  ['verification_scale_interval_e', 'Verification Interval (e)'],
                  ['actual_scale_interval_d', 'Actual Interval (d)'],
                  ['accuracy_class', 'Accuracy Class'],
                  ['unit', 'Unit'],
                  ['software_id', 'Software / Firmware ID'],
                  ['approval_certificate_number', 'Approval Certificate No.'],
                ] as const).map(([fieldKey, label]) => {
                  const field = selectedItem.ocr_data![fieldKey];
                  const isEditing = editingField === fieldKey;
                  const isSaving = savingField === fieldKey;
                  const bandClass = field.confidence_band === 'HIGH' ? 'badge-pass'
                    : field.confidence_band === 'MEDIUM' ? 'badge-review'
                    : field.confidence_band === 'NEEDS_REVIEW' ? 'badge-fail'
                    : 'badge-testing';
                  const bandLabel = field.confidence_band === 'HIGH' ? 'High'
                    : field.confidence_band === 'MEDIUM' ? 'Medium'
                    : field.confidence_band === 'NEEDS_REVIEW' ? 'Needs Review'
                    : '—';
                  return (
                    <div key={fieldKey} className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-on-surface-variant">{label}</span>
                        <div className="flex items-center gap-1">
                          {field.is_corrected && (
                            <span className="badge-testing !text-[9px]" title={field.raw_ocr_value ? `OCR read: ${field.raw_ocr_value}` : undefined}>
                              Manually Corrected
                            </span>
                          )}
                          {field.value && !field.is_corrected && bandLabel !== '—' && (
                            <span className={`${bandClass} !text-[9px]`}>{bandLabel}</span>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border border-secondary text-xs metrology-mono bg-surface-container-lowest text-on-surface focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveCorrection(selectedItem.id, fieldKey)}
                            disabled={isSaving}
                            className="p-1 rounded text-on-tertiary-container hover:bg-surface-container"
                            title="Save correction"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isSaving ? 'hourglass_top' : 'check'}
                            </span>
                          </button>
                          <button
                            onClick={cancelEditingField}
                            className="p-1 rounded text-error hover:bg-surface-container"
                            title="Cancel"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1">
                          <span className="metrology-mono text-xs text-on-surface truncate">
                            {field.value || <span className="text-outline italic">Not detected</span>}
                          </span>
                          <button
                            onClick={() => startEditingField(fieldKey, field.value)}
                            className="flex-shrink-0 p-1 rounded text-outline hover:text-secondary hover:bg-surface-container"
                            title="Correct this field"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Navigation Footer */}
      <footer className="bg-surface-container-lowest p-space-md rounded-xl shadow-card flex flex-col sm:flex-row items-center justify-between gap-space-md mt-space-md">
        <button
          onClick={() => setCurrentView('compliance')}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Compliance
        </button>
        <button
          onClick={() => setCurrentView('reports')}
          className="btn-primary"
        >
          <span>Proceed to Certificate &amp; Report</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </footer>
    </>
  );
};
