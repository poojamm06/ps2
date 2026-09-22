import React from 'react';
import { useVerification } from '../context/VerificationContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ChartTitle, ChartTooltip, Legend, Filler);

export const GrcAnalyticsView: React.FC = () => {
  const { dashboardKPIs } = useVerification();

  const complianceTrendData = {
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [
      {
        label: 'Statutory Compliance Rate (%)',
        data: [91.8, 92.4, 93.1, 93.8, 94.2, 94.6],
        borderColor: '#3c9e57',
        backgroundColor: 'rgba(60,158,87,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#3c9e57',
      },
      {
        label: 'Target Regulatory Threshold (90%)',
        data: [90.0, 90.0, 90.0, 90.0, 90.0, 90.0],
        borderColor: '#ba1a1a',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const complianceTrendOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      y: { min: 85, max: 100, grid: { color: '#eff4ff' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f', callback: (v: any) => `${v}%` } },
      x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' } },
    },
    plugins: {
      legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 }, color: '#44474e' } },
    },
  };

  const verificationVolumeData = {
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [
      {
        label: 'Verification Sessions',
        data: [218, 234, 248, 261, 279, 294],
        backgroundColor: 'rgba(0,99,152,0.6)',
        borderColor: '#006398',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'First-Pass PASS',
        data: [201, 216, 231, 245, 263, 278],
        backgroundColor: 'rgba(60,158,87,0.5)',
        borderColor: '#3c9e57',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const volumeOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, grid: { color: '#eff4ff' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' } },
      x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#74777f' } },
    },
    plugins: {
      legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 }, color: '#44474e' } },
    },
  };

  const grcKPIs = [
    { label: 'Statutory Compliance Rate', value: `${dashboardKPIs.complianceRatePercent}%`, trend: '↑ +2.8% YTD', trendUp: true, icon: 'verified_user', sub: 'vs 90% regulatory threshold' },
    { label: 'Total Instruments Verified', value: dashboardKPIs.instrumentsVerifiedCount.toLocaleString(), trend: '↑ +8.4% YoY', trendUp: true, icon: 'precision_manufacturing', sub: 'Fiscal year-to-date' },
    { label: 'Open Non-Conformances', value: '7', trend: '↓ -3 from last month', trendUp: false, icon: 'cancel', sub: 'Requires corrective action' },
    { label: 'Risk Score', value: 'LOW (2.4)', trend: 'Stable', trendUp: true, icon: 'security', sub: 'OIML + WELMEC composite score' },
  ];

  const nonConformances = [
    { id: 'NC-2026-041', type: 'MPE Exceedance', instrument: 'AVT-ZM510-77301', session: 'TS-2026-0865', status: 'Open', priority: 'High', date: '2026-09-15' },
    { id: 'NC-2026-038', type: 'Evidence Missing', instrument: 'MT-XP205-89410', session: 'TS-2026-0891', status: 'Under Review', priority: 'Medium', date: '2026-09-19' },
    { id: 'NC-2026-035', type: 'Hysteresis Borderline', instrument: 'SAR-COM3-48192', session: 'TS-2026-0879', status: 'Escalated', priority: 'Medium', date: '2026-09-17' },
  ];

  return (
    <>
      {/* Header */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-card">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div>
            <div className="flex flex-wrap items-center gap-space-xs mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono-sm text-label-mono-sm font-semibold uppercase">GOVERNANCE // GRC ANALYTICS</span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-mono-sm text-label-mono-sm uppercase font-bold">OIML R-76 | WELMEC 7.2</span>
            </div>
            <h1 className="font-display-md text-display-md text-primary tracking-tight">GRC Analytics &amp; Governance Dashboard</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Governance, Risk, and Compliance metrics for legal metrology operations — statutory reporting view
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export GRC Report
            </button>
          </div>
        </div>
      </section>

      {/* GRC KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
        {grcKPIs.map(kpi => (
          <div key={kpi.label} className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-md hover:shadow-card-hover transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider font-semibold">{kpi.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${kpi.trendUp ? 'text-on-tertiary-container' : 'text-error'}`}>{kpi.icon}</span>
            </div>
            <div className="metrology-mono text-2xl font-bold text-primary mb-1">{kpi.value}</div>
            <div className={`font-label-mono-sm text-label-mono-sm font-semibold ${kpi.trendUp ? 'text-on-tertiary-container' : 'text-error'}`}>
              {kpi.trend}
            </div>
            <div className="font-body-sm text-body-sm text-outline mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* Compliance Trend */}
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">6-MONTH TREND</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Statutory Compliance Rate Trend</h3>
            </div>
          </div>
          <div style={{ height: 220 }}>
            <Line data={complianceTrendData} options={complianceTrendOptions} />
          </div>
        </div>

        {/* Verification Volume */}
        <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20 p-space-lg">
          <div className="flex items-center gap-2 mb-space-md">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">MONTHLY VOLUME</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Verification Volume &amp; First-Pass Rate</h3>
            </div>
          </div>
          <div style={{ height: 220 }}>
            <Bar data={verificationVolumeData} options={volumeOptions} />
          </div>
        </div>
      </div>

      {/* Non-Conformance Register */}
      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/20">
        <div className="flex items-center justify-between p-space-lg border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="section-header-bar"></span>
            <div>
              <div className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">NON-CONFORMANCE REGISTER</div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">Open Non-Conformances Requiring Action</h3>
            </div>
          </div>
          <button className="btn-outline">
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Raise NC
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="nawi-table">
            <thead>
              <tr>
                <th>NC Reference</th>
                <th>Type</th>
                <th>Instrument S/N</th>
                <th>Session</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Date Raised</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {nonConformances.map(nc => (
                <tr key={nc.id}>
                  <td><span className="metrology-mono text-[12px] font-semibold text-primary">{nc.id}</span></td>
                  <td><span className="font-body-sm font-semibold text-on-surface">{nc.type}</span></td>
                  <td><span className="metrology-mono text-[12px] text-on-surface-variant">{nc.instrument}</span></td>
                  <td><span className="metrology-mono text-[12px] text-secondary">{nc.session}</span></td>
                  <td>
                    <span className={`px-2 py-0.5 rounded font-label-mono-sm text-label-mono-sm font-semibold ${
                      nc.priority === 'High' ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {nc.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 rounded font-label-mono-sm text-label-mono-sm font-semibold ${
                      nc.status === 'Open' ? 'bg-error-container text-on-error-container'
                      : nc.status === 'Escalated' ? 'bg-error text-on-error'
                      : 'badge-review'
                    }`}>
                      {nc.status}
                    </span>
                  </td>
                  <td><span className="metrology-mono text-[11px] text-outline">{nc.date}</span></td>
                  <td>
                    <button className="btn-ghost text-secondary text-[12px]">Review →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Governance Framework Notice */}
      <section className="bg-surface-container-high p-space-md rounded-xl shadow-card flex items-start gap-space-sm">
        <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">policy</span>
        </div>
        <div>
          <div className="font-label-mono-sm text-label-mono-sm text-secondary uppercase tracking-wider font-bold mb-1">
            Governance, Risk &amp; Compliance Framework
          </div>
          <div className="font-body-md text-body-md text-primary">
            GRC metrics are generated from deterministic compliance engine outputs and immutable audit ledger data. All statutory reporting conforms to OIML R-76, WELMEC 7.2, and national weights &amp; measures directives. Risk scoring is advisory and does not override official pass/fail verdicts.
          </div>
        </div>
      </section>
    </>
  );
};
