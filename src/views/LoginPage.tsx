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
      className="min-h-screen flex flex-col justify-center items-center px-6 py-12 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #F6F5FF 0%, #EEEBFF 55%, #E0D9FF 100%)' }}
    >
      {/* Decorative blobs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#5B4BFF]/10 pointer-events-none" />
      <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-[#7C3AED]/10 pointer-events-none" />

      {/* Emblem + wordmark */}
      <div className="text-center mb-8 max-w-sm relative z-10">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-hero"
          style={{ background: 'linear-gradient(135deg, #5B4BFF, #7C3AED)' }}
        >
          <span className="material-symbols-outlined text-[32px]">scale</span>
        </div>

        <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">NAWI Trust</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2">
          OIML R-76 verification &amp; trust-verification platform for weighing instruments
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-card">
          <span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>
          <span className="font-body-sm text-body-sm text-primary font-semibold">
            Dept. of Consumer Affairs · Legal Metrology
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-hero overflow-hidden relative z-10">
        <div className="p-6 pb-4">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Officer Login</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Sign in to access the verification workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEE2E2]">
              <span className="material-symbols-outlined text-[18px] text-error flex-shrink-0 mt-0.5">error</span>
              <span className="font-body-md text-body-sm text-error">{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="nawi-label">Officer ID / Official Email</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline">
                person
              </span>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. h.vance@metrology.gov or LM-8492"
                className="nawi-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="nawi-label">Secure Password / PKI PIN</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter secure password"
                className="nawi-input pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors"
              >
                {showPassword ? 'visibility_off' : 'visibility'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-3.5 h-3.5 accent-primary rounded" />
              <span className="font-body-md text-body-sm text-on-surface-variant">Remember this device</span>
            </label>
            <a href="#" onClick={e => e.preventDefault()} className="font-body-md text-body-sm text-primary hover:text-[#3D2FE0] transition-colors font-medium">
              Need help?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">login</span>
            )}
            Login
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant"></div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">or</span>
            <div className="flex-1 h-px bg-outline-variant"></div>
          </div>

          <button
            type="button"
            onClick={handleDemoAccess}
            disabled={loading}
            className="btn-outline w-full justify-center py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            Demo Inspector Login
          </button>
        </form>
      </div>

      {/* Footer Notice */}
      <div className="mt-6 text-center max-w-md relative z-10">
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Authorized use only. All metrological verdicts are governed by deterministic
          rule-based algorithms conforming to National Legal Metrology directives and OIML R-76.
        </p>
      </div>
    </div>
  );
};
