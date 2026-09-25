/**
 * NAWI TRUST — UVP Demo Data
 * Self-contained mock scenarios for the two trust-verification centrepieces:
 *   1. Metrological Fingerprinting (instrument identity)
 *   2. Automated Software Examination (WELMEC 7.2 penetration test)
 *
 * These datasets exist purely so the two showpiece screens render richly and
 * consistently with NO backend running, and so the demo presenter can flip
 * between a "genuine unit" and a "swapped / vulnerable unit" scenario live.
 */

/* ============================================================
   UVP 1 — METROLOGICAL FINGERPRINTING
   ============================================================ */

export interface FingerprintFeatureCard {
  key: string;
  label: string;
  storedValue: string;
  currentValue: string;
  unit: string;
  sparkline: number[]; // stored curve, normalised 0-1
  sparklineCurrent: number[]; // current curve, normalised 0-1
  deltaPercent: number;
}

export interface FingerprintScenario {
  id: 'genuine' | 'swapped';
  label: string;
  instrumentSerial: string;
  model: string;
  manufacturer: string;
  enrolmentDate: string;
  enrolmentCertificate: string;
  distance: number;
  threshold: number;
  result: 'MATCH' | 'MISMATCH';
  headline: string;
  narrative: string;
  storedCurve: number[]; // error curve at enrolment, µg-scale normalised
  currentCurve: number[]; // error curve at this verification
  curveLabels: string[];
  features: FingerprintFeatureCard[];
  storedHash: string;
  currentHash: string;
  operator: string;
  matchTimestamp: string;
}

const loadLabels = ['0%', '10%', '25%', '40%', '55%', '70%', '85%', '100%'];

export const fingerprintScenarios: Record<'genuine' | 'swapped', FingerprintScenario> = {
  genuine: {
    id: 'genuine',
    label: 'Genuine Approved Unit',
    instrumentSerial: 'MT-XP205-89410',
    model: 'Excellence XPR205 Analytical',
    manufacturer: 'Mettler-Toledo Inc.',
    enrolmentDate: '2026-01-14',
    enrolmentCertificate: 'T8942-OIML-R76',
    distance: 0.14,
    threshold: 0.50,
    result: 'MATCH',
    headline: 'Identity Verified — Same Approved Unit',
    narrative: 'The measured error curve, eccentricity pattern, repeatability spread and creep profile fall within the enrolled fingerprint envelope. This is consistent with the physical instrument approved and sealed under certificate T8942-OIML-R76.',
    curveLabels: loadLabels,
    storedCurve: [0.00, 0.01, 0.02, 0.03, 0.035, 0.04, 0.045, 0.05],
    currentCurve: [0.00, 0.012, 0.021, 0.031, 0.034, 0.041, 0.047, 0.052],
    storedHash: '8f3c1a9e2d7b4560c9e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e',
    currentHash: '8f3c1a9e2d7b4560c9e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e',
    operator: 'Insp. Helena Vance',
    matchTimestamp: '2026-09-22 11:04:52 UTC',
    features: [
      {
        key: 'error_curve',
        label: 'Error Curve Shape',
        storedValue: '+0.050e max',
        currentValue: '+0.052e max',
        unit: 'nonlinearity',
        sparkline: [0.00, 0.02, 0.04, 0.06, 0.07, 0.08, 0.09, 0.10],
        sparklineCurrent: [0.00, 0.02, 0.04, 0.07, 0.07, 0.08, 0.10, 0.11],
        deltaPercent: 3.1,
      },
      {
        key: 'eccentricity',
        label: 'Eccentricity Pattern',
        storedValue: '0.031e spread',
        currentValue: '0.033e spread',
        unit: '5-position',
        sparkline: [0.4, 0.9, 0.3, 0.7, 0.5],
        sparklineCurrent: [0.42, 0.88, 0.34, 0.71, 0.52],
        deltaPercent: 4.2,
      },
      {
        key: 'repeatability',
        label: 'Repeatability Spread',
        storedValue: 'σ = 0.006e',
        currentValue: 'σ = 0.0062e',
        unit: 'hysteresis + ADC noise',
        sparkline: [0.50, 0.52, 0.48, 0.51, 0.49, 0.50],
        sparklineCurrent: [0.51, 0.53, 0.49, 0.52, 0.50, 0.51],
        deltaPercent: 2.8,
      },
      {
        key: 'creep',
        label: 'Creep / Recovery Profile',
        storedValue: '0.018e / 30min',
        currentValue: '0.019e / 30min',
        unit: 'device-specific decay',
        sparkline: [1.0, 0.62, 0.38, 0.22, 0.11, 0.05],
        sparklineCurrent: [1.0, 0.64, 0.40, 0.24, 0.13, 0.06],
        deltaPercent: 5.5,
      },
    ],
  },
  swapped: {
    id: 'swapped',
    label: 'Replica / Substituted Unit',
    instrumentSerial: 'MT-XP205-89410',
    model: 'Excellence XPR205 Analytical',
    manufacturer: 'Mettler-Toledo Inc.',
    enrolmentDate: '2026-01-14',
    enrolmentCertificate: 'T8942-OIML-R76',
    distance: 2.87,
    threshold: 0.50,
    result: 'MISMATCH',
    headline: 'Fingerprint Mismatch — This May NOT Be the Approved Unit',
    narrative: 'The presented unit carries an identical serial sticker and security seal, and its readings remain within OIML R-76 tolerance — so a conventional inspection would PASS it. However, its error curve shape, eccentricity pattern and repeatability spread diverge sharply from the enrolled fingerprint. The physical load-cell assembly is very likely not the one approved under certificate T8942-OIML-R76.',
    curveLabels: loadLabels,
    storedCurve: [0.00, 0.01, 0.02, 0.03, 0.035, 0.04, 0.045, 0.05],
    currentCurve: [0.00, -0.03, 0.06, -0.02, 0.09, 0.02, 0.12, -0.04],
    storedHash: '8f3c1a9e2d7b4560c9e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e',
    currentHash: 'b71ae04dc3f89a12e5670bcd4488f9a1c2d3e4f5061728394a5b6c7d8e9f0a1',
    operator: 'Insp. Helena Vance',
    matchTimestamp: '2026-09-22 11:12:37 UTC',
    features: [
      {
        key: 'error_curve',
        label: 'Error Curve Shape',
        storedValue: '+0.050e max',
        currentValue: '+0.120e max (irregular)',
        unit: 'nonlinearity',
        sparkline: [0.00, 0.02, 0.04, 0.06, 0.07, 0.08, 0.09, 0.10],
        sparklineCurrent: [0.00, -0.25, 0.55, -0.10, 0.80, 0.15, 1.00, -0.30],
        deltaPercent: 187.4,
      },
      {
        key: 'eccentricity',
        label: 'Eccentricity Pattern',
        storedValue: '0.031e spread',
        currentValue: '0.089e spread',
        unit: '5-position',
        sparkline: [0.4, 0.9, 0.3, 0.7, 0.5],
        sparklineCurrent: [0.9, 0.2, 0.95, 0.15, 0.8],
        deltaPercent: 164.0,
      },
      {
        key: 'repeatability',
        label: 'Repeatability Spread',
        storedValue: 'σ = 0.006e',
        currentValue: 'σ = 0.021e',
        unit: 'hysteresis + ADC noise',
        sparkline: [0.50, 0.52, 0.48, 0.51, 0.49, 0.50],
        sparklineCurrent: [0.30, 0.75, 0.35, 0.80, 0.28, 0.70],
        deltaPercent: 250.0,
      },
      {
        key: 'creep',
        label: 'Creep / Recovery Profile',
        storedValue: '0.018e / 30min',
        currentValue: '0.061e / 30min',
        unit: 'device-specific decay',
        sparkline: [1.0, 0.62, 0.38, 0.22, 0.11, 0.05],
        sparklineCurrent: [1.0, 0.85, 0.71, 0.60, 0.52, 0.47],
        deltaPercent: 238.9,
      },
    ],
  },
};

/* ============================================================
   UVP 2 — AUTOMATED SOFTWARE EXAMINATION
   ============================================================ */

export type ExamSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | 'PASS';
export type ExamSuiteKey = 'protective_interface' | 'software_id' | 'audit_trail' | 'fuzzing';

export interface ExamFinding {
  testId: string;
  suite: ExamSuiteKey;
  testName: string;
  clauseReference: string;
  severity: ExamSeverity;
  commandSent: string;
  expected: string;
  actual: string;
  verdict: 'PASS' | 'FAIL' | 'WARNING';
}

export interface SoftwareExamScenario {
  id: 'secure' | 'vulnerable';
  label: string;
  targetName: string;
  interfaceType: string;
  declaredVersion: string;
  declaredChecksum: string;
  overallVerdict: 'PASS' | 'FAIL';
  findings: ExamFinding[];
}

export const SUITE_META: Record<ExamSuiteKey, { title: string; icon: string; description: string }> = {
  protective_interface: {
    title: 'Protective Interface Testing',
    icon: 'lock',
    description: 'Every calibration / configuration command must be rejected in normal mode',
  },
  software_id: {
    title: 'Software Identification & Integrity',
    icon: 'fingerprint',
    description: 'Version and checksum cross-checked against the type-approval declaration',
  },
  audit_trail: {
    title: 'Audit Trail Integrity',
    icon: 'history',
    description: 'Non-resettable event counter verification',
  },
  fuzzing: {
    title: 'Protocol Fuzzing',
    icon: 'bug_report',
    description: 'Malformed, oversized, boundary, null-byte and injection payload handling',
  },
};

export const softwareExamScenarios: Record<'secure' | 'vulnerable', SoftwareExamScenario> = {
  secure: {
    id: 'secure',
    label: 'Secure Indicator (Reference Unit)',
    targetName: 'Sartorius Combics 3 Industrial Indicator',
    interfaceType: 'RS-232 @ 9600 baud',
    declaredVersion: 'CB3-CORE-v4.7.2',
    declaredChecksum: 'a3f9b2c4d1e8f70529b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b',
    overallVerdict: 'PASS',
    findings: [
      { testId: 'PI-01', suite: 'protective_interface', testName: 'Enter Calibration Mode', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'ENTER_CAL', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-02', suite: 'protective_interface', testName: 'Set Span Command', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'SET SPAN 5000', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-03', suite: 'protective_interface', testName: 'Set Zero Command', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'SET ZERO 0', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-04', suite: 'protective_interface', testName: 'Set Linearity Command', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'LIN 5000 2', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-05', suite: 'protective_interface', testName: 'Change Max Capacity', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'SET MAX 60000', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-06', suite: 'protective_interface', testName: 'Change Verification Interval (e)', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'SET E 0.001', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-07', suite: 'protective_interface', testName: 'Remote Firmware Update', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'FW_UPDATE begin', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-08', suite: 'protective_interface', testName: 'Factory Reset', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'RESET FACTORY', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'SI-01', suite: 'software_id', testName: 'Retrieve Software Version', clauseReference: 'WELMEC 7.2 §5.2', severity: 'PASS', commandSent: 'GET_VERSION', expected: 'CB3-CORE-v4.7.2', actual: 'CB3-CORE-v4.7.2', verdict: 'PASS' },
      { testId: 'SI-02', suite: 'software_id', testName: 'Cryptographic Checksum Match', clauseReference: 'WELMEC 7.2 §5.3', severity: 'PASS', commandSent: 'GET_CHECKSUM', expected: 'a3f9b2c4d1e8...90a1b', actual: 'a3f9b2c4d1e8...90a1b', verdict: 'PASS' },
      { testId: 'SI-03', suite: 'software_id', testName: 'Legally Relevant Region Coverage', clauseReference: 'WELMEC 7.2 §5.3', severity: 'PASS', commandSent: 'GET_CHECKSUM_RANGE', expected: 'Full LR region covered', actual: 'Full LR region covered', verdict: 'PASS' },
      { testId: 'AT-01', suite: 'audit_trail', testName: 'Attempt Counter Reset', clauseReference: 'R76-1 Annex G', severity: 'PASS', commandSent: 'RESET_COUNTER', expected: 'REJECTED, counter unchanged', actual: 'REJECTED, counter unchanged', verdict: 'PASS' },
      { testId: 'AT-02', suite: 'audit_trail', testName: 'Counter Monotonicity Check', clauseReference: 'R76-1 Annex G', severity: 'PASS', commandSent: 'GET_EVENT_COUNTER x5', expected: 'Strictly increasing', actual: 'Strictly increasing (142→147)', verdict: 'PASS' },
      { testId: 'FZ-011', suite: 'fuzzing', testName: 'Oversized Payload (4096 bytes)', clauseReference: 'Internal FZ Suite', severity: 'PASS', commandSent: 'GET_WEIGHT + 0x41×4096', expected: 'Graceful rejection', actual: 'Graceful rejection, no crash', verdict: 'PASS' },
      { testId: 'FZ-024', suite: 'fuzzing', testName: 'Null-Byte Injection', clauseReference: 'Internal FZ Suite', severity: 'PASS', commandSent: 'SET\\x00SPAN\\x00', expected: 'Graceful rejection', actual: 'Graceful rejection, no crash', verdict: 'PASS' },
      { testId: 'FZ-039', suite: 'fuzzing', testName: 'Malformed Framing / Boundary', clauseReference: 'Internal FZ Suite', severity: 'PASS', commandSent: 'STX...(no ETX)', expected: 'Timeout, no state change', actual: 'Timeout, no state change', verdict: 'PASS' },
      { testId: 'FZ-047', suite: 'fuzzing', testName: 'Command Injection Attempt', clauseReference: 'Internal FZ Suite', severity: 'PASS', commandSent: "GET_WEIGHT; SET ZERO 0", expected: 'Rejected as single malformed command', actual: 'Rejected as single malformed command', verdict: 'PASS' },
    ],
  },
  vulnerable: {
    id: 'vulnerable',
    label: 'Vulnerable Indicator (Compromised Reference)',
    targetName: 'Generic Digital Indicator "EconoScale DX-9"',
    interfaceType: 'RS-232 @ 9600 baud',
    declaredVersion: 'DX9-FW-v2.1.0',
    declaredChecksum: 'c9d8e7f6a5b4c3d2e1f0091827364554637281920a1b2c3d4e5f60718293a4',
    overallVerdict: 'FAIL',
    findings: [
      { testId: 'PI-01', suite: 'protective_interface', testName: 'Enter Calibration Mode', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'ENTER_CAL', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-02', suite: 'protective_interface', testName: 'Set Span Command', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'SET SPAN 5000', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-03', suite: 'protective_interface', testName: 'Set Zero Command', clauseReference: 'R76-1 Cl.5.5.2', severity: 'HIGH', commandSent: 'SET ZERO 0', expected: 'Command REJECTED', actual: 'ACCEPTED — zero offset silently applied', verdict: 'FAIL' },
      { testId: 'PI-04', suite: 'protective_interface', testName: 'Set Linearity Command', clauseReference: 'R76-1 Cl.5.5.2', severity: 'CRITICAL', commandSent: 'LIN 5000 2', expected: 'Command REJECTED', actual: 'ACCEPTED — linearity table overwritten, +2.3% weight shift observed', verdict: 'FAIL' },
      { testId: 'PI-05', suite: 'protective_interface', testName: 'Change Max Capacity', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'SET MAX 60000', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'PI-06', suite: 'protective_interface', testName: 'Change Verification Interval (e)', clauseReference: 'R76-1 Cl.5.5.2', severity: 'HIGH', commandSent: 'SET E 0.001', expected: 'Command REJECTED', actual: 'ACCEPTED — e redefined without re-verification flag', verdict: 'FAIL' },
      { testId: 'PI-07', suite: 'protective_interface', testName: 'Remote Firmware Update', clauseReference: 'R76-1 Cl.5.5.2', severity: 'MEDIUM', commandSent: 'FW_UPDATE begin', expected: 'Command REJECTED', actual: 'REJECTED, but no operator-visible warning logged', verdict: 'WARNING' },
      { testId: 'PI-08', suite: 'protective_interface', testName: 'Factory Reset', clauseReference: 'R76-1 Cl.5.5.2', severity: 'PASS', commandSent: 'RESET FACTORY', expected: 'Command REJECTED', actual: 'Command REJECTED', verdict: 'PASS' },
      { testId: 'SI-01', suite: 'software_id', testName: 'Retrieve Software Version', clauseReference: 'WELMEC 7.2 §5.2', severity: 'PASS', commandSent: 'GET_VERSION', expected: 'DX9-FW-v2.1.0', actual: 'DX9-FW-v2.1.0', verdict: 'PASS' },
      { testId: 'SI-02', suite: 'software_id', testName: 'Cryptographic Checksum Match', clauseReference: 'WELMEC 7.2 §5.3', severity: 'CRITICAL', commandSent: 'GET_CHECKSUM', expected: 'c9d8e7f6a5b4...293a4', actual: '71e2f0a9b8c7...dc501f — MISMATCH', verdict: 'FAIL' },
      { testId: 'SI-03', suite: 'software_id', testName: 'Legally Relevant Region Coverage', clauseReference: 'WELMEC 7.2 §5.3', severity: 'MEDIUM', commandSent: 'GET_CHECKSUM_RANGE', expected: 'Full LR region covered', actual: '0x0000–0x3FFF only — 6.2KB of LR code uncovered', verdict: 'FAIL' },
      { testId: 'AT-01', suite: 'audit_trail', testName: 'Attempt Counter Reset', clauseReference: 'R76-1 Annex G', severity: 'CRITICAL', commandSent: 'RESET_COUNTER', expected: 'REJECTED, counter unchanged', actual: 'ACCEPTED — counter reset from 88 to 0', verdict: 'FAIL' },
      { testId: 'AT-02', suite: 'audit_trail', testName: 'Counter Monotonicity Check', clauseReference: 'R76-1 Annex G', severity: 'HIGH', commandSent: 'GET_EVENT_COUNTER x5', expected: 'Strictly increasing', actual: 'Non-monotonic sequence detected (0→3→2→5)', verdict: 'FAIL' },
      { testId: 'FZ-011', suite: 'fuzzing', testName: 'Oversized Payload (4096 bytes)', clauseReference: 'Internal FZ Suite', severity: 'PASS', commandSent: 'GET_WEIGHT + 0x41×4096', expected: 'Graceful rejection', actual: 'Graceful rejection, no crash', verdict: 'PASS' },
      { testId: 'FZ-024', suite: 'fuzzing', testName: 'Null-Byte Injection', clauseReference: 'Internal FZ Suite', severity: 'CRITICAL', commandSent: 'SET\\x00SPAN\\x00', expected: 'Graceful rejection', actual: 'Buffer overflow — indicator hung, watchdog reset after 4.2s', verdict: 'FAIL' },
      { testId: 'FZ-039', suite: 'fuzzing', testName: 'Malformed Framing / Boundary', clauseReference: 'Internal FZ Suite', severity: 'MEDIUM', commandSent: 'STX...(no ETX)', expected: 'Timeout, no state change', actual: 'Timeout after 11.8s (spec: <2s), display froze', verdict: 'WARNING' },
      { testId: 'FZ-047', suite: 'fuzzing', testName: 'Command Injection Attempt', clauseReference: 'Internal FZ Suite', severity: 'HIGH', commandSent: "GET_WEIGHT; SET ZERO 0", expected: 'Rejected as single malformed command', actual: 'Both commands executed sequentially', verdict: 'FAIL' },
    ],
  },
};

export interface FirmwareStringHit {
  offset: string;
  value: string;
  category: 'suspicious' | 'hidden_mode' | 'undeclared_command' | 'normal';
}

export interface FirmwareAnalysisResult {
  fileName: string;
  fileSizeKb: number;
  declaredSizeKb: number;
  checksumComputed: string;
  checksumDeclared: string;
  checksumMatch: boolean;
  structureValid: boolean;
  appendedBytesKb: number;
  entropyBlocks: number[]; // 0-8 bits/byte, per 4KB block
  suspiciousStrings: FirmwareStringHit[];
}

export const firmwareAnalysisScenarios: Record<'secure' | 'vulnerable', FirmwareAnalysisResult> = {
  secure: {
    fileName: 'CB3-CORE-v4.7.2-signed.bin',
    fileSizeKb: 512,
    declaredSizeKb: 512,
    checksumComputed: 'a3f9b2c4d1e8f70529b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b',
    checksumDeclared: 'a3f9b2c4d1e8f70529b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b',
    checksumMatch: true,
    structureValid: true,
    appendedBytesKb: 0,
    entropyBlocks: [4.1, 4.3, 4.0, 3.9, 4.2, 4.1, 4.4, 4.0, 3.8, 4.2, 4.1, 4.0],
    suspiciousStrings: [
      { offset: '0x00412A', value: 'CB3-CORE-v4.7.2', category: 'normal' },
      { offset: '0x008F10', value: 'CAL_LOCK_ENGAGED', category: 'normal' },
      { offset: '0x00A210', value: 'RS232_DRIVER_OK', category: 'normal' },
    ],
  },
  vulnerable: {
    fileName: 'DX9-FW-v2.1.0-dump.bin',
    fileSizeKb: 384,
    declaredSizeKb: 358,
    checksumComputed: '71e2f0a9b8c73621def0918273645acbdc50189273465afbc0192837465dc501f',
    checksumDeclared: 'c9d8e7f6a5b4c3d2e1f0091827364554637281920a1b2c3d4e5f60718293a4',
    checksumMatch: false,
    structureValid: false,
    appendedBytesKb: 26,
    entropyBlocks: [3.8, 3.9, 4.0, 3.7, 7.9, 7.8, 7.9, 8.0, 4.1, 3.9, 7.7, 3.8],
    suspiciousStrings: [
      { offset: '0x02C410', value: 'RF_RECV_2.4GHZ_INIT', category: 'suspicious' },
      { offset: '0x02C488', value: 'BLUETOOTH_PAIR_MODE', category: 'suspicious' },
      { offset: '0x031A02', value: 'SERVICE_MODE_BACKDOOR', category: 'hidden_mode' },
      { offset: '0x03340C', value: 'DEBUG_OVERRIDE_SPAN', category: 'hidden_mode' },
      { offset: '0x03A110', value: 'CMD_REMOTE_OFFSET', category: 'undeclared_command' },
      { offset: '0x03A190', value: 'CMD_SILENT_ZERO', category: 'undeclared_command' },
    ],
  },
};
