import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { useVerification } from '../context/VerificationContext';
import { dashboardApi, type DashboardStats } from '../services/api';
import { mockTestSessions } from '../mock/mockData';
import type { TestSession } from '../types';
import type { NavigationKey } from '../context/VerificationContext';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, ArcElement,
  ChartTitle, ChartTooltip, Legend, Filler
);

const VerdictBadge: React.FC<{ verdict?: string }> = ({ verdict }) => {
  if (verdict === 'PASS') return <span className="badge-pass">PASS</span>;
  if (verdict === 'FAIL') return <span className="badge-fail">FAIL</span>;
  if (verdict === 'REVIEW') return <span className="badge-review">REVIEW</span>;
  return <span className="badge-testing">IN PROGRESS</span>;
};

const AccuracyClassBadge: React.FC<{ cls: string }> = ({ cls }) => {
  const cleanCls = cls.replace(/^(Class\s+)/i, '').trim();
  const map: Record<string, string> = {
    'I': 'oiml-class-i', 'II': 'oiml-class-ii',
    'III': 'oiml-class-iii', 'IV': 'oiml-class-iv',
  };
  return <span className={map[cleanCls] || 'oiml-class-ii'}>Class {cleanCls}</span>;
};

const QUICK_ACTIONS: { key: NavigationKey; icon: string; label: string }[] = [
  { key: 'new-test-session', icon: 'add_circle', label: 'New Session' },
  { key: 'instruments', icon: 'scale', label: 'Register Instrument' },
  { key: 'fingerprint', icon: 'fingerprint', label: 'Fingerprint Verify' },
  { key: 'software', icon: 'security', label: 'Software Exam' },
  { key: 'reports', icon: 'description', label: 'Reports' },
  { key: 'repository', icon: 'folder_open', label: 'Repository' },
];

export const DashboardView: React.FC = () => {
  const {
    dashboardKPIs,
    testSessions,
    anomalyAlerts,
    setCurrentView,
    selectSession,
    backendConnected,
    databaseConnected,
  } = useVerification();

  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    if (!backendConnected) return;
    setStatsLoading(true);
    dashboardApi.getStats()
      .then(s => setDbStats(s))
      .catch(() => setDbStats(null))
      .finally(() => setStatsLoading(false));
  }, [backendConnected]);

  useEffect(() => {
    const t = setInterval(() => setHeroSlide(s => (s + 1) % 3), 4500);
    return () => clearInterval(t);
  }, []);

  // Demo-safety net: fall back to rich mock data so the dashboard never looks empty
  const isDemo = !databaseConnected;
  const displaySessions: TestSession[] = testSessions.length > 0 ? testSessions : mockTestSessions;
  const demoKpis = {
    active: mockTestSessions.filter(s => s.status === 'IN_PROGRESS').length,
    instruments: 8,
    pending: mockTestSessions.filter(s => s.complianceVerdict === 'REVIEW').length,
    complianceRate: 94.6,
    total: mockTestSessions.length,
  };

  const complianceChartData = {
    labels: ['PASS', 'FAIL', 'REVIEW', 'Unverified'],
    datasets: [{
      data: dbStats
        ? [
            dbStats.compliance_distribution.pass,
            dbStats.compliance_distribution.fail,
            dbStats.compliance_distribution.review,
            dbStats.compliance_distribution.unverified,
          ]
        : [
            mockTestSessions.filter(s => s.complianceVerdict === 'PASS').length,
            mockTestSessions.filter(s => s.complianceVerdict === 'FAIL').length,
            mockTestSessions.filter(s => s.complianceVerdict === 'REVIEW').length,
            mockTestSessions.filter(s => !s.complianceVerdict).length,
          ],
      backgroundColor: ['#16A34A', '#DC2626', '#F59E0B', '#C7B8FF'],
      borderColor: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
      borderWidth: 3,
      hoverOffset: 4,
    }],
  };

  const totalForChart = complianceChartData.datasets[0].data.reduce((a, b) => a + b, 0) || 1;

  const complianceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, padding: 14, font: { family: 'Inter', size: 11 }, color: '#5A5A72', usePointStyle: true, pointStyle: 'circle' },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / totalForChart) * 100).toFixed(1)}%)`,
        },
      },
    },
    cutout: '72%',
  };

  const weeklyLabels = dbStats?.weekly_activity?.map(d => d.label) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyData = dbStats?.weekly_activity?.map(d => d.sessions) || [3, 5, 2, 7, 6, 4, 8];

  const activityChartData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: 'Sessions Created',
        data: weeklyData,
        borderColor: '#4A3AFF',
        backgroundColor: 'rgba(74,58,255,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#4A3AFF',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };

  const activityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#F0EEFF' },
        border: { display: false },
        ticks: { font: { family: 'Inter', size: 11 }, color: '#8B8AA3', stepSize: 2 },
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { family: 'Inter', size: 11 }, color: '#8B8AA3' },
      },
    },
    plugins: { legend: { display: false } },
  };

  const kpiCards = [
    {
      label: 'Active Sessions',
      value: String(dbStats?.active_sessions ?? (isDemo ? demoKpis.active : dashboardKPIs.activeSessionsCount)),
      icon: 'science',
      iconBg: 'bg-[#EEEBFF] text-primary',
    },
    {
      label: 'Instruments Registered',
      value: (dbStats?.total_instruments ?? (isDemo ? demoKpis.instruments : dashboardKPIs.instrumentsVerifiedCount)).toLocaleString(),
      icon: 'inventory_2',
      iconBg: 'bg-[#DCFCE7] text-[#16A34A]',
    },
    {
      label: 'Pending Reviews',
      value: String(dbStats?.pending_reviews ?? (isDemo ? demoKpis.pending : dashboardKPIs.pendingReviewsCount)),
      icon: 'pending_actions',
      iconBg: 'bg-[#FEF3C7] text-[#B45309]',
    },
    {
      label: 'Compliance Rate',
      value: `${dbStats?.compliance_rate_percent ?? (isDemo ? demoKpis.complianceRate : dashboardKPIs.complianceRatePercent)}%`,
      icon: 'verified_user',
      iconBg: 'bg-[#EDE9FE] text-[#7C3AED]',
    },
    {
      label: 'Total Sessions',
      value: String(dbStats?.total_sessions ?? (isDemo ? demoKpis.total : testSessions.length)),
      icon: 'assignment',
      iconBg: 'bg-[#EEEBFF] text-primary',
    },
  ];

  const heroSlides = [
    { title: 'Verify weighing instruments with confidence', sub: 'End-to-end OIML R-76 digital verification, from registration to certificate — with a full audit trail.' },
    { title: 'Prove it’s the same approved unit', sub: 'Metrological fingerprinting catches substituted or tampered instruments that a standard check would pass.' },
    { title: 'Test the software, not just the physics', sub: 'Automated WELMEC 7.2 software examination — a penetration test for your legally relevant firmware.' },
  ];

  return (
    <>
      {/* Hero Banner */}
      <section className="hero-banner">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-space-lg">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white font-body-sm text-body-sm font-semibold mb-3">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Legal Metrology · Dept. of Consumer Affairs
            </span>
            <h1 className="font-display-lg text-[28px] leading-tight font-bold text-white">{heroSlides[heroSlide].title}</h1>
            <p className="font-body-lg text-body-lg text-white/85 mt-2">{heroSlides[heroSlide].sub}</p>
            <div className="flex items-center gap-space-sm mt-space-lg">
              <button
                onClick={() => setCurrentView('new-test-session')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-primary font-body-md text-body-md font-bold hover:bg-white/90 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                New Test Session
              </button>
              <button
                onClick={() => setCurrentView('repository')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white/10 text-white border border-white/30 font-body-md text-body-md font-semibold hover:bg-white/20 transition-colors"
              >
                Browse Repository
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center w-40 h-40 rounded-full bg-white/10 flex-shrink-0">
            <span className="material-symbols-outlined text-[76px] text-white/90">scale</span>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-1.5 mt-space-lg">
          {heroSlides.map((_, i) => (
            <span key={i} className={`hero-dot ${i === heroSlide ? 'active' : ''}`} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <div>
        <div className="section-heading-row">
          <h3 className="section-heading-title">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-space-md">
          {QUICK_ACTIONS.map(action => (
            <div key={action.key} className="quick-tile" onClick={() => setCurrentView(action.key)}>
              <div className="quick-tile-icon">
                <span className="material-symbols-outlined text-[22px]">{action.icon}</span>
              </div>
              <span className="font-body-sm text-body-sm font-semibold text-on-surface leading-tight">{action.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-space-md">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-space-sm ${kpi.iconBg}`}>
              <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
            </div>
            <div className="metrology-mono text-2xl font-bold text-on-surface">
              {statsLoading ? <span className="skeleton inline-block w-12 h-6 align-middle" /> : kpi.value}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
          <div className="section-heading-row">
            <h3 className="section-heading-title">Weekly Activity</h3>
            <span className="px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] font-label-mono-sm text-label-mono-sm font-semibold">
              {databaseConnected ? 'LIVE DB' : 'DEMO DATA'}
            </span>
          </div>
          <div style={{ height: 240 }}>
            <Line data={activityChartData} options={activityChartOptions} />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
          <div className="section-heading-row">
            <h3 className="section-heading-title">Compliance</h3>
          </div>
          <div style={{ height: 200 }}>
            <Doughnut data={complianceChartData} options={complianceChartOptions} />
          </div>
        </div>
      </div>

      {/* Anomaly Alerts Strip */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
        <div className="section-heading-row">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-[20px] ${anomalyAlerts.length > 0 ? 'text-error' : 'text-primary'}`}>
              {anomalyAlerts.length > 0 ? 'crisis_alert' : 'verified'}
            </span>
            <h3 className="section-heading-title">
              Anomaly Intelligence {anomalyAlerts.length > 0 ? `Flags (${anomalyAlerts.length})` : 'Status'}
            </h3>
          </div>
          <span onClick={() => setCurrentView('anomaly')} className="section-heading-link">
            {anomalyAlerts.length > 0 ? 'View all' : 'Run Analysis'} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </span>
        </div>
        {anomalyAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
            {anomalyAlerts.map(alert => (
              <div key={alert.id} className="bg-surface-container-low p-space-md rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className={alert.severity === 'Anomaly' ? 'severity-anomaly' : 'severity-attention'}>
                    {alert.severity}
                  </span>
                  <span className="metrology-mono text-[10px] text-outline">{(alert.score * 100).toFixed(0)}%</span>
                </div>
                <div className="font-body-md text-body-sm font-semibold text-on-surface mb-1">{alert.title}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{alert.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-space-md bg-surface-container-low rounded-xl text-on-surface-variant font-body-sm">
            <span className="material-symbols-outlined text-[20px] text-[#16A34A]">check_circle</span>
            <span>No active anomaly flags detected across verified sessions. Statistical distributions within OIML R-76 tolerance limits.</span>
          </div>
        )}
      </div>

      {/* Recent Verifications — document-row cards */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/40 p-space-lg">
        <div className="section-heading-row">
          <h3 className="section-heading-title">Recent Verifications</h3>
          <span onClick={() => setCurrentView('repository')} className="section-heading-link">
            View all <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </span>
        </div>
        <div className="divide-y divide-outline-variant/40">
          {displaySessions.slice(0, 6).map((session: TestSession) => (
            <div key={session.sessionId} className="doc-row" onClick={() => selectSession(session.sessionId)}>
              <div className="doc-row-icon">
                <span className="material-symbols-outlined text-[20px]">scale</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body-md text-body-md font-semibold text-on-surface truncate">
                  {session.instrument.manufacturer} {session.instrument.model}
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {session.sessionId} · S/N {session.instrument.serialNumber} · {session.testLocation}
                </div>
              </div>
              <AccuracyClassBadge cls={session.instrument.accuracyClass} />
              <span className="hidden sm:inline font-body-sm text-body-sm text-on-surface-variant w-24 text-center">
                Step {session.currentStep}/8
              </span>
              <VerdictBadge verdict={session.complianceVerdict} />
              <span className="material-symbols-outlined text-[18px] text-outline">chevron_right</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
