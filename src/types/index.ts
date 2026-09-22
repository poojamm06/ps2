// Metrological Accuracy Classes according to OIML R-76
export type AccuracyClass = 'I' | 'II' | 'III' | 'IV';

// Instrument Category per OIML R-76 Section 7.1
export type InstrumentCategory = 'Complete' | 'Module' | 'Family';

// Reference Standard Equipment per test_equipment_register (Section 7.1)
export interface ReferenceStandard {
  id: string;
  equipmentType: 'Weights' | 'Simulator' | 'Chamber' | 'EMC Generator';
  modelNumber: string;
  serialNumber: string;
  accuracyClassOrGrade: string; // e.g. E2, F1, F2, M1
  calibrationCertNumber: string;
  calibrationDate: string;
  measurementUncertainty: string;
}

// Additional Metrological Parameters (collapsible section)
export interface AdditionalMetrologicalSpecs {
  isMultiInterval: boolean;
  isMultipleRange: boolean;
  tareType: 'Subtractive' | 'Additive' | 'Preset' | 'None';
  maxTareEffect: string;
  tempMinC: string;
  tempMaxC: string;
  voltageNominal: string;
  voltageMin: string;
  voltageMax: string;
  batteryCutoffV: string;
  hasZeroSettingDevice: boolean;
}

// Static Weighing Observation Point per OIML R-76 Clause A.4.4.3 & entity weighing_test_points
export interface StaticWeighingPoint {
  id: string;
  pointNumber: number;
  appliedLoad: string;          // L [unit]
  indication: string;           // I [unit]
  additionalLoadDeltaL: string; // ΔL [unit]
  zeroErrorE0: string;          // E0 [unit]
  priorRoundingP?: string;      // P = I + 0.5e - ΔL
  rawErrorE?: string;           // E = P - L
  correctedErrorEc?: string;    // Ec = E - E0
  mpeLimit?: string;            // Table 6 MPE
  mpeFactor?: number;           // 0.5, 1.0, 1.5
  mVerifIntervals?: number;     // m = L / e
  pointVerdict?: 'PASS' | 'FAIL' | 'REVIEW' | 'PENDING' | 'NOT_TESTED';
  isDemo?: boolean;
}

// NAWI Instrument Categories
export type InstrumentType = 
  | 'Retail Bench Scale'
  | 'Industrial Platform Scale'
  | 'High-Precision Analytical Balance'
  | 'Crane & Suspended Scale'
  | 'Hopper / Silo Weighing System'
  | 'Vehicle Weighbridge';

// Verification Status values
export type ComplianceStatus = 'PASS' | 'FAIL' | 'REVIEW';

export type SessionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export type AnomalySeverity = 'Normal' | 'Attention' | 'Anomaly';

export interface Instrument {
  id: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  accuracyClass: AccuracyClass;
  maxCapacity: number; // in unit
  minCapacity: number; // in unit
  unit: 'g' | 'kg' | 't' | 'mg';
  verificationScaleInterval_e: number; // e
  actualScaleInterval_d: number; // d
  instrumentType: InstrumentType;
  softwareApplicable: boolean;
  approvalCertificateNumber?: string;
  yearOfManufacture?: number;
  location: string;
  ownerOrganization?: string;
}

export interface TestSession {
  sessionId: string;
  instrumentId: string;
  instrument: Instrument;
  officerName: string;
  officerBadge: string;
  testLocation: string;
  verificationDate: string;
  currentStep: number; // 1 to 8
  status: SessionStatus;
  complianceVerdict?: ComplianceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceTestRow {
  id: string;
  testType: 'Initial Zero-Setting' | 'Weighing Performance' | 'Tare Test' | 'Eccentricity' | 'Repeatability';
  appliedLoad: number;
  indicatedValue: number;
  referenceValue: number;
  error: number;
  applicableMPE: number; // Maximum Permissible Error (±)
  result: ComplianceStatus;
}

export interface EvidenceCardItem {
  id: string;
  type: 'display' | 'nameplate' | 'seal' | 'setup' | 'test';
  title: string;
  timestamp: string;
  evidenceId: string;
  status: 'Captured' | 'Verified' | 'Pending Review' | 'Missing';
  imageUrl?: string;
  ocrData?: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    max?: string;
    min?: string;
    e?: string;
    d?: string;
    confidence: number;
  };
}

export interface SoftwareVerificationRecord {
  applicable: boolean;
  softwareId?: string;
  softwareVersion?: string;
  checksumHash?: string;
  protectedParametersVerified?: boolean;
  communicationInterfaceStatus?: string;
  parameterAuditTrailClean?: boolean;
  status: 'Verified' | 'Mismatch' | 'Review Required' | 'Not Applicable';
}

export interface AnomalyAlert {
  id: string;
  sessionId: string;
  instrumentSerial: string;
  category: 'Error Pattern' | 'Repeatability Drift' | 'Historical Deviation' | 'Evidence Inconsistency' | 'Process Deviation';
  severity: AnomalySeverity;
  score: number; // 0.00 to 1.00
  title: string;
  description: string;
  timestamp: string;
}

export interface AuditTrailEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  officer: string;
  action: 
    | 'Session Created'
    | 'Instrument Registered'
    | 'Reading Captured'
    | 'Evidence Uploaded'
    | 'OCR Processed'
    | 'Compliance Calculated'
    | 'Fingerprint Generated'
    | 'Software Verified'
    | 'Report Generated';
  referenceId: string;
  details?: string;
}

export interface DashboardKPIs {
  activeSessionsCount: number;
  instrumentsVerifiedCount: number;
  pendingReviewsCount: number;
  complianceRatePercent: number;
  anomaliesDetectedCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Legal Metrology Officer' | 'Testing Centre Specialist' | 'NAWI Manufacturer / OEM';
  badgeNumber: string;
  station: string;
  jurisdiction: string;
}
