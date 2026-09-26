import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { 
  UserProfile, 
  TestSession, 
  Instrument, 
  DashboardKPIs, 
  AnomalyAlert, 
  AuditTrailEntry,
  ReferenceStandard,
  InstrumentCategory,
  AdditionalMetrologicalSpecs,
  StaticWeighingPoint
} from '../types';
import { 
  mockCurrentUser, 
  mockAnomalyAlerts, 
} from '../mock/mockData';
import { 
  healthApi, 
  instrumentsApi, 
  sessionsApi, 
  auditApi,
  dashboardApi,
  sessionsGenerateCode,
  readingsApi,
  type ApiInstrument, 
  type ApiTestSession,
  type ApiReading
} from '../services/api';

export type NavigationKey = 
  | 'dashboard'
  | 'repository'
  | 'test-sessions'
  | 'new-test-session'
  | 'instruments'
  | 'test-session'
  | 'observations'
  | 'data-acquisition'
  | 'evidence'
  | 'compliance'
  | 'fingerprint'
  | 'software'
  | 'anomaly'
  | 'results'
  | 'reports'
  | 'traceability'
  | 'grc';

export interface DraftFormData {
  manufacturer: string;
  model: string;
  serialNumber: string;
  instrumentCategory: InstrumentCategory;
  accuracyClass: 'I' | 'II' | 'III' | 'IV';
  indicationType: string;
  maxCapacity: number;
  minCapacity: number;
  unit: 'g' | 'kg' | 't' | 'mg';
  verificationScaleInterval_e: number;
  actualScaleInterval_d: number;
  instrumentType: string;
  softwareApplicable: boolean;
  verificationType: 'TYPE_EVALUATION' | 'INITIAL_VERIFICATION' | 'IN_SERVICE_VERIFICATION';
  testType: 'INITIAL_VERIFICATION' | 'IN_SERVICE_VERIFICATION';
  additionalParams: AdditionalMetrologicalSpecs;
  referenceStandards: ReferenceStandard[];
  environmentalStage: 'Start' | 'Max / During Test' | 'End';
  temperatureC: number | null;
  relativeHumidityPct: number | null;
  atmosphericPressureHpa: number | null;
  environmentSource: 'LIVE' | 'MANUAL' | 'DEMO';
  environmentTimestamp: string;
  standardsUsed: string;
  verificationOfficer: string;
  testLocation: string;
  verificationDate: string;
  testDirection: 'increasing' | 'decreasing';
  staticWeighingPoints: StaticWeighingPoint[];
  currentStep: number;
  sessionId: string;
  backendSessionId?: number | null;
  backendInstrumentId?: number | null;
}

export const defaultDemoStaticPoints: StaticWeighingPoint[] = [
  {
    id: 'pt_demo_1',
    pointNumber: 1,
    appliedLoad: '100.00',
    indication: '100.04',
    additionalLoadDeltaL: '0.05',
    zeroErrorE0: '0.00',
    isDemo: true,
  },
  {
    id: 'pt_demo_2',
    pointNumber: 2,
    appliedLoad: '200.00',
    indication: '200.04',
    additionalLoadDeltaL: '0.05',
    zeroErrorE0: '0.00',
    isDemo: true,
  },
  {
    id: 'pt_demo_3',
    pointNumber: 3,
    appliedLoad: '300.00',
    indication: '300.03',
    additionalLoadDeltaL: '0.05',
    zeroErrorE0: '0.00',
    isDemo: true,
  },
  {
    id: 'pt_demo_4',
    pointNumber: 4,
    appliedLoad: '400.00',
    indication: '400.04',
    additionalLoadDeltaL: '0.05',
    zeroErrorE0: '0.00',
    isDemo: true,
  },
  {
    id: 'pt_demo_5',
    pointNumber: 5,
    appliedLoad: '500.00',
    indication: '500.04',
    additionalLoadDeltaL: '0.05',
    zeroErrorE0: '0.00',
    isDemo: true,
  },
];

export const defaultDemoDraftData: DraftFormData = {
  sessionId: 'APP-2026-0899',
  verificationDate: new Date().toISOString().split('T')[0],
  verificationOfficer: 'Insp. Helena Vance',
  testLocation: 'LAB-DE-04',
  verificationType: 'TYPE_EVALUATION',
  testType: 'INITIAL_VERIFICATION',
  testDirection: 'increasing',
  staticWeighingPoints: defaultDemoStaticPoints,

  // Section B: Instrument Identity
  manufacturer: 'RADWAG',
  model: 'PS 2100.R2',
  serialNumber: '597226',
  instrumentCategory: 'Complete',
  instrumentType: 'High-Precision Analytical Balance',
  softwareApplicable: false,

  // Section C: Metrological Specifications
  accuracyClass: 'II',
  indicationType: 'Digital (Self-Indicating)',
  maxCapacity: 2100,
  minCapacity: 0.5,
  unit: 'g',
  verificationScaleInterval_e: 0.1,
  actualScaleInterval_d: 0.01,

  // Additional Parameters (collapsible)
  additionalParams: {
    isMultiInterval: false,
    isMultipleRange: false,
    tareType: 'Subtractive',
    maxTareEffect: '-2100 g',
    tempMinC: '+10',
    tempMaxC: '+40',
    voltageNominal: '230',
    voltageMin: '187',
    voltageMax: '253',
    batteryCutoffV: '10.2',
    hasZeroSettingDevice: true,
  },

  // Section D: Reference Standards
  referenceStandards: [
    {
      id: 'std_01',
      equipmentType: 'Weights',
      modelNumber: 'Radwag Class E2 Precision Set (1mg–2kg)',
      serialNumber: 'W-8812-E2',
      accuracyClassOrGrade: 'E2',
      calibrationCertNumber: 'CAL-2026-W-8812',
      calibrationDate: '2026-03-15',
      measurementUncertainty: 'U = 0.015 mg (k=2)',
    }
  ],
  standardsUsed: 'Radwag Class E2 Precision Set (1mg–2kg) [S/N: W-8812-E2, Cert: CAL-2026-W-8812]',

  // Section E: Environmental Conditions
  environmentalStage: 'Start',
  temperatureC: 20.0,
  relativeHumidityPct: 50.0,
  atmosphericPressureHpa: 1013.2,
  environmentSource: 'DEMO',
  environmentTimestamp: '14:30:00 UTC',

  currentStep: 1,
  backendSessionId: null,
  backendInstrumentId: null,
};

const blankDraftData: DraftFormData = { ...defaultDemoDraftData };

interface VerificationContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  currentView: NavigationKey;
  activeSessionId: string;
  activeBackendSessionId: number | null;
  activeInstrumentId: number | null;
  testSessions: TestSession[];
  instruments: Instrument[];
  dashboardKPIs: DashboardKPIs;
  anomalyAlerts: AnomalyAlert[];
  auditTrail: AuditTrailEntry[];
  draftSession: DraftFormData;
  backendConnected: boolean;
  databaseConnected: boolean;
  backendLoading: boolean;
  backendError: string | null;
  login: (email: string, pass: string) => boolean;
  demoLogin: () => void;
  logout: () => void;
  setCurrentView: (view: NavigationKey) => void;
  updateDraft: (data: Partial<DraftFormData>) => void;
  saveDraft: () => Promise<void>;
  createBackendSession: () => Promise<boolean>;
  createNewSession: (presetInstrument?: Instrument) => Promise<void>;
  selectInstrument: (instrument: Instrument) => Promise<void>;
  loadSessionReadings: (sessionId?: number) => Promise<ApiReading[]>;
  proceedToStep: (stepNumber: number) => void;
  selectSession: (sessionCode: string) => Promise<void>;
  refreshBackendData: () => Promise<void>;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

// Helper to convert backend ApiInstrument to frontend Instrument
function mapApiInstrumentToFrontend(apiInst: ApiInstrument): Instrument {
  const rawClass = apiInst.accuracy_class.replace(/^(Class\s+)/i, '').trim() || 'II';
  const accClass = (['I', 'II', 'III', 'IV'].includes(rawClass) ? rawClass : 'II') as 'I' | 'II' | 'III' | 'IV';
  return {
    id: String(apiInst.id),
    serialNumber: apiInst.serial_number,
    manufacturer: apiInst.manufacturer,
    model: apiInst.model,
    accuracyClass: accClass,
    maxCapacity: apiInst.max_capacity,
    minCapacity: apiInst.min_capacity,
    unit: (apiInst.unit || 'g') as any,
    verificationScaleInterval_e: apiInst.verification_scale_interval_e,
    actualScaleInterval_d: apiInst.actual_scale_interval_d,
    instrumentType: (apiInst.functional_type || 'Weighing Instrument') as any,
    softwareApplicable: apiInst.software_applicable,
    approvalCertificateNumber: apiInst.approval_certificate_number || undefined,
    location: '',
  };
}

// Helper to convert backend ApiTestSession to frontend TestSession
function mapApiSessionToFrontend(apiSess: ApiTestSession, instMap: Map<number, Instrument>): TestSession {
  const inst = instMap.get(apiSess.instrument_id) || {
    id: String(apiSess.instrument_id),
    serialNumber: 'UNKNOWN',
    manufacturer: 'Unknown',
    model: 'Unknown',
    accuracyClass: 'II' as const,
    maxCapacity: 0,
    minCapacity: 0,
    unit: 'g' as const,
    verificationScaleInterval_e: 0.1,
    actualScaleInterval_d: 0.01,
    instrumentType: 'Weighing Instrument' as any,
    softwareApplicable: false,
    location: apiSess.test_location,
  };

  return {
    sessionId: apiSess.session_code,
    instrumentId: String(apiSess.instrument_id),
    instrument: inst,
    officerName: apiSess.officer_name,
    officerBadge: apiSess.officer_badge || '',
    testLocation: apiSess.test_location,
    verificationDate: apiSess.verification_date,
    currentStep: apiSess.current_step,
    status: apiSess.status as any,
    complianceVerdict: (apiSess.compliance_verdict || undefined) as any,
    createdAt: apiSess.created_at,
    updatedAt: apiSess.completed_at || apiSess.created_at,
  };
}

export const VerificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<NavigationKey>('dashboard');

  // FIXED: Start with null — no default IDs
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeBackendSessionId, setActiveBackendSessionId] = useState<number | null>(null);
  const [activeInstrumentId, setActiveInstrumentId] = useState<number | null>(null);

  const [testSessions, setTestSessions] = useState<TestSession[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [dashboardKPIs, setDashboardKPIs] = useState<DashboardKPIs>({
    activeSessionsCount: 0,
    instrumentsVerifiedCount: 0,
    pendingReviewsCount: 0,
    complianceRatePercent: 0,
    anomaliesDetectedCount: 0,
  });
  const [anomalyAlerts] = useState<AnomalyAlert[]>(mockAnomalyAlerts);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [draftSession, setDraftSession] = useState<DraftFormData>(blankDraftData);

  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [databaseConnected, setDatabaseConnected] = useState<boolean>(false);
  const [backendLoading, setBackendLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  const refreshBackendData = useCallback(async () => {
    setBackendLoading(true);
    setBackendError(null);
    try {
      // 1. Health checks
      await healthApi.checkHealth();
      setBackendConnected(true);

      const dbHealth = await healthApi.checkDatabaseHealth();
      setDatabaseConnected(dbHealth.status === 'ok');

      // 2. Fetch real data from PostgreSQL
      const [apiInstruments, apiSessions, apiAudit] = await Promise.all([
        instrumentsApi.getInstruments(),
        sessionsApi.getSessions(),
        auditApi.getRecentLogs(50).catch(() => []),
      ]);

      const frontendInstruments = apiInstruments.map(mapApiInstrumentToFrontend);
      const instMap = new Map<number, Instrument>();
      apiInstruments.forEach((ai, idx) => instMap.set(ai.id, frontendInstruments[idx]));

      const frontendSessions = apiSessions.map(s => mapApiSessionToFrontend(s, instMap));

      setInstruments(frontendInstruments);
      setTestSessions(frontendSessions);

      // 3. Fetch real dashboard stats
      try {
        const stats = await dashboardApi.getStats();
        setDashboardKPIs({
          activeSessionsCount: stats.active_sessions,
          instrumentsVerifiedCount: stats.total_instruments,
          pendingReviewsCount: stats.pending_reviews,
          complianceRatePercent: stats.compliance_rate_percent,
          anomaliesDetectedCount: stats.fail_count + stats.review_count, // rough proxy
        });
      } catch {
        // Fallback calculation if dashboard endpoint fails
        const passSessions = apiSessions.filter(s => s.compliance_verdict === 'PASS').length;
        const totalVerdictSessions = apiSessions.filter(s => !!s.compliance_verdict).length;
        const compRate = totalVerdictSessions > 0 ? Math.round((passSessions / totalVerdictSessions) * 100) : 0;
        setDashboardKPIs({
          activeSessionsCount: apiSessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'DRAFT').length,
          instrumentsVerifiedCount: frontendInstruments.length,
          complianceRatePercent: compRate,
          pendingReviewsCount: apiSessions.filter(s => s.compliance_verdict === 'REVIEW').length,
          anomaliesDetectedCount: 0,
        });
      }

      if (apiAudit && apiAudit.length > 0) {
        setAuditTrail(apiAudit.map(a => ({
          id: `aud_${a.id}`,
          sessionId: a.session_code,
          timestamp: a.timestamp ? a.timestamp.replace('T', ' ').substring(0, 19) : new Date().toISOString(),
          officer: a.performed_by,
          action: a.action as any,
          referenceId: a.session_code,
          details: a.details || 'Audit record logged',
        })));
      }

    } catch (err: any) {
      console.warn('Backend connection notice:', err.message);
      setBackendConnected(false);
      setDatabaseConnected(false);
      setBackendError(err.message || 'Could not connect to FastAPI / PostgreSQL backend.');
    } finally {
      setBackendLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBackendData();
  }, [refreshBackendData]);

  const login = (email: string): boolean => {
    setCurrentUser({
      ...mockCurrentUser,
      email: email || 'officer@metrology.gov',
    });
    setCurrentView('dashboard');
    return true;
  };

  const demoLogin = () => {
    setCurrentUser(mockCurrentUser);
    setCurrentView('dashboard');
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveSessionId('');
    setActiveBackendSessionId(null);
    setActiveInstrumentId(null);
    setDraftSession(blankDraftData);
  };

  // useCallback with empty deps: this only ever uses the functional setState
  // form, so it never needs to close over `draftSession`. Keeping it referentially
  // stable matters — components downstream (e.g. ObservationGrid's memoized
  // TanStack Table columns) depend on it, and an unstable reference here forces
  // those to recompute — and their cell inputs to remount — on every keystroke.
  const updateDraft = useCallback((data: Partial<DraftFormData>) => {
    setDraftSession(prev => ({
      ...prev,
      ...data,
    }));
  }, []);

  // Creates a genuinely new session — generates real unique session code from backend
  const createNewSession = async (presetInstrument?: Instrument) => {
    // Generate unique session code from backend API
    let newCode = `TS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const codeResp = await sessionsGenerateCode();
      newCode = codeResp.session_code;
    } catch {
      // Fallback to random code if backend not available
    }

    const today = new Date().toISOString().split('T')[0];
    const officerName = currentUser?.name || 'Verification Officer';

    if (presetInstrument) {
      const newDraft: DraftFormData = {
        ...defaultDemoDraftData,
        manufacturer: presetInstrument.manufacturer,
        model: presetInstrument.model,
        serialNumber: presetInstrument.serialNumber,
        accuracyClass: presetInstrument.accuracyClass,
        maxCapacity: presetInstrument.maxCapacity,
        minCapacity: presetInstrument.minCapacity,
        unit: presetInstrument.unit,
        verificationScaleInterval_e: presetInstrument.verificationScaleInterval_e,
        actualScaleInterval_d: presetInstrument.actualScaleInterval_d,
        instrumentType: presetInstrument.instrumentType,
        softwareApplicable: presetInstrument.softwareApplicable,
        verificationOfficer: officerName,
        verificationDate: today,
        sessionId: newCode,
        backendSessionId: null,
        backendInstrumentId: parseInt(presetInstrument.id, 10) || null,
        currentStep: 1,
      };
      setDraftSession(newDraft);
    } else {
      setDraftSession({
        ...defaultDemoDraftData,
        sessionId: newCode,
        verificationDate: today,
        verificationOfficer: officerName,
        backendSessionId: null,
        backendInstrumentId: null,
        currentStep: 1,
      });
    }

    setActiveSessionId(newCode);
    setActiveBackendSessionId(null);
    setCurrentView('test-session');
  };

  const selectInstrument = async (instrument: Instrument) => {
    let newCode = `TS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const codeResp = await sessionsGenerateCode();
      newCode = codeResp.session_code;
    } catch {
      // Fallback
    }

    const today = new Date().toISOString().split('T')[0];
    const officerName = currentUser?.name || 'Insp. Helena Vance';
    const instId = parseInt(instrument.id, 10) || null;

    setActiveInstrumentId(instId);
    setActiveBackendSessionId(null);
    setActiveSessionId(newCode);

    setDraftSession(prev => ({
      ...prev,
      manufacturer: instrument.manufacturer,
      model: instrument.model,
      serialNumber: instrument.serialNumber,
      accuracyClass: instrument.accuracyClass,
      maxCapacity: instrument.maxCapacity,
      minCapacity: instrument.minCapacity,
      unit: instrument.unit,
      verificationScaleInterval_e: instrument.verificationScaleInterval_e,
      actualScaleInterval_d: instrument.actualScaleInterval_d,
      instrumentType: instrument.instrumentType,
      softwareApplicable: instrument.softwareApplicable,
      approvalCertificateNumber: instrument.approvalCertificateNumber,
      verificationOfficer: officerName,
      verificationDate: today,
      sessionId: newCode,
      backendSessionId: null,
      backendInstrumentId: instId,
      currentStep: 2,
    }));

    setCurrentView('test-session');
  };

  const loadSessionReadings = async (sessionId?: number): Promise<ApiReading[]> => {
    const sid = sessionId || activeBackendSessionId;
    if (!sid) return [];
    try {
      return await readingsApi.getSessionReadings(sid);
    } catch (err) {
      console.warn('Could not load readings from backend:', err);
      return [];
    }
  };

  // Creates/Registers instrument & session in PostgreSQL
  const createBackendSession = async (): Promise<boolean> => {
    try {
      // 1. Ensure instrument exists or register it
      let instId = draftSession.backendInstrumentId;

      // Check if instrument with this serial already exists
      try {
        const existingInst = await instrumentsApi.getBySerial(draftSession.serialNumber);
        if (existingInst) {
          instId = existingInst.id;
          setActiveInstrumentId(existingInst.id);
        }
      } catch {
        // Not found — create it
        const createdInst = await instrumentsApi.createInstrument({
          manufacturer: draftSession.manufacturer,
          model: draftSession.model,
          serial_number: draftSession.serialNumber,
          functional_type: draftSession.instrumentType,
          accuracy_class: `Class ${draftSession.accuracyClass}`,
          max_capacity: draftSession.maxCapacity,
          min_capacity: draftSession.minCapacity,
          unit: draftSession.unit,
          verification_scale_interval_e: draftSession.verificationScaleInterval_e,
          actual_scale_interval_d: draftSession.actualScaleInterval_d,
          software_applicable: draftSession.softwareApplicable,
        });
        instId = createdInst.id;
        setActiveInstrumentId(createdInst.id);
      }

      // 2. Create session in backend
      const createdSess = await sessionsApi.createSession({
        session_code: draftSession.sessionId,
        instrument_id: instId!,
        officer_name: draftSession.verificationOfficer,
        test_location: draftSession.testLocation,
        verification_date: draftSession.verificationDate || new Date().toISOString().split('T')[0],
        status: 'IN_PROGRESS',
        current_step: draftSession.currentStep || 1,
        test_type: draftSession.testType,
        temperature_c: draftSession.temperatureC,
        relative_humidity_pct: draftSession.relativeHumidityPct,
        atmospheric_pressure_hpa: draftSession.atmosphericPressureHpa,
        environment_source: draftSession.environmentSource,
        standards_used: draftSession.standardsUsed || null,
      });

      setActiveBackendSessionId(createdSess.id);
      setActiveSessionId(createdSess.session_code);
      setActiveInstrumentId(instId ?? null);
      setDraftSession(prev => ({
        ...prev,
        backendSessionId: createdSess.id,
        backendInstrumentId: instId ?? null,
      }));

      await refreshBackendData();
      return true;
    } catch (err: any) {
      console.error('Failed to create session on backend:', err);
      // If conflict (session code already exists), fetch the existing one
      try {
        const existing = await sessionsApi.getSessionByCode(draftSession.sessionId);
        if (existing) {
          setActiveBackendSessionId(existing.id);
          setActiveSessionId(existing.session_code);
          setActiveInstrumentId(existing.instrument_id);
          setDraftSession(prev => ({
            ...prev,
            backendSessionId: existing.id,
            backendInstrumentId: existing.instrument_id,
          }));
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    }
  };

  const saveDraft = async () => {
    if (backendConnected && draftSession.backendSessionId) {
      try {
        await sessionsApi.updateSession(draftSession.backendSessionId, {
          current_step: draftSession.currentStep,
          test_type: draftSession.testType,
          temperature_c: draftSession.temperatureC,
          relative_humidity_pct: draftSession.relativeHumidityPct,
          atmospheric_pressure_hpa: draftSession.atmosphericPressureHpa,
          environment_source: draftSession.environmentSource,
          standards_used: draftSession.standardsUsed || null,
          officer_name: draftSession.verificationOfficer,
          test_location: draftSession.testLocation,
        });
      } catch (e) {
        console.warn('Could not sync draft step to backend:', e);
      }
    }
  };

  const proceedToStep = (stepNumber: number) => {
    setDraftSession(prev => ({
      ...prev,
      currentStep: stepNumber,
    }));

    if (backendConnected && draftSession.backendSessionId) {
      sessionsApi.updateSession(draftSession.backendSessionId, {
        current_step: stepNumber,
      }).catch(err => console.warn('Could not update session step on backend:', err));
    }
  };

  // FIXED: selectSession properly fetches the session by code from the backend API
  const selectSession = async (sessionCode: string) => {
    setActiveSessionId(sessionCode);

    try {
      // Fetch the real session object from backend by session_code
      const apiSession = await sessionsApi.getSessionByCode(sessionCode);
      if (!apiSession) return;

      setActiveBackendSessionId(apiSession.id);
      setActiveInstrumentId(apiSession.instrument_id);

      // Fetch instrument details
      let instData: ApiInstrument | null = null;
      try {
        instData = await instrumentsApi.getById(apiSession.instrument_id);
      } catch {
        // ignore if instrument fetch fails
      }

      const draft: DraftFormData = {
        ...defaultDemoDraftData,
        manufacturer: instData?.manufacturer || '',
        model: instData?.model || '',
        serialNumber: instData?.serial_number || '',
        accuracyClass: instData ? (['I', 'II', 'III', 'IV'].includes(
          instData.accuracy_class.replace(/^Class\s+/i, '').trim()
        ) ? instData.accuracy_class.replace(/^Class\s+/i, '').trim() as any : 'II') : 'II',
        maxCapacity: instData?.max_capacity || 0,
        minCapacity: instData?.min_capacity || 0,
        unit: (instData?.unit || 'g') as any,
        verificationScaleInterval_e: instData?.verification_scale_interval_e || 0,
        actualScaleInterval_d: instData?.actual_scale_interval_d || 0,
        instrumentType: (instData?.functional_type || '') as any,
        softwareApplicable: instData?.software_applicable || false,
        testType: (apiSession.test_type || 'INITIAL_VERIFICATION') as any,
        temperatureC: apiSession.temperature_c ?? 20.0,
        relativeHumidityPct: apiSession.relative_humidity_pct ?? 50.0,
        atmosphericPressureHpa: apiSession.atmospheric_pressure_hpa ?? 1013.2,
        environmentSource: (apiSession.environment_source || 'MANUAL') as any,
        standardsUsed: apiSession.standards_used || defaultDemoDraftData.standardsUsed,
        verificationOfficer: apiSession.officer_name,
        testLocation: apiSession.test_location,
        verificationDate: apiSession.verification_date,
        currentStep: apiSession.current_step,
        sessionId: apiSession.session_code,
        backendSessionId: apiSession.id,
        backendInstrumentId: apiSession.instrument_id,
      };

      setDraftSession(draft);
      setCurrentView('new-test-session');
    } catch (err) {
      console.warn('Could not load session from backend:', err);
      // Fallback: search local testSessions array
      const existing = testSessions.find(s => s.sessionId === sessionCode);
      if (existing) {
        setDraftSession(prev => ({
          ...prev,
          manufacturer: existing.instrument.manufacturer,
          model: existing.instrument.model,
          serialNumber: existing.instrument.serialNumber,
          accuracyClass: existing.instrument.accuracyClass,
          maxCapacity: existing.instrument.maxCapacity,
          minCapacity: existing.instrument.minCapacity,
          unit: existing.instrument.unit,
          verificationScaleInterval_e: existing.instrument.verificationScaleInterval_e,
          actualScaleInterval_d: existing.instrument.actualScaleInterval_d,
          instrumentType: existing.instrument.instrumentType,
          softwareApplicable: existing.instrument.softwareApplicable,
          verificationOfficer: existing.officerName,
          testLocation: existing.testLocation,
          verificationDate: existing.verificationDate,
          currentStep: existing.currentStep,
          sessionId: existing.sessionId,
          backendSessionId: null,
          backendInstrumentId: parseInt(existing.instrumentId, 10) || null,
        }));
        setCurrentView('new-test-session');
      }
    }
  };

  return (
    <VerificationContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        currentView,
        activeSessionId,
        activeBackendSessionId,
        activeInstrumentId,
        testSessions,
        instruments,
        dashboardKPIs,
        anomalyAlerts,
        auditTrail,
        draftSession,
        backendConnected,
        databaseConnected,
        backendLoading,
        backendError,
        login,
        demoLogin,
        logout,
        setCurrentView,
        updateDraft,
        saveDraft,
        createBackendSession,
        createNewSession,
        selectInstrument,
        loadSessionReadings,
        proceedToStep,
        selectSession,
        refreshBackendData,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
};

export const useVerification = (): VerificationContextType => {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
};
