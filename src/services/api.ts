/**
 * NAWI TRUST — Centralized API Client Layer
 * Connects the React Frontend with the FastAPI + PostgreSQL backend.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.1.4:8000';

/* ---- Typed API Models Matching Backend Schemas ---- */

export interface ApiHealthResponse {
  status: string;
  service: string;
}

export interface ApiDatabaseHealthResponse {
  status: string;
  database: string;
  database_engine: string;
  query_result: number;
  timestamp: string;
}

export interface ApiInstrument {
  id: number;
  manufacturer: string;
  model: string;
  serial_number: string;
  functional_type: string;
  accuracy_class: string;
  max_capacity: number;
  min_capacity: number;
  unit: string;
  verification_scale_interval_e: number;
  actual_scale_interval_d: number;
  software_applicable: boolean;
  approval_certificate_number?: string | null;
  created_at: string;
}

export interface ApiInstrumentCreate {
  manufacturer: string;
  model: string;
  serial_number: string;
  functional_type: string;
  accuracy_class: string;
  max_capacity: number;
  min_capacity: number;
  unit?: string;
  verification_scale_interval_e: number;
  actual_scale_interval_d: number;
  software_applicable?: boolean;
  approval_certificate_number?: string | null;
}

export interface ApiTestSession {
  id: number;
  session_code: string;
  instrument_id: number;
  officer_name: string;
  officer_badge?: string | null;
  test_location: string;
  verification_date: string;
  status: string;
  current_step: number;
  compliance_verdict?: string | null;
  test_type?: string;
  temperature_c?: number | null;
  relative_humidity_pct?: number | null;
  atmospheric_pressure_hpa?: number | null;
  environment_source?: string;
  standards_used?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface ApiSessionCreate {
  session_code: string;
  instrument_id: number;
  officer_name: string;
  officer_badge?: string | null;
  test_location: string;
  verification_date: string;
  status?: string;
  current_step?: number;
  test_type?: string;
  temperature_c?: number | null;
  relative_humidity_pct?: number | null;
  atmospheric_pressure_hpa?: number | null;
  environment_source?: string;
  standards_used?: string | null;
}

export interface ApiReading {
  id: number;
  session_id: number;
  test_point: string;
  reference_value: number;
  indicated_value: number;
  error: number;
  mpe: number;
  unit: string;
  result: 'PASS' | 'FAIL';
  created_at: string;
}

export interface ApiReadingCreate {
  session_id: number;
  test_point: string;
  reference_value: number;
  indicated_value: number;
  mpe: number;
  unit?: string;
}

export interface ApiComplianceCalculationRequest {
  reference_value: number;
  indicated_value: number;
  mpe: number;
  test_type?: string;
  accuracy_class?: string;
  session_id?: number;
}

export interface ApiComplianceCalculationResponse {
  reference_value: number;
  indicated_value: number;
  error: number;
  absolute_error?: number;
  mpe: number;
  result: 'PASS' | 'FAIL' | 'REVIEW' | 'NOT_IMPLEMENTED' | 'INVALID';
  calculation_method?: string;
  mpe_utilisation_percent?: number;
  explanation?: string;
  standard?: string;
  edition?: string;
  clause?: string;
}

export interface ApiComplianceResult {
  id: number;
  session_id: number;
  overall_result: 'PASS' | 'FAIL' | 'REVIEW';
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  review_tests: number;
  calculated_at: string;
}

export interface ApiOcrFieldResult {
  value: string | null;
  confidence: number;
  status: 'EXTRACTED' | 'UNCERTAIN' | 'NOT_DETECTED';
  confidence_band?: 'HIGH' | 'MEDIUM' | 'NEEDS_REVIEW' | 'NONE';
  is_corrected?: boolean;
  raw_ocr_value?: string | null;
}

export interface ApiOcrStructuredData {
  manufacturer: ApiOcrFieldResult;
  model: ApiOcrFieldResult;
  serial_number: ApiOcrFieldResult;
  max_capacity: ApiOcrFieldResult;
  min_capacity: ApiOcrFieldResult;
  verification_scale_interval_e: ApiOcrFieldResult;
  actual_scale_interval_d: ApiOcrFieldResult;
  accuracy_class: ApiOcrFieldResult;
  unit: ApiOcrFieldResult;
  software_id: ApiOcrFieldResult;
  approval_certificate_number: ApiOcrFieldResult;
}

export interface ApiEvidenceItem {
  id: number;
  session_id: number;
  instrument_id?: number | null;
  evidence_type: string;
  evidence_reference?: string | null;
  file_name: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  download_url?: string | null;
  ocr_status: string;
  ocr_confidence?: number | null;
  ocr_raw_text?: string | null;
  ocr_data?: ApiOcrStructuredData | null;
  consistency_status: 'MATCH' | 'MISMATCH' | 'REVIEW' | 'NOT_DETECTED' | 'NOT_RUN' | string;
  consistency_details?: string | null;
  has_corrections?: boolean;
  was_mock_extraction?: boolean;
  created_at: string;
}

export interface ApiEvidenceOcrTriggerResponse {
  evidence_id: number;
  ocr_status: string;
  ocr_confidence: number;
  ocr_raw_text: string;
  ocr_data: ApiOcrStructuredData;
  consistency_status: string;
  consistency_details: string;
}

/* ---- Generic API Request Handler ---- */

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders: Record<string, string> = options.body instanceof FormData ? {} : {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Use fallback errorDetail
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

/* ---- API Services Modules ---- */

export const healthApi = {
  checkHealth: () => apiRequest<ApiHealthResponse>('/api/health'),
  checkDatabaseHealth: () => apiRequest<ApiDatabaseHealthResponse>('/api/health/database'),
};

export const instrumentsApi = {
  getInstruments: () => apiRequest<ApiInstrument[]>('/api/instruments'),
  getById: (instrumentId: number) =>
    apiRequest<ApiInstrument>(`/api/instruments/${instrumentId}`),
  getBySerial: (serialNumber: string) =>
    apiRequest<ApiInstrument>(`/api/instruments/by-serial/${encodeURIComponent(serialNumber)}`),
  createInstrument: (data: ApiInstrumentCreate) =>
    apiRequest<ApiInstrument>('/api/instruments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const sessionsApi = {
  getSessions: () => apiRequest<ApiTestSession[]>('/api/sessions'),
  getSession: (sessionId: number) => apiRequest<ApiTestSession>(`/api/sessions/${sessionId}`),
  getSessionByCode: (sessionCode: string) => apiRequest<ApiTestSession>(`/api/sessions/by-code/${sessionCode}`),
  createSession: (data: ApiSessionCreate) =>
    apiRequest<ApiTestSession>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSession: (sessionId: number, data: Partial<ApiSessionCreate & { compliance_verdict: string }>) =>
    apiRequest<ApiTestSession>(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export const readingsApi = {
  createReading: (data: ApiReadingCreate) =>
    apiRequest<ApiReading>('/api/readings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSessionReadings: (sessionId: number) =>
    apiRequest<ApiReading[]>(`/api/readings/session/${sessionId}`),
  deleteReading: (readingId: number) =>
    apiRequest<{ message: string; session_id: number }>(`/api/readings/${readingId}`, {
      method: 'DELETE',
    }),
};

export const complianceApi = {
  calculateCompliance: (data: ApiComplianceCalculationRequest) =>
    apiRequest<ApiComplianceCalculationResponse>('/api/compliance/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  evaluateSession: (sessionId: number) =>
    apiRequest<ApiComplianceResult>(`/api/compliance/session/${sessionId}/evaluate`, {
      method: 'POST',
    }),
  getSessionCompliance: (sessionId: number) =>
    apiRequest<ApiComplianceResult>(`/api/compliance/session/${sessionId}`),
};

export const evidenceApi = {
  uploadEvidence: async (
    file: File,
    sessionId: number,
    evidenceType: string,
    evidenceReference?: string,
    autoOcr: boolean = true
  ): Promise<ApiEvidenceItem> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId.toString());
    formData.append('evidence_type', evidenceType);
    if (evidenceReference) {
      formData.append('evidence_reference', evidenceReference);
    }
    formData.append('auto_ocr', autoOcr ? 'true' : 'false');

    return apiRequest<ApiEvidenceItem>('/api/evidence/upload', {
      method: 'POST',
      body: formData,
    });
  },

  getSessionEvidence: (sessionId: number) =>
    apiRequest<ApiEvidenceItem[]>(`/api/evidence/session/${sessionId}`),

  getEvidenceItem: (evidenceId: number) =>
    apiRequest<ApiEvidenceItem>(`/api/evidence/${evidenceId}`),

  triggerOcr: (evidenceId: number) =>
    apiRequest<ApiEvidenceOcrTriggerResponse>(`/api/evidence/${evidenceId}/ocr`, {
      method: 'POST',
    }),

  deleteEvidence: (evidenceId: number) =>
    apiRequest<{ message: string }>(`/api/evidence/${evidenceId}`, {
      method: 'DELETE',
    }),

  correctField: (evidenceId: number, field: string, value: string) =>
    apiRequest<ApiEvidenceItem>(`/api/evidence/${evidenceId}/correct`, {
      method: 'PATCH',
      body: JSON.stringify({ field, value }),
    }),

  getFileUrl: (evidenceId: number) => `${API_BASE_URL}/api/evidence/${evidenceId}/file`,
};

/* ---- Metrological Fingerprint Models & API ---- */

export interface ApiErrorStatistics {
  mean: number;
  median: number;
  std_dev: number;
  mean_absolute: number;
  max_absolute: number;
  min: number;
  max: number;
  error_range: number;
  mean_relative?: number | null;
  max_relative?: number | null;
}

export interface ApiTrendAnalysis {
  classification: 'STABLE' | 'INCREASING' | 'DECREASING' | 'IRREGULAR' | 'INSUFFICIENT_DATA';
  slope?: number | null;
  r_squared?: number | null;
  description: string;
}

export interface ApiTestCoverage {
  accuracy: boolean;
  repeatability: boolean;
  eccentricity: boolean;
  total_test_points: number;
  test_types_present: string[];
}

export interface ApiRepeatabilityMetrics {
  test_load?: number | null;
  run_count: number;
  std_dev?: number | null;
  range?: number | null;
  readings: number[];
}

export interface ApiFingerprintDataPoint {
  reading_id: number;
  test_point: string;
  reference_value: number;
  indicated_value: number;
  error: number;
  absolute_error: number;
  relative_error_pct?: number | null;
  mpe: number;
  unit: string;
}

export interface ApiHistoricalDelta {
  previous_session_id: number;
  previous_session_code?: string | null;
  previous_date?: string | null;
  mean_error_change: number;
  std_dev_change: number;
  max_absolute_error_change: number;
  drift_summary: string;
}

export interface ApiFingerprintResponse {
  id?: number | null;
  session_id: number;
  instrument_id: number;
  fingerprint_version: string;
  status: 'COMPLETE' | 'INSUFFICIENT_DATA';
  measurement_count: number;
  fingerprint_hash: string;
  hash_algorithm: string;
  error_statistics?: ApiErrorStatistics | null;
  trend: ApiTrendAnalysis;
  test_coverage: ApiTestCoverage;
  repeatability?: ApiRepeatabilityMetrics | null;
  data_points: ApiFingerprintDataPoint[];
  historical_comparison?: ApiHistoricalDelta | null;
  created_at: string;
}

export interface ApiFingerprintHistoryItem {
  fingerprint_id: number;
  session_id: number;
  session_code: string;
  verification_date: string;
  measurement_count: number;
  trend_classification: string;
  fingerprint_hash: string;
  mean_error?: number | null;
  std_dev?: number | null;
  max_absolute_error?: number | null;
  created_at: string;
}

export const fingerprintApi = {
  generateSessionFingerprint: (sessionId: number) =>
    apiRequest<ApiFingerprintResponse>(`/api/fingerprint/session/${sessionId}`, {
      method: 'POST',
    }),

  getSessionFingerprint: (sessionId: number) =>
    apiRequest<ApiFingerprintResponse>(`/api/fingerprint/session/${sessionId}`),

  getInstrumentHistory: (instrumentId: number) =>
    apiRequest<ApiFingerprintHistoryItem[]>(`/api/fingerprint/instrument/${instrumentId}/history`),
};

/* ---- Metrological Fingerprint — UVP 1 Instrument Identity API ---- */

export interface FingerprintFeatureVector {
  version: string;
  error_curve: number[];
  eccentricity_pattern: number[];
  repeatability_std: number;
  creep_profile: number[];
}

export interface FingerprintIdentityResult {
  scenario_id?: string;
  label?: string;
  instrument_serial: string;
  manufacturer: string;
  model: string;
  accuracy_class?: string;
  enrolment_certificate?: string;
  distance: number;
  threshold: number;
  result: 'MATCH' | 'BORDERLINE' | 'MISMATCH';
  stored_hash: string;
  current_hash: string;
  stored_feature_vector: FingerprintFeatureVector;
  current_feature_vector: FingerprintFeatureVector;
  enrolled_at?: string | null;
}

export interface FingerprintEnrolResult {
  session_id: number;
  instrument_id: number;
  instrument_serial: string;
  manufacturer: string;
  model: string;
  ruleset_version: string;
  measurement_count: number;
  feature_vector: FingerprintFeatureVector;
  fingerprint_hash: string;
  hash_algorithm: string;
  enrolled_at: string | null;
}

export interface FingerprintDemoScenarioSummary {
  scenario_id: string;
  label: string;
  instrument_serial: string;
}

export interface FingerprintSubsetReading {
  test_point: string;
  reference_value: number;
  indicated_value: number;
}

export const fingerprintIdentityApi = {
  enrol: (sessionId: number) =>
    apiRequest<FingerprintEnrolResult>(`/api/fingerprint/enrol/${sessionId}`, { method: 'POST' }),

  verify: (instrumentSerial: string, readings: FingerprintSubsetReading[], threshold?: number) =>
    apiRequest<FingerprintIdentityResult>(`/api/fingerprint/verify/${encodeURIComponent(instrumentSerial)}`, {
      method: 'POST',
      body: JSON.stringify({ readings, threshold }),
    }),

  listDemoScenarios: () =>
    apiRequest<{ baseline_instrument: any; scenarios: FingerprintDemoScenarioSummary[] }>('/api/fingerprint/demo-scenarios'),

  runDemoScenario: (scenarioId: 'genuine' | 'swapped') =>
    apiRequest<FingerprintIdentityResult>(`/api/fingerprint/demo-scenarios/${scenarioId}/verify`, { method: 'POST' }),
};

/* ---- Digital Reports & Certificate API ---- */

export const reportsApi = {
  getReportData: (sessionId: number) =>
    apiRequest<any>(`/api/reports/${sessionId}/data`),
  getPdfUrl: (sessionId: number) =>
    `${API_BASE_URL}/api/reports/${sessionId}/pdf`,
  getDocxUrl: (sessionId: number) =>
    `${API_BASE_URL}/api/reports/${sessionId}/docx`,
};

/* ---- Digital Repository & History API ---- */

export interface RepositorySearchParams {
  q?: string;
  manufacturer?: string;
  accuracy_class?: string;
  status_filter?: string;
  verdict_filter?: string;
  skip?: number;
  limit?: number;
}

export interface RepositoryItem {
  instrument: ApiInstrument;
  total_sessions: number;
  latest_session?: {
    id: number;
    session_code: string;
    verification_date: string;
    officer_name: string;
    test_location: string;
    status: string;
    current_step: number;
    compliance_verdict?: string | null;
    created_at?: string | null;
  } | null;
  overall_verdict: string;
  report_available: boolean;
}

export interface RepositorySearchResponse {
  total_results: number;
  items: RepositoryItem[];
}

export interface InstrumentHistoryResponse {
  instrument: ApiInstrument;
  total_sessions: number;
  history: Array<{
    session_id: number;
    session_code: string;
    officer_name: string;
    officer_badge?: string;
    test_location: string;
    verification_date: string;
    status: string;
    test_type: string;
    temperature_c?: number | null;
    relative_humidity_pct?: number | null;
    atmospheric_pressure_hpa?: number | null;
    environment_source: string;
    compliance_verdict?: string | null;
    readings_count: number;
    passed_readings: number;
    failed_readings: number;
    evidence_count: number;
    created_at?: string | null;
    completed_at?: string | null;
    readings: ApiReading[];
    evidence: any[];
  }>;
}

export const repositoryApi = {
  search: (params?: RepositorySearchParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.manufacturer) query.append('manufacturer', params.manufacturer);
    if (params?.accuracy_class) query.append('accuracy_class', params.accuracy_class);
    if (params?.status_filter) query.append('status_filter', params.status_filter);
    if (params?.verdict_filter) query.append('verdict_filter', params.verdict_filter);
    if (params?.skip) query.append('skip', params.skip.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const qs = query.toString();
    return apiRequest<RepositorySearchResponse>(`/api/repository/search${qs ? `?${qs}` : ''}`);
  },
  getInstrumentHistory: (instrumentId: number) =>
    apiRequest<InstrumentHistoryResponse>(`/api/repository/instruments/${instrumentId}/history`),
};

/* ---- Audit & Traceability API ---- */

export interface ApiAuditLog {
  id: number;
  session_id: number;
  session_code: string;
  action: string;
  performed_by: string;
  details?: string | null;
  timestamp: string;
}

export const auditApi = {
  getSessionLogs: (sessionId: number) =>
    apiRequest<ApiAuditLog[]>(`/api/audit/session/${sessionId}`),
  getRecentLogs: (limit: number = 50) =>
    apiRequest<ApiAuditLog[]>(`/api/audit/recent?limit=${limit}`),
};

/* ---- Dashboard Statistics API ---- */

export interface DashboardStats {
  total_instruments: number;
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  pass_count: number;
  fail_count: number;
  review_count: number;
  pending_reviews: number;
  compliance_rate_percent: number;
  weekly_activity: Array<{ date: string; label: string; sessions: number }>;
  compliance_distribution: {
    pass: number;
    fail: number;
    review: number;
    unverified: number;
  };
}

export const dashboardApi = {
  getStats: () => apiRequest<DashboardStats>('/api/dashboard/stats'),
};

/* ---- Anomaly Intelligence API ---- */

export interface AnomalyFlag {
  index?: number;
  error_value?: number;
  z_score?: number;
  flag: string;
  description: string;
}

export interface AnomalyApiResult {
  session_id: number;
  session_code?: string;
  detection_method: string;
  classification: 'NORMAL' | 'ATTENTION' | 'ANOMALY' | 'INSUFFICIENT_DATA';
  anomaly_score: number;
  is_demo_mode: boolean;
  summary: string;
  flags: AnomalyFlag[];
  zscore_analysis?: any;
  iqr_analysis?: any;
  per_reading?: any[];
  advisory_notice: string;
  created_at?: string | null;
}

export const anomalyApi = {
  runSessionAnomaly: (sessionId: number) =>
    apiRequest<AnomalyApiResult>(`/api/anomaly/session/${sessionId}`, {
      method: 'POST',
    }),
  getSessionAnomaly: (sessionId: number) =>
    apiRequest<AnomalyApiResult>(`/api/anomaly/session/${sessionId}`),
};

/* ---- Software Verification API ---- */

export interface SoftwareVerificationData {
  id?: number;
  session_id: number;
  applicability: 'NOT_APPLICABLE' | 'APPLICABLE' | 'REVIEW' | 'NOT_RECORDED';
  software_id?: string | null;
  software_version?: string | null;
  firmware_version?: string | null;
  checksum_hash?: string | null;
  baseline_hash?: string | null;
  hash_algorithm?: string;
  protected_params_verified?: boolean | null;
  audit_trail_clean?: boolean | null;
  communication_interface_status?: string | null;
  notes?: string | null;
  status: string;
  instrument_software_applicable?: boolean | null;
  prototype_notice: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SoftwareVerificationCreate {
  applicability: string;
  software_id?: string;
  software_version?: string;
  firmware_version?: string;
  checksum_hash?: string;
  baseline_hash?: string;
  hash_algorithm?: string;
  protected_params_verified?: boolean;
  audit_trail_clean?: boolean;
  communication_interface_status?: string;
  notes?: string;
}

export const softwareVerificationApi = {
  create: (sessionId: number, data: SoftwareVerificationCreate) =>
    apiRequest<SoftwareVerificationData>(`/api/software-verification/session/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  get: (sessionId: number) =>
    apiRequest<SoftwareVerificationData>(`/api/software-verification/session/${sessionId}`),
};

/* ---- Software Examination (UVP 2) — Live Demo Scenario API ---- */

export interface SoftwareExamScenarioSummary {
  scenario_id: string;
  scenario_name: string;
  interface: string;
  declared_firmware: string;
  declared_checksum: string;
  command_count: number;
}

export interface SoftwareExamCommand {
  test_id: string;
  suite: string;
  description: string;
  command_sent: string;
  response_received: string;
  rule: string;
  verdict: 'PASS' | 'FAIL';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

export interface SoftwareExamRunResult {
  scenario_id: string;
  scenario_name: string;
  interface: string;
  declared_firmware: string;
  declared_checksum: string;
  commands: SoftwareExamCommand[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    overall_verdict: 'PASS' | 'FAIL';
  };
}

export const softwareExamApi = {
  listScenarios: () => apiRequest<SoftwareExamScenarioSummary[]>('/api/software-exam/scenarios'),
  runScenario: (scenarioId: string) =>
    apiRequest<SoftwareExamRunResult>(`/api/software-exam/run/${scenarioId}`, {
      method: 'POST',
    }),

  // Not JSON — returns a PDF blob, so it bypasses the apiRequest() JSON helper.
  downloadReportPdf: async (result: SoftwareExamRunResult): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/api/software-exam/report/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/pdf' },
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.blob();
  },
};

/* ---- Sessions generate-code ---- */
export const sessionsGenerateCode = (): Promise<{ session_code: string }> =>
  apiRequest<{ session_code: string }>('/api/sessions/generate-code');
