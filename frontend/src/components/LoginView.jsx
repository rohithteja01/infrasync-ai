import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2, UserPlus, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function LoginView({ onLoginSuccess, initialNotice }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'success'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [noticeMsg, setNoticeMsg] = useState(initialNotice || null);
  const [successMsg, setSuccessMsg] = useState(null);

  React.useEffect(() => {
    if (initialNotice) {
      setNoticeMsg(initialNotice);
    }
  }, [initialNotice]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setNoticeMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials') || error.message.toLowerCase().includes('invalid credentials')) {
          setErrorMsg('Invalid email or password. Please verify your credentials.');
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMsg('Email address has not been confirmed yet. Please verify your email.');
        } else {
          setErrorMsg(error.message || 'Authentication failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data && data.session) {
        if (onLoginSuccess) {
          onLoginSuccess(data.session);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already in use')) {
          setErrorMsg('An account with this email address already exists. Please sign in instead.');
        } else {
          setErrorMsg(error.message || 'Registration failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Check for existing user returned with empty identity array
      if (data?.user?.identities && data.user.identities.length === 0) {
        setErrorMsg('An account with this email address already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      // Successful registration: show confirmation state
      setSuccessMsg('Account created. Please check your email to confirm your account.');
      setMode('success');
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const switchToSignUp = () => {
    setMode('signup');
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  const switchToSignIn = () => {
    setMode('signin');
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 select-none">
      {/* Top Branding Section */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-base shadow-sm mx-auto mb-3">
          IA
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Infrasync AI
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Infrastructure Planning-to-Execution Platform
        </p>
        <div className="mt-2 inline-flex items-center space-x-1.5 text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>v1.0.0-final • Protected Workspace</span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
          
          {/* =========================================================================
              VIEW 1: SIGN IN
             ========================================================================= */}
          {mode === 'signin' && (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-900">
                  Sign In to Project Controls
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your authorized credentials to access project intelligence.
                </p>
              </div>

              {noticeMsg && !errorMsg && (
                <div
                  id="login-notice-alert"
                  className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start space-x-2.5"
                  role="status"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">
                    {noticeMsg}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div
                  id="login-error-alert"
                  className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2.5"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">
                    {errorMsg}
                  </div>
                </div>
              )}

              <form onSubmit={handleSignIn} noValidate className="space-y-4">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="infrasync-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="infrasync-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="planner@infrasync.ai"
                      disabled={loading}
                      className="block w-full pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="infrasync-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="infrasync-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={loading}
                      className="block w-full pl-9 pr-10 py-2 text-xs text-slate-900 placeholder-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 transition-colors"
                    />
                    <button
                      type="button"
                      id="toggle-password-visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Button: Sign In */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="infrasync-login-btn"
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Secondary Option: Create New Account */}
                <div className="pt-3 border-t border-slate-100 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Don't have an account?
                  </p>
                  <button
                    type="button"
                    id="create-new-account-btn"
                    onClick={switchToSignUp}
                    disabled={loading}
                    className="w-full py-2 px-4 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors cursor-pointer"
                  >
                    Create New Account
                  </button>
                </div>
              </form>
            </>
          )}

          {/* =========================================================================
              VIEW 2: REGISTRATION / CREATE NEW ACCOUNT
             ========================================================================= */}
          {mode === 'signup' && (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-900">
                  Create Infrastructure Account
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register your engineer email to access project controls.
                </p>
              </div>

              {errorMsg && (
                <div
                  id="signup-error-alert"
                  className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2.5"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">
                    {errorMsg}
                  </div>
                </div>
              )}

              <form onSubmit={handleSignUp} noValidate className="space-y-4">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="engineer@infrasync.ai"
                      disabled={loading}
                      className="block w-full pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      disabled={loading}
                      className="block w-full pl-9 pr-10 py-2 text-xs text-slate-900 placeholder-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 transition-colors"
                    />
                    <button
                      type="button"
                      id="toggle-signup-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      disabled={loading}
                      className="block w-full pl-9 pr-10 py-2 text-xs text-slate-900 placeholder-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 transition-colors"
                    />
                    <button
                      type="button"
                      id="toggle-signup-confirm-password"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Button: Create Account */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="infrasync-create-account-btn"
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Secondary Option: Back to Sign In */}
                <div className="pt-3 border-t border-slate-100 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Already have an account?
                  </p>
                  <button
                    type="button"
                    id="back-to-signin-btn"
                    onClick={switchToSignIn}
                    disabled={loading}
                    className="w-full py-2 px-4 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </>
          )}

          {/* =========================================================================
              VIEW 3: REGISTRATION SUCCESS / CONFIRMATION REQUIRED
             ========================================================================= */}
          {mode === 'success' && (
            <div className="text-center py-2 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Account Created
                </h3>
                <p id="signup-success-message" className="text-xs text-slate-600 mt-2 leading-relaxed bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900">
                  {successMsg || 'Account created. Please check your email to confirm your account.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  After confirming your email, you can sign in to access the Infrasync AI workspace.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  id="success-back-to-signin-btn"
                  onClick={switchToSignIn}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Security Notice */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Protected workspace authenticated via Supabase Auth.</span>
          </div>
        </div>
      </div>
    </div>
  );
}