import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  KeyRound, 
  Sparkles, 
  AlertCircle,
  Clock,
  Fingerprint
} from 'lucide-react';

export const LoginGate: React.FC = () => {
  const { login, securitySettings } = useApp();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter your master password or PIN');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    setTimeout(() => {
      const success = login(password, rememberDevice);
      if (!success) {
        setErrorMsg('Incorrect Master Password. Please try again.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
      setIsSubmitting(false);
    }, 200);
  };

  const handleQuickDemoUnlock = () => {
    login(securitySettings.masterPassword, rememberDevice);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-theme-bg relative overflow-hidden">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className={`w-full max-w-md bg-theme-card border border-theme-border rounded-3xl p-8 shadow-2xl space-y-6 relative z-10 backdrop-blur-xl transition-all ${
        isShaking ? 'animate-bounce' : 'animate-fade-in'
      }`}>
        
        {/* App Logo & Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25">
            <Lock className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-theme-text font-openSans tracking-tight">
              OPTIMUSTIME
            </h1>
            <p className="text-xs text-theme-muted font-mono uppercase tracking-widest pt-0.5">
              Secure System Authentication
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 py-1 px-3 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold w-fit mx-auto">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          <span>Protected by Master PIN / Password</span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-theme-text flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                Master Access Key / Password:
              </span>
              <span className="text-[11px] font-normal text-theme-muted">
                User: {securitySettings.username}
              </span>
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoFocus
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter password (default: admin)"
                className="w-full pl-4 pr-11 py-3 rounded-xl border border-theme-border bg-theme-bg text-theme-text text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono placeholder:font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-text transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Remember Device & Security Preferences */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-theme-muted hover:text-theme-text transition-colors">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded border-theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Remember on this browser</span>
            </label>

            {securitySettings.autoLockMinutes > 0 && (
              <span className="text-[11px] text-theme-muted flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                Auto-lock: {securitySettings.autoLockMinutes}m
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-98 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Unlock OptimusTime'}</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </form>

        {/* Quick Demo / First-Time Hint Box */}
        <div className="p-3.5 rounded-2xl bg-theme-card-hover/60 border border-theme-border text-center space-y-1.5">
          <div className="text-[11px] font-bold text-theme-muted flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Default Master Password:</span>
            <code className="px-1.5 py-0.5 rounded bg-theme-card border border-theme-border text-blue-600 dark:text-blue-400 font-mono font-bold text-xs">
              admin
            </code>
          </div>
          <p className="text-[10px] text-theme-muted">
            You can change this password anytime in <strong>Admin Settings → Security Tab</strong>.
          </p>
        </div>

      </div>
    </div>
  );
};
