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
import type { TestSession } from '../types';

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

export const DashboardView: React.FC = () => {
  const { 
    dashboardKPIs, 
    testSessions, 
    anomalyAlerts, 
    setCurrentView, 
    selectSession, 
    backendConnected, 
    databaseConnected, 
    refreshBackendData 
  } = useVerification();

  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!backendConnected) return;
    setStatsLoading(true);
    dashboardApi.getStats()
      .then(s => setDbStats(s))
      .catch(() => setDbStats(null))
      .finally(() => setStatsLoading(false));
  }, [backendConnected]);

  // Real compliance distribution from database
  const complianceChartData = {
    labels: ['PASS (Compliant)', 'FAIL (Non-Compliant)', 'REVIEW (Flagged)', 'Unverified'],
    datasets: [{
      data: dbStats
        ? [
            dbStats.compliance_distribution.pass,
            dbStats.compliance_distribution.fail,
            dbStats.compliance_distribution.review,
            dbStats.compliance_distribution.unverified,
          ]
        : [0, 0, 0, 0],
      backgroundColor: ['#3c9e57', '#ba1a1a', '#e65100', '#94a3b8'],
      borderColor: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
      borderWidth: 2,
      hoverOffset: 4,
    }],
  };

  const totalForChart = dbStats
    ? (dbStats.compliance_distribution.pass + dbStats.compliance_distribution.fail + dbStats.compliance_distribution.review + dbStats.compliance_distribution.unverified)
    : 1;

  const complianceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, padding: 14, font: { family: 'JetBrains Mono', size: 10 }, color: '#44474e' },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / totalForChart) * 100).toFixed(1)}%)`,
        },
      },
    },
    cutout: '72%',
  };

  // Real weekly activity from backend — actual DB sessions per day
  const weeklyLabels = dbStats?.weekly_activity?.map(d => d.label) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyData = dbStats?.weekly_activity?.map(d => d.sessions) || [0, 0, 0, 0, 0, 0, 0];

  const activityChartData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: 'Sessions Created',
        data: weeklyData,
        borderColor: '#001026',
        backgroundColor: 'rgba(0,16,38,0.06)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#001026',
      },
    ],
  };

  const activityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#eff4ff' },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f', stepSize: 1 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 }, color: '#44474e' },
      },
    },
  };

  const kpiCards = [
    {
      label: 'Active Sessions',
      value: String(dbStats?.active_sessions ?? dashboardKPIs.activeSessionsCount),
      icon: 'lab_research',
      iconColor: 'text-secondary',
      badge: { text: 'In Progress', bg: 'bg-secondary-fixed text-on-secondary-fixed' },
      sub: 'Across testing stations',
    },
    {
      label: 'Instruments Registered',
      value: (dbStats?.total_instruments ?? dashboardKPIs.instrumentsVerifiedCount).toLocaleString(),
      icon: 'check_circle',
      iconColor: 'text-on-tertiary-container',
      badge: { text: 'PostgreSQL', bg: 'bg-tertiary-fixed/40 text-on-tertiary-container' },
      sub: 'Live database inventory',
    },
    {
      label: 'Pending Reviews',
      value: String(dbStats?.pending_reviews ?? dashboardKPIs.pendingReviewsCount),
      icon: 'schedule',
      iconColor: 'text-error',
      badge: { text: 'Requires Officer', bg: 'bg-error-container text-on-error-container' },
      sub: 'Borderline MPE evaluations',
    },
    {
      label: 'Compliance Rate',
      value: `${dbStats?.compliance_rate_percent ?? dashboardKPIs.complianceRatePercent}%`,
      icon: 'verified_user',
      iconColor: 'text-on-tertiary-container',
      badge: { text: 'OIML R-76', bg: 'bg-secondary-fixed text-on-secondary-fixed' },
      sub: 'Deterministic verification pass',
    },
    {
      label: 'Total Sessions',
      value: String(dbStats?.total_sessions ?? testSessions.length),
      icon: 'assignment',
      iconColor: 'text-secondary',
      badge: { text: 'All Time', bg: 'bg-surface-container text-on-surface-variant' },
      sub: 'Completed & in-progress',
    },
  ];

  return (
    <>
      {/* Page Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold">
                CENTRAL METROLOGY SYSTEM
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-label-mono-sm font-semibold uppercase flex items-center gap-1.5 ${
                databaseConnected ? 'bg-tertiary-fixed/40 text-on-tertiary-container' : 'bg-surface-container text-outline'
              }`}>
                <span className={`w-2 h-2 rounded-full ${databaseConnected ? 'bg-on-tertiary-container animate-pulse' : 'bg-outline'}`}></span>
                {databaseConnected ? 'POSTGRESQL CONNECTED' : backendConnected ? 'API CONNECTED' : 'OFFLINE MODE'}
              </span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">Verification Dashboard</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Operational overview of non-automatic weighing instrument compliance and test sessions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              onClick={() => refreshBackendData()}
              className="btn-outline"
              title="Sync latest state from PostgreSQL"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              Sync DB
            </button>
            <button
              onClick={() => setCurrentView('new-test-session')}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              New Test Session
            </button>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-space-md">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md hover:shadow-card-hover transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold">{kpi.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${kpi.iconColor}`}>{kpi.icon}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="metrology-mono text-2xl font-bold text-primary">
                {statsLoading ? '—' : kpi.value}
              </span>
            </div>
            <span className={`inline-flex px-1.5 py-0.5 rounded font-label-mono-sm text-[10px] font-semibold ${kpi.badge.bg}`}>
              {kpi.badge.text}
            </span>
            <p className="font-body-sm text-body-sm text-outline mt-2">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-2">
              <span className="section-header-bar"></span>
              <div>
                <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Weekly Activity</div>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Sessions Created — Last 7 Days</h3>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-tertiary-fixed/30 text-on-tertiary-container font-label-mono-sm text-label-mono-sm font-semibold">
              ACTUAL DB RECORDS
            </span>
          </div>
          <div style={{ height: 240 }}>
            <Line data={activityChartData} options={activityChartOptions} />
          </div>
          {!databaseConnected && (
            <p className="font-label-mono-sm text-label-mono-sm text-outline mt-2 text-center">
              Connect to PostgreSQL to view actual activity data
            </p>
          )}
        </div>

        {/* Compliance Doughnut */}
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Compliance Status</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Distribution</h3>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <Doughnut data={complianceChartData} options={complianceChartOptions} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm font-semibold">OIML R-76 MPE</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Rule-based deterministic classification</span>
          </div>
          {dbStats && (
            <div className="mt-2 font-label-mono-sm text-label-mono-sm text-outline text-center">
              {dbStats.total_sessions} total session{dbStats.total_sessions !== 1 ? 's' : ''} in database
            </div>
          )}
        </div>
      </div>

      {/* Anomaly Alerts Strip */}
      {anomalyAlerts.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-card border-l-4 border-error p-space-lg">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-error">crisis_alert</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                Active Anomaly Intelligence Flags ({anomalyAlerts.length})
              </span>
              <span className="hidden md:inline font-body-sm text-body-sm text-on-surface-variant">
                — Anomaly layer detects telemetry drift &amp; evidence variance
              </span>
            </div>
            <button
              onClick={() => setCurrentView('anomaly')}
              className="btn-ghost text-secondary font-semibold"
            >
              View Anomaly Intelligence →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
            {anomalyAlerts.map(alert => (
              <div key={alert.id} className="bg-surface-container-low p-space-md rounded-lg border border-outline-variant/30">
                <div className="flex items-center justify-between mb-2">
                  <span className={alert.severity === 'Anomaly' ? 'severity-anomaly' : 'severity-attention'}>
                    {alert.category} • {alert.severity}
                  </span>
                  <span className="metrology-mono text-[10px] text-outline">
                    Score: {(alert.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="font-body-md text-body-sm font-semibold text-on-surface mb-1">{alert.title}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{alert.description}</div>
                <div className="mt-2 flex items-center justify-between font-label-mono-sm text-label-mono-sm text-outline">
                  <span>S/N: {alert.instrumentSerial}</span>
                  <span>{alert.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex items-center justify-between p-space-lg border-b border-outline-variant/30">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Recent Verification Sessions</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              {databaseConnected
                ? `Live sessions from PostgreSQL (${testSessions.length} record${testSessions.length !== 1 ? 's' : ''})`
                : 'Connect to PostgreSQL to view real sessions'}
            </p>
          </div>
          <button
            onClick={() => setCurrentView('test-sessions')}
            className="btn-ghost"
          >
            View Full Register →
          </button>
        </div>
        <div className="overflow-x-auto">
          {testSessions.length === 0 ? (
            <div className="p-space-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-outline mb-4">assignment</span>
              <p className="font-headline-sm text-headline-sm text-primary font-bold">No Sessions Yet</p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                {databaseConnected
                  ? 'No verification sessions in database. Start a new session to begin.'
                  : 'Connect to PostgreSQL to view verification sessions.'}
              </p>
              <button onClick={() => setCurrentView('new-test-session')} className="btn-primary mt-4">
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Start New Session
              </button>
            </div>
          ) : (
            <table className="nawi-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Instrument &amp; Type</th>
                  <th>Accuracy Class</th>
                  <th>Test Location</th>
                  <th>Date</th>
                  <th>Step</th>
                  <th>Verdict</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {testSessions.slice(0, 10).map((session: TestSession) => (
                  <tr key={session.sessionId}>
                    <td>
                      <span className="metrology-mono text-[12px] font-semibold text-primary">{session.sessionId}</span>
                    </td>
                    <td>
                      <div className="font-body-md text-body-sm font-semibold text-on-surface">
                        {session.instrument.manufacturer} {session.instrument.model}
                      </div>
                      <div className="font-label-mono-sm text-label-mono-sm text-outline mt-0.5">
                        S/N: <span className="metrology-mono">{session.instrument.serialNumber}</span>
                        {session.instrument.instrumentType ? ` • ${session.instrument.instrumentType}` : ''}
                      </div>
                    </td>
                    <td>
                      <AccuracyClassBadge cls={session.instrument.accuracyClass} />
                    </td>
                    <td>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{session.testLocation}</span>
                    </td>
                    <td>
                      <span className="metrology-mono text-[11px] text-outline">{session.verificationDate}</span>
                    </td>
                    <td>
                      <span className="font-label-mono-sm text-[11px] font-semibold text-secondary">
                        Step {session.currentStep}/8
                      </span>
                    </td>
                    <td>
                      <VerdictBadge verdict={session.complianceVerdict} />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => selectSession(session.sessionId)}
                        className="btn-ghost text-[12px] font-semibold text-secondary"
                      >
                        Resume →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};
