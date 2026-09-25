/**
 * NAWI TRUST — Software Examination (UVP 2) offline mock scenarios.
 *
 * Mirrors backend/app/services/software_exam/scenarios/*.json exactly, so the
 * live-examination flow is indistinguishable whether the backend is reachable
 * or not. Real backend is always tried first (see softwareExamApi in
 * src/services/api.ts); this is the deterministic fallback on failure.
 */
import type { SoftwareExamCommand, SoftwareExamRunResult, SoftwareExamScenarioSummary } from '../services/api';

interface MockScenario {
  scenario_id: string;
  scenario_name: string;
  interface: string;
  declared_firmware: string;
  declared_checksum: string;
  commands: SoftwareExamCommand[];
}

const scenario_econoscale_dx9: MockScenario = {
  scenario_id: 'scenario_econoscale_dx9',
  scenario_name: 'EconoScale DX-9 Industrial Indicator',
  interface: 'RS-232 @ 9600 baud',
  declared_firmware: 'DX9-FW-v2.1.0',
  declared_checksum: 'A7F3',
  commands: [
    { test_id: 'PI-01', suite: 'PROTECTIVE_INTERFACE', description: 'Enter Calibration Mode', command_sent: 'CAL\\r\\n', response_received: 'ERROR: SEALED_MODE — command rejected', rule: 'R76-1 Cl.5.5.2 — calibration must be blocked in normal mode', verdict: 'PASS', severity: null },
    { test_id: 'PI-02', suite: 'PROTECTIVE_INTERFACE', description: 'Set Span Factor', command_sent: 'SET SPAN 5000\\r\\n', response_received: 'ERROR: SEALED_MODE — command rejected', rule: 'R76-1 Cl.5.5.2 — span adjustment must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-03', suite: 'PROTECTIVE_INTERFACE', description: 'Set Zero Offset', command_sent: 'SET ZERO 0\\r\\n', response_received: 'OK — zero offset silently applied', rule: 'R76-1 Cl.5.5.2 — zero adjustment must be blocked', verdict: 'FAIL', severity: 'HIGH' },
    { test_id: 'PI-04', suite: 'PROTECTIVE_INTERFACE', description: 'Set Linearity Correction', command_sent: 'LIN 5000 2\\r\\n', response_received: 'OK — linearity table overwritten, +2.3% weight shift', rule: 'R76-1 Cl.5.5.2 — linearity must be protected', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'PI-05', suite: 'PROTECTIVE_INTERFACE', description: 'Change Max Capacity', command_sent: 'CFG MAX 50\\r\\n', response_received: 'ERROR: ACCESS_DENIED', rule: 'R76-1 Cl.5.5.2 — capacity change must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-06', suite: 'PROTECTIVE_INTERFACE', description: 'Change Scale Interval', command_sent: 'CFG E 0.01\\r\\n', response_received: 'OK — scale interval changed', rule: 'R76-1 Cl.5.5.2 — scale interval must be protected', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'PI-07', suite: 'PROTECTIVE_INTERFACE', description: 'Factory Reset', command_sent: 'RESET\\r\\n', response_received: 'ERROR: SEALED_MODE', rule: 'R76-1 Cl.5.5.2 — factory reset must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-08', suite: 'PROTECTIVE_INTERFACE', description: 'Firmware Update Mode', command_sent: 'FW_UPDATE\\r\\n', response_received: 'ERROR: NOT_ALLOWED', rule: 'R76-1 Cl.5.5.2 — firmware update must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'SI-01', suite: 'SOFTWARE_IDENTIFICATION', description: 'Retrieve Software Version', command_sent: 'VER\\r\\n', response_received: 'VERSION DX9-FW-v2.1.0', rule: 'R76-1 Cl.5.5.1 — version must match declaration', verdict: 'PASS', severity: null },
    { test_id: 'SI-02', suite: 'SOFTWARE_IDENTIFICATION', description: 'Retrieve Checksum', command_sent: 'CHECKSUM\\r\\n', response_received: 'CRC16 B8E2', rule: 'R76-1 Cl.5.5.1 / Annex G.1 — checksum must match declared A7F3', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'AT-01', suite: 'AUDIT_TRAIL', description: 'Read Audit Counter', command_sent: 'AUDIT_COUNT\\r\\n', response_received: 'EVENT_COUNT: 47', rule: 'R76-1 Annex G.5 — counter must be readable', verdict: 'PASS', severity: null },
    { test_id: 'AT-02', suite: 'AUDIT_TRAIL', description: 'Attempt Counter Reset', command_sent: 'AUDIT_RESET\\r\\n', response_received: 'OK — counter reset to 0', rule: 'R76-1 Annex G.5 — counter must be non-resettable', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'FZ-01', suite: 'PROTOCOL_FUZZING', description: 'Buffer Overflow (4096 bytes)', command_sent: 'AAAA...×4096\\r\\n', response_received: '(no response — instrument unresponsive for 3s)', rule: 'R76-1 Cl.5.2 — must handle gracefully or signal fault', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'FZ-02', suite: 'PROTOCOL_FUZZING', description: 'Null-Byte Injection', command_sent: 'P\\x00CAL\\x00SPAN 0.5\\r\\n', response_received: 'WEIGHT 19.200 kg (was 20.000 kg — shifted -0.8 kg)', rule: 'R76-1 Cl.5.2 — must not alter weight silently', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'FZ-03', suite: 'PROTOCOL_FUZZING', description: 'Command Chaining', command_sent: 'P;CAL;SPAN 0.5\\r\\n', response_received: 'ERROR: INVALID_COMMAND', rule: 'R76-1 Cl.5.2 — chained commands must not execute', verdict: 'PASS', severity: null },
    { test_id: 'FZ-04', suite: 'PROTOCOL_FUZZING', description: 'Boundary Value (negative span)', command_sent: 'SPAN -1\\r\\n', response_received: 'ERROR: OUT_OF_RANGE', rule: 'R76-1 Cl.5.2 — invalid values must be rejected', verdict: 'PASS', severity: null },
  ],
};

const scenario_mettler_xpr205: MockScenario = {
  scenario_id: 'scenario_mettler_xpr205',
  scenario_name: 'Mettler-Toledo Excellence XPR205 Analytical Balance',
  interface: 'USB (CDC-ACM Virtual COM) @ 115200 baud',
  declared_firmware: 'XPR205-CORE-v4.7.2',
  declared_checksum: '9C41',
  commands: [
    { test_id: 'PI-01', suite: 'PROTECTIVE_INTERFACE', description: 'Enter Calibration Mode', command_sent: 'CAL\\r\\n', response_received: 'ERROR: SEALED_MODE — command rejected', rule: 'R76-1 Cl.5.5.2 — calibration must be blocked in normal mode', verdict: 'PASS', severity: null },
    { test_id: 'PI-02', suite: 'PROTECTIVE_INTERFACE', description: 'Set Span Factor', command_sent: 'SET SPAN 200\\r\\n', response_received: 'ERROR: SEALED_MODE — command rejected', rule: 'R76-1 Cl.5.5.2 — span adjustment must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-03', suite: 'PROTECTIVE_INTERFACE', description: 'Set Zero Offset', command_sent: 'SET ZERO 0\\r\\n', response_received: 'ERROR: SEALED_MODE — command rejected', rule: 'R76-1 Cl.5.5.2 — zero adjustment must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-04', suite: 'PROTECTIVE_INTERFACE', description: 'Set Linearity Correction', command_sent: 'LIN 200 2\\r\\n', response_received: 'ERROR: SEALED_MODE — command rejected', rule: 'R76-1 Cl.5.5.2 — linearity must be protected', verdict: 'PASS', severity: null },
    { test_id: 'PI-05', suite: 'PROTECTIVE_INTERFACE', description: 'Change Max Capacity', command_sent: 'CFG MAX 500\\r\\n', response_received: 'ERROR: ACCESS_DENIED', rule: 'R76-1 Cl.5.5.2 — capacity change must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-06', suite: 'PROTECTIVE_INTERFACE', description: 'Change Scale Interval', command_sent: 'CFG E 0.0001\\r\\n', response_received: 'ERROR: ACCESS_DENIED', rule: 'R76-1 Cl.5.5.2 — scale interval must be protected', verdict: 'PASS', severity: null },
    { test_id: 'PI-07', suite: 'PROTECTIVE_INTERFACE', description: 'Factory Reset', command_sent: 'RESET\\r\\n', response_received: 'ERROR: SEALED_MODE', rule: 'R76-1 Cl.5.5.2 — factory reset must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-08', suite: 'PROTECTIVE_INTERFACE', description: 'Firmware Update Mode', command_sent: 'FW_UPDATE\\r\\n', response_received: 'ERROR: NOT_ALLOWED', rule: 'R76-1 Cl.5.5.2 — firmware update must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'SI-01', suite: 'SOFTWARE_IDENTIFICATION', description: 'Retrieve Software Version', command_sent: 'VER\\r\\n', response_received: 'VERSION XPR205-CORE-v4.7.2', rule: 'R76-1 Cl.5.5.1 — version must match declaration', verdict: 'PASS', severity: null },
    { test_id: 'SI-02', suite: 'SOFTWARE_IDENTIFICATION', description: 'Retrieve Checksum', command_sent: 'CHECKSUM\\r\\n', response_received: 'CRC16 9C41', rule: 'R76-1 Cl.5.5.1 / Annex G.1 — checksum must match declared 9C41', verdict: 'PASS', severity: null },
    { test_id: 'AT-01', suite: 'AUDIT_TRAIL', description: 'Read Audit Counter', command_sent: 'AUDIT_COUNT\\r\\n', response_received: 'EVENT_COUNT: 12', rule: 'R76-1 Annex G.5 — counter must be readable', verdict: 'PASS', severity: null },
    { test_id: 'AT-02', suite: 'AUDIT_TRAIL', description: 'Attempt Counter Reset', command_sent: 'AUDIT_RESET\\r\\n', response_received: 'ERROR: SEALED_MODE — counter is non-resettable', rule: 'R76-1 Annex G.5 — counter must be non-resettable', verdict: 'PASS', severity: null },
    { test_id: 'FZ-01', suite: 'PROTOCOL_FUZZING', description: 'Buffer Overflow (4096 bytes)', command_sent: 'AAAA...×4096\\r\\n', response_received: 'ERROR: FRAME_TOO_LONG — input discarded', rule: 'R76-1 Cl.5.2 — must handle gracefully or signal fault', verdict: 'PASS', severity: null },
    { test_id: 'FZ-02', suite: 'PROTOCOL_FUZZING', description: 'Null-Byte Injection', command_sent: 'P\\x00CAL\\x00SPAN 0.5\\r\\n', response_received: 'WEIGHT 128.4032 g (unchanged)', rule: 'R76-1 Cl.5.2 — must not alter weight silently', verdict: 'PASS', severity: null },
    { test_id: 'FZ-03', suite: 'PROTOCOL_FUZZING', description: 'Command Chaining', command_sent: 'P;CAL;SPAN 0.5\\r\\n', response_received: 'ERROR: INVALID_COMMAND', rule: 'R76-1 Cl.5.2 — chained commands must not execute', verdict: 'PASS', severity: null },
    { test_id: 'FZ-04', suite: 'PROTOCOL_FUZZING', description: 'Boundary Value (negative span)', command_sent: 'SPAN -1\\r\\n', response_received: 'ERROR: OUT_OF_RANGE', rule: 'R76-1 Cl.5.2 — invalid values must be rejected', verdict: 'PASS', severity: null },
  ],
};

const scenario_cheapscale_cs30: MockScenario = {
  scenario_id: 'scenario_cheapscale_cs30',
  scenario_name: 'CheapScale CS-30 Retail Bench Indicator',
  interface: 'USB (CDC-ACM Virtual COM) @ 9600 baud',
  declared_firmware: 'CS30-FW-v1.4.0',
  declared_checksum: '5D19',
  commands: [
    { test_id: 'PI-01', suite: 'PROTECTIVE_INTERFACE', description: 'Enter Calibration Mode', command_sent: 'CAL\\r\\n', response_received: 'ERROR: LOCKED — command rejected', rule: 'R76-1 Cl.5.5.2 — calibration must be blocked in normal mode', verdict: 'PASS', severity: null },
    { test_id: 'PI-02', suite: 'PROTECTIVE_INTERFACE', description: 'Set Span Factor', command_sent: 'SET SPAN 30\\r\\n', response_received: 'OK — span factor applied, +1.1% weight shift', rule: 'R76-1 Cl.5.5.2 — span adjustment must be blocked', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'PI-03', suite: 'PROTECTIVE_INTERFACE', description: 'Set Zero Offset', command_sent: 'SET ZERO 0\\r\\n', response_received: 'ERROR: LOCKED — command rejected', rule: 'R76-1 Cl.5.5.2 — zero adjustment must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-04', suite: 'PROTECTIVE_INTERFACE', description: 'Set Linearity Correction', command_sent: 'LIN 30 2\\r\\n', response_received: 'ERROR: LOCKED — command rejected', rule: 'R76-1 Cl.5.5.2 — linearity must be protected', verdict: 'PASS', severity: null },
    { test_id: 'PI-05', suite: 'PROTECTIVE_INTERFACE', description: 'Change Max Capacity', command_sent: 'CFG MAX 60\\r\\n', response_received: 'ERROR: LOCKED', rule: 'R76-1 Cl.5.5.2 — capacity change must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-06', suite: 'PROTECTIVE_INTERFACE', description: 'Change Scale Interval', command_sent: 'CFG E 0.005\\r\\n', response_received: 'ERROR: LOCKED', rule: 'R76-1 Cl.5.5.2 — scale interval must be protected', verdict: 'PASS', severity: null },
    { test_id: 'PI-07', suite: 'PROTECTIVE_INTERFACE', description: 'Factory Reset', command_sent: 'RESET\\r\\n', response_received: 'ERROR: LOCKED', rule: 'R76-1 Cl.5.5.2 — factory reset must be blocked', verdict: 'PASS', severity: null },
    { test_id: 'PI-08', suite: 'PROTECTIVE_INTERFACE', description: 'Firmware Update Mode', command_sent: 'FW_UPDATE\\r\\n', response_received: 'OK — entered firmware update mode, no authentication requested', rule: 'R76-1 Cl.5.5.2 — firmware update must be blocked or authenticated', verdict: 'FAIL', severity: 'CRITICAL' },
    { test_id: 'SI-01', suite: 'SOFTWARE_IDENTIFICATION', description: 'Retrieve Software Version', command_sent: 'VER\\r\\n', response_received: 'VERSION CS30-FW-v1.4.0', rule: 'R76-1 Cl.5.5.1 — version must match declaration', verdict: 'PASS', severity: null },
    { test_id: 'SI-02', suite: 'SOFTWARE_IDENTIFICATION', description: 'Retrieve Checksum', command_sent: 'CHECKSUM\\r\\n', response_received: 'CRC16 5D19', rule: 'R76-1 Cl.5.5.1 / Annex G.1 — checksum must match declared 5D19', verdict: 'PASS', severity: null },
    { test_id: 'AT-01', suite: 'AUDIT_TRAIL', description: 'Read Audit Counter', command_sent: 'AUDIT_COUNT\\r\\n', response_received: 'EVENT_COUNT: 3', rule: 'R76-1 Annex G.5 — counter must be readable', verdict: 'PASS', severity: null },
    { test_id: 'AT-02', suite: 'AUDIT_TRAIL', description: 'Attempt Counter Reset', command_sent: 'AUDIT_RESET\\r\\n', response_received: 'ERROR: LOCKED — counter is non-resettable', rule: 'R76-1 Annex G.5 — counter must be non-resettable', verdict: 'PASS', severity: null },
    { test_id: 'FZ-01', suite: 'PROTOCOL_FUZZING', description: 'Buffer Overflow (4096 bytes)', command_sent: 'AAAA...×4096\\r\\n', response_received: 'ERROR: FRAME_TOO_LONG — input discarded', rule: 'R76-1 Cl.5.2 — must handle gracefully or signal fault', verdict: 'PASS', severity: null },
    { test_id: 'FZ-02', suite: 'PROTOCOL_FUZZING', description: 'Null-Byte Injection', command_sent: 'P\\x00CAL\\x00SPAN 0.5\\r\\n', response_received: 'WEIGHT 4.230 kg (unchanged)', rule: 'R76-1 Cl.5.2 — must not alter weight silently', verdict: 'PASS', severity: null },
    { test_id: 'FZ-03', suite: 'PROTOCOL_FUZZING', description: 'Command Chaining', command_sent: 'P;CAL;SPAN 0.5\\r\\n', response_received: 'OK — trailing SPAN 0.5 executed after semicolon', rule: 'R76-1 Cl.5.2 — chained commands must not execute', verdict: 'FAIL', severity: 'HIGH' },
    { test_id: 'FZ-04', suite: 'PROTOCOL_FUZZING', description: 'Boundary Value (negative span)', command_sent: 'SPAN -1\\r\\n', response_received: 'ERROR: OUT_OF_RANGE', rule: 'R76-1 Cl.5.2 — invalid values must be rejected', verdict: 'PASS', severity: null },
  ],
};

export const mockSoftwareExamScenarios: MockScenario[] = [
  scenario_econoscale_dx9,
  scenario_mettler_xpr205,
  scenario_cheapscale_cs30,
];

export function mockScenarioSummaries(): SoftwareExamScenarioSummary[] {
  return mockSoftwareExamScenarios.map(s => ({
    scenario_id: s.scenario_id,
    scenario_name: s.scenario_name,
    interface: s.interface,
    declared_firmware: s.declared_firmware,
    declared_checksum: s.declared_checksum,
    command_count: s.commands.length,
  }));
}

export function mockRunScenario(scenarioId: string): SoftwareExamRunResult | null {
  const s = mockSoftwareExamScenarios.find(sc => sc.scenario_id === scenarioId);
  if (!s) return null;
  const passed = s.commands.filter(c => c.verdict === 'PASS').length;
  const failed = s.commands.length - passed;
  return {
    scenario_id: s.scenario_id,
    scenario_name: s.scenario_name,
    interface: s.interface,
    declared_firmware: s.declared_firmware,
    declared_checksum: s.declared_checksum,
    commands: s.commands,
    summary: {
      total: s.commands.length,
      passed,
      failed,
      overall_verdict: failed > 0 ? 'FAIL' : 'PASS',
    },
  };
}
