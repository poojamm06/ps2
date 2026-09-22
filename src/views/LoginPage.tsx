import React, { useState } from 'react';
import { useVerification } from '../context/VerificationContext';

export const LoginPage: React.FC = () => {
  const { login, demoLogin } = useVerification();
  const [email, setEmail] = useState('h.vance@metrology.gov');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter your Officer ID and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      login(email, password);
      setLoading(false);
    }, 400);
  };

  const handleDemoAccess = () => {
    setLoading(true);
    setTimeout(() => {
      demoLogin();
      setLoading(false);
    }, 300);
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center bg-surface px-6 py-12"
      style={{
        backgroundImage: 'radial-gradient(#c4c6cf 0.75px, transparent 0.75px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Platform Authority Banner */}
      <div className="text-center mb-8 max-w-sm">
        <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center text-on-primary mx-auto mb-4 shadow-card">
          <span className="material-symbols-outlined text-[32px]">scale</span>
        </div>

        <h1 className="font-display-lg text-display-lg text-primary tracking-tight">NAWI TRUST</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2">
          Intelligent Metrological Verification &amp; Compliance Platform
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container-high border border-outline-variant/50">
          <span className="material-symbols-outlined text-[14px] text-secondary">verified_user</span>
          <span className="font-label-mono-sm text-label-mono-sm text-secondary font-semibold uppercase tracking-wider">
            OIML R-76 Conforming Architecture
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-card-hover border border-outline-variant/40 overflow-hidden">
        <div className="p-6 border-b border-outline-variant/30">
          <h2 className="font-headline-lg text-headline-lg text-primary">Officer Authentication</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Enter your credentials to access the legal metrology workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container border border-error/30">
              <span className="material-symbols-outlined text-[18px] text-error flex-shrink-0 mt-0.5">error</span>
              <span className="font-body-md text-body-sm text-on-error-container">{errorMsg}</span>
            </div>
          )}

          {/* Officer ID */}
          <div>
            <label className="nawi-label">Officer ID / Official Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline">
                person
              </span>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. h.vance@metrology.gov or LM-8492"
                className="nawi-input pl-9"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="nawi-label">Secure Password / PKI PIN</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter secure password"
                className="nawi-input pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors"
              >
                {showPassword ? 'visibility_off' : 'visibility'}
              </button>
            </div>
          </div>

          {/* Remember + Reset */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-3.5 h-3.5 accent-secondary" />
              <span className="font-body-md text-body-sm text-on-surface-variant">Remember terminal</span>
            </label>
            <a href="#" onClick={e => e.preventDefault()} className="font-body-md text-body-sm text-secondary hover:text-primary transition-colors">
              Assistance / Token Reset
            </a>
          </div>

          {/* Sign In */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">login</span>
            )}
            Sign In to Verification Platform
          </button>

          {/* Divider */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant/40"></div>
            <span className="font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">Demonstration Access</span>
            <div className="flex-1 h-px bg-outline-variant/40"></div>
          </div>

          {/* Demo Login */}
          <button
            type="button"
            onClick={handleDemoAccess}
            disabled={loading}
            className="btn-outline w-full justify-center py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            Demo Login — Insp. Helena Vance (LMO)
          </button>
        </form>
      </div>

      {/* Footer Notice */}
      <div className="mt-6 text-center max-w-md">
        <div className="flex items-center justify-center gap-2 font-label-mono-sm text-label-mono-sm text-on-surface-variant mb-2">
          <span className="material-symbols-outlined text-[14px] text-on-tertiary-container">verified</span>
          Legal Metrology Verification Platform
        </div>
        <p className="font-body-sm text-body-sm text-outline leading-relaxed">
          Authorized use only. All metrological test decisions are strictly governed by deterministic
          rule-based algorithms conforming to National Weights &amp; Measures Directives and OIML R-76.
        </p>
      </div>
    </div>
  );
};
