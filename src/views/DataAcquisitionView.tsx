import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVerification } from '../context/VerificationContext';
import { defaultDemoStaticPoints } from '../context/VerificationContext';
import type { StaticWeighingPoint } from '../types';
import {
  webSerialService,
  isWebSerialSupported,
  type SerialConfig,
  type SerialConnectionInfo,
} from '../services/webSerial';
import type { ScaleReading } from '../services/scaleParser';

export const DataAcquisitionView: React.FC = () => {
  const { 
    draftSession, 
    updateDraft, 
    setCurrentView,
  } = useVerification();

  // Local observation points linked to draftSession
  const [points, setPoints] = useState<StaticWeighingPoint[]>(() => {
    if (draftSession.staticWeighingPoints && draftSession.staticWeighingPoints.length > 0) {
      return draftSession.staticWeighingPoints;
    }
    return defaultDemoStaticPoints;
  });

  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // Keep in sync with draftSession
  useEffect(() => {
    if (draftSession.staticWeighingPoints && draftSession.staticWeighingPoints.length > 0) {
      setPoints(draftSession.staticWeighingPoints);
    }
  }, [draftSession.staticWeighingPoints]);

  // Metrological constants
  const unit = draftSession.unit || 'g';
  const maxCapacity = draftSession.maxCapacity || 2100;
  const e = draftSession.verificationScaleInterval_e || 0.1;
  const d = draftSession.actualScaleInterval_d || 0.01;
  const accuracyClass = draftSession.accuracyClass || 'II';

  // Hardware connection state
  const [serialSupported] = useState<boolean>(() => isWebSerialSupported());
  const [connectionInfo, setConnectionInfo] = useState<SerialConnectionInfo>(() =>
    webSerialService.getConnectionInfo()
  );
  const [liveReading, setLiveReading] = useState<ScaleReading | null>(null);
  const [connType, setConnType] = useState<'USB' | 'RS-232'>('USB');
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [dataBits, setDataBits] = useState<7 | 8>(8);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [stopBits, setStopBits] = useState<1 | 2>(1);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [autoCapture, setAutoCapture] = useState<boolean>(false);
  const [targetPointIndex, setTargetPointIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastAutoValRef = useRef<number | null>(null);

  // Sync scale interval (d) with the scale frame parser
  useEffect(() => {
    webSerialService.setScaleInterval(d);
  }, [d]);

  // Subscribe to serial port status and live reading stream
  useEffect(() => {
    const unsubStatus = webSerialService.onStatusChange(info => {
      setConnectionInfo(info);
      if (info.status === 'disconnected' || info.status === 'connection_lost') {
        setLiveReading(null);
        setAutoCapture(false);
        lastAutoValRef.current = null;
      }
    });

    const unsubReading = webSerialService.onReading(reading => {
      setLiveReading(reading);
    });

    return () => {
      unsubStatus();
      unsubReading();
    };
  }, []);

  const handleConnectHardware = async () => {
    setIsConnecting(true);
    try {
      const config: SerialConfig = {
        baudRate,
        dataBits,
        stopBits,
        parity,
        connectionType: connType,
      };
      const ok = await webSerialService.connect(config);
      if (ok) {
        setToastMessage(`Connected to ${connType} weighing instrument.`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: unknown) {
      console.warn('WebSerial connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectHardware = async () => {
    await webSerialService.disconnect();
    setLiveReading(null);
    setAutoCapture(false);
    lastAutoValRef.current = null;
    setToastMessage('Instrument disconnected.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Capture Reading: assign to current target test point
  const handleCaptureReading = useCallback(() => {
    if (!liveReading || !liveReading.stable) return;
    const currentPoints = pointsRef.current;
    if (currentPoints.length === 0) return;

    const idx = Math.min(targetPointIndex, currentPoints.length - 1);
    const targetPoint = currentPoints[idx];
    if (!targetPoint) return;

    const decimals = d >= 1 ? 0 : d >= 0.1 ? 1 : d >= 0.01 ? 2 : d >= 0.001 ? 3 : 4;
    const formattedVal = liveReading.value.toFixed(decimals);

    const updated = currentPoints.map((pt, i) =>
      i === idx ? { ...pt, indication: formattedVal, source: connType as 'USB' | 'RS-232' } : pt
    );

    setPoints(updated);
    updateDraft({ staticWeighingPoints: updated });

    setToastMessage(`Captured ${formattedVal} ${liveReading.unit} → Test Point #${targetPoint.pointNumber}`);
    setTimeout(() => setToastMessage(null), 2500);

    // Auto-advance to next test point if available
    if (idx + 1 < currentPoints.length) {
      setTargetPointIndex(idx + 1);
    }
  }, [liveReading, targetPointIndex, d, connType, updateDraft]);

  // Auto-capture when reading stabilizes on a new load
  useEffect(() => {
    if (!autoCapture || !liveReading || !liveReading.stable) return;
    const currentPoints = pointsRef.current;
    if (currentPoints.length === 0) return;

    if (
      lastAutoValRef.current !== null &&
      Math.abs(liveReading.value - lastAutoValRef.current) < 0.5 * d
    ) {
      return;
    }

    let targetIdx = currentPoints.findIndex(
      (pt, i) => i >= targetPointIndex && pt.indication.trim() === ''
    );
    if (targetIdx === -1) {
      targetIdx = currentPoints.findIndex(pt => pt.indication.trim() === '');
    }
    if (targetIdx === -1) {
      return;
    }

    const targetPoint = currentPoints[targetIdx];
    const decimals = d >= 1 ? 0 : d >= 0.1 ? 1 : d >= 0.01 ? 2 : d >= 0.001 ? 3 : 4;
    const formattedVal = liveReading.value.toFixed(decimals);

    lastAutoValRef.current = liveReading.value;

    const updated = currentPoints.map((pt, i) =>
      i === targetIdx ? { ...pt, indication: formattedVal, source: connType as 'USB' | 'RS-232' } : pt
    );

    setPoints(updated);
    updateDraft({ staticWeighingPoints: updated });

    setTargetPointIndex(Math.min(targetIdx + 1, currentPoints.length - 1));
    setToastMessage(`Auto-captured ${formattedVal} ${liveReading.unit} → Test Point #${targetPoint.pointNumber}`);
    setTimeout(() => setToastMessage(null), 2500);
  }, [autoCapture, liveReading, targetPointIndex, d, connType, updateDraft]);

  const currentTargetPoint = useMemo(() => {
    if (points.length === 0) return null;
    const idx = Math.min(targetPointIndex, points.length - 1);
    return points[idx];
  }, [points, targetPointIndex]);

  const capturedCount = useMemo(() => {
    return points.filter(p => p.indication && p.indication.trim() !== '').length;
  }, [points]);

  return (
    <div className="space-y-space-md max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white text-xs px-4 py-3 rounded-xl shadow-card flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Context Summary Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-card border border-outline-variant/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1.5">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">cable</span>
                DATA ACQUISITION // HARDWARE INTERFACE
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono-sm text-[11px] font-bold uppercase">
                WEB SERIAL API
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">
              Physical Instrument Data Acquisition
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Connect weighing balance via USB or RS-232 serial port. Live weight readings are captured directly into verification test points.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setCurrentView('observations')}
              className="btn-primary text-xs h-[42px] px-5 font-semibold flex items-center gap-2"
            >
              <span>View Observations Table</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Metrological Specifications Pill Bar */}
        <div className="mt-space-md pt-space-md border-t border-outline-variant/30 grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-mono text-xs">
          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Instrument</span>
            <span className="font-bold text-primary truncate block" title={`${draftSession.manufacturer} ${draftSession.model}`}>
              {draftSession.manufacturer || 'RADWAG'} {draftSession.model || 'PS 2100.R2'}
            </span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Accuracy Class</span>
            <span className="font-bold text-secondary text-sm">Class {accuracyClass}</span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Capacity &amp; Interval</span>
            <span className="font-bold text-primary">{maxCapacity}{unit} | e={e}{unit} (d={d}{unit})</span>
          </div>

          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="text-outline text-[10px] block uppercase">Acquisition Progress</span>
            <span className="font-bold text-primary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              {capturedCount} of {points.length} Points Captured
            </span>
          </div>
        </div>
      </section>

      {/* 2. Main Hardware Acquisition Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        {/* Left Column: Connection & Live Reading (7 cols) */}
        <div className="lg:col-span-7 space-y-space-md">
          {/* Card A: Instrument Connection */}
          <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-card border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px]">settings_input_component</span>
                </div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Instrument Connection
                </h2>
              </div>

              {/* Status Badge */}
              {connectionInfo.status === 'connected' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
                  ● CONNECTED — {connectionInfo.portLabel}
                </span>
              ) : connectionInfo.status === 'connection_lost' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEE2E2] text-error flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  ● Disconnected — connection lost
                </span>
              ) : connectionInfo.status === 'connecting' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#EEEBFF] text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  Connecting…
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface-container text-outline flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-outline"></span>
                  ● DISCONNECTED
                </span>
              )}
            </div>

            {/* Browser Check */}
            {!serialSupported && (
              <div className="p-3 bg-[#FEF3C7] text-[#B45309] rounded-xl flex items-center gap-2 text-xs font-medium">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Live acquisition requires Chrome or Edge. Manual entry works normally.</span>
              </div>
            )}

            {/* Connection Lost Banner */}
            {connectionInfo.status === 'connection_lost' && (
              <div className="p-3 bg-[#FEE2E2] text-error rounded-xl flex items-center justify-between gap-2 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>Hardware connection lost ({connectionInfo.errorMessage || 'device unplugged'}). Observations are preserved.</span>
                </div>
                <button
                  type="button"
                  onClick={handleConnectHardware}
                  disabled={isConnecting}
                  className="btn-primary text-xs h-[30px] px-3 font-semibold"
                >
                  Reconnect
                </button>
              </div>
            )}

            {/* Serial Settings Form */}
            {connectionInfo.status !== 'connected' ? (
              <div className="space-y-space-md">
                {connectionInfo.errorMessage && connectionInfo.status !== 'connection_lost' && (
                  <div className="p-2.5 rounded-lg bg-[#FEE2E2] text-error text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    <span>{connectionInfo.errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                      Connection Type
                    </label>
                    <select
                      value={connType}
                      onChange={e => setConnType(e.target.value as 'USB' | 'RS-232')}
                      className="nawi-select w-full text-xs"
                    >
                      <option value="USB">USB</option>
                      <option value="RS-232">RS-232</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                      Baud Rate
                    </label>
                    <select
                      value={baudRate}
                      onChange={e => setBaudRate(Number(e.target.value))}
                      className="nawi-select w-full text-xs"
                    >
                      <option value={1200}>1200</option>
                      <option value={2400}>2400</option>
                      <option value={4800}>4800</option>
                      <option value={9600}>9600</option>
                      <option value={19200}>19200</option>
                      <option value={38400}>38400</option>
                      <option value={57600}>57600</option>
                      <option value={115200}>115200</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                      Data Bits
                    </label>
                    <select
                      value={dataBits}
                      onChange={e => setDataBits(Number(e.target.value) as 7 | 8)}
                      className="nawi-select w-full text-xs"
                    >
                      <option value={8}>8</option>
                      <option value={7}>7</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                      Parity
                    </label>
                    <select
                      value={parity}
                      onChange={e => setParity(e.target.value as 'none' | 'even' | 'odd')}
                      className="nawi-select w-full text-xs"
                    >
                      <option value="none">None</option>
                      <option value="even">Even</option>
                      <option value="odd">Odd</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                      Stop Bits
                    </label>
                    <select
                      value={stopBits}
                      onChange={e => setStopBits(Number(e.target.value) as 1 | 2)}
                      className="nawi-select w-full text-xs"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleConnectHardware}
                      disabled={isConnecting || !serialSupported}
                      className="btn-primary w-full text-xs h-[38px] justify-center font-semibold"
                    >
                      <span className="material-symbols-outlined text-[16px]">cable</span>
                      {isConnecting ? 'Opening Port…' : 'Connect Instrument'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-primary font-mono">
                    Port: {connectionInfo.portLabel}
                  </div>
                  <div className="text-[11px] text-outline font-mono">
                    Framing: {connectionInfo.baudRate} baud, {connectionInfo.dataBits}-{connectionInfo.parity[0].toUpperCase()}-{connectionInfo.stopBits}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectHardware}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-error hover:bg-error-container/20 border border-error/20 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Card B: Live Reading */}
          <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-card border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-space-sm">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider font-bold">
                LIVE READING STREAM
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-outline">
                <span>Acquisition Source:</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  {connType}
                </span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-[11px] uppercase font-bold text-outline tracking-wider">
                LIVE WEIGHT
              </span>
              <div className="font-mono text-4xl sm:text-5xl font-black text-primary tracking-tight">
                {liveReading !== null
                  ? `${liveReading.value.toFixed(d >= 1 ? 0 : d >= 0.1 ? 1 : d >= 0.01 ? 2 : d >= 0.001 ? 3 : 4)} ${liveReading.unit || unit}`
                  : `-- ${unit}`}
              </div>

              <div>
                {liveReading ? (
                  liveReading.stable ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] inline-flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
                      ● STABLE
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#B45309] inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse"></span>
                      ◌ DYNAMIC
                    </span>
                  )
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-mono text-outline bg-surface-container inline-block">
                    Awaiting instrument data packet…
                  </span>
                )}
              </div>
            </div>

            {liveReading?.raw && (
              <div className="p-2.5 rounded-lg bg-surface-container text-xs font-mono flex items-center justify-between text-outline">
                <span>Raw ASCII Frame:</span>
                <span className="font-bold text-primary">{JSON.stringify(liveReading.raw)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Target Point & Capture Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-space-md">
          {/* Card C: Current Test Point & Action */}
          <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-card border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-space-sm">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider font-bold">
                CURRENT TEST POINT
              </span>
              <span className="text-xs font-mono text-secondary font-bold">
                Point {currentTargetPoint ? String(currentTargetPoint.pointNumber).padStart(2, '0') : '--'} of {points.length}
              </span>
            </div>

            {currentTargetPoint ? (
              <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-outline">Applied Load Reference:</span>
                  <span className="font-mono text-base font-bold text-primary">
                    {currentTargetPoint.appliedLoad || '0.00'} {unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-outline">Current Indication:</span>
                  <span className="font-mono text-sm font-semibold text-secondary">
                    {currentTargetPoint.indication ? `${currentTargetPoint.indication} ${unit}` : '— (Pending)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-outline">Acquisition Source:</span>
                  <span className="font-mono text-xs font-bold text-primary">
                    {currentTargetPoint.source || (currentTargetPoint.indication ? 'MANUAL' : '—')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-space-md text-xs text-outline text-center">No points configured</div>
            )}

            {/* Selector Buttons */}
            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                onClick={() => setTargetPointIndex(prev => Math.max(0, prev - 1))}
                disabled={targetPointIndex === 0}
                className="btn-secondary text-xs h-[36px] flex-1 justify-center disabled:opacity-40"
              >
                ← Prev Point
              </button>
              <button
                type="button"
                onClick={() => setTargetPointIndex(prev => Math.min(points.length - 1, prev + 1))}
                disabled={targetPointIndex >= points.length - 1}
                className="btn-secondary text-xs h-[36px] flex-1 justify-center disabled:opacity-40"
              >
                Next Point →
              </button>
            </div>

            {/* Action Buttons */}
            <div className="space-y-space-sm pt-space-xs">
              <button
                type="button"
                onClick={handleCaptureReading}
                disabled={!liveReading || !liveReading.stable}
                className={`btn-primary w-full text-xs h-[44px] justify-center font-bold shadow-md ${
                  !liveReading || !liveReading.stable ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={
                  !liveReading || !liveReading.stable
                    ? 'Wait for scale weight to stabilize'
                    : 'Capture current stable weight into current test point'
                }
              >
                <span className="material-symbols-outlined text-[18px]">touch_app</span>
                <span>Capture Reading ({liveReading?.stable ? 'Stable' : 'Waiting'})</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoCapture(prev => !prev)}
                className={`w-full h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  autoCapture
                    ? 'bg-[#EEEBFF] text-primary border-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:text-primary border-outline-variant/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${autoCapture ? 'bg-primary animate-pulse' : 'bg-outline'}`}></span>
                Auto Capture: {autoCapture ? 'ON (Active)' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Card D: Test Points Queue (Acquisition Summary) */}
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-card border border-outline-variant/40 space-y-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <span className="font-label-mono-sm text-[11px] text-outline uppercase tracking-wider font-bold">
                ACQUISITION QUEUE
              </span>
              <span className="text-[11px] text-outline font-mono">
                Click row to target
              </span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {points.map((pt, idx) => {
                const isTarget = idx === targetPointIndex;
                const hasInd = pt.indication && pt.indication.trim() !== '';
                const isHardware = pt.source === 'USB' || pt.source === 'RS-232';

                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setTargetPointIndex(idx)}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                      isTarget
                        ? 'bg-[#EEEBFF] border-primary ring-1 ring-primary'
                        : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary w-6">
                        #{String(pt.pointNumber).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-on-surface">
                        L: {pt.appliedLoad || '0.00'}{unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-secondary">
                        {hasInd ? `${pt.indication} ${unit}` : 'Pending'}
                      </span>
                      {isHardware ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary text-white font-bold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">cable</span>
                          {pt.source}
                        </span>
                      ) : hasInd ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-container text-outline flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">edit</span>
                          Manual
                        </span>
                      ) : (
                        <span className="text-[10px] text-outline">--</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-space-xs">
              <button
                type="button"
                onClick={() => setCurrentView('observations')}
                className="btn-secondary w-full text-xs h-[38px] justify-center font-semibold text-primary"
              >
                <span>Proceed to Observations &amp; Verification →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
