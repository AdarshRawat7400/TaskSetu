
import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService.ts';

const AuthView: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await firebaseService.signInWithGoogle();
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.message?.includes("Configuration Missing") || err.message?.includes("unauthorized-domain")) {
        setError(`Environment Error: ${err.message}. Please use Guest Mode for now.`);
      } else {
        setError(err.message || "Failed to sign in. Check internet or domain authorization.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsAuthenticating(true);
    try {
      await firebaseService.signInAsGuest();
    } catch (err: any) {
      setError("Guest login failed.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 via-red-500 to-amber-600 p-4 transition-colors">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-10 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-white/20 dark:border-slate-800 transition-all">
        <div className="mb-10">
          <div className="bg-orange-100 dark:bg-orange-900/30 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-14 h-14 text-orange-600 dark:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">TaskSetu <span className="text-orange-600">AI</span></h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-widest text-[10px]">Workplace Intelligence</p>
        </div>

        {error ? (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-[11px] font-bold text-red-600 dark:text-red-400 leading-relaxed text-left">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>AUTH NOTICE</span>
            </div>
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <button
            disabled={isAuthenticating}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-4 px-6 py-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl hover:border-orange-500 dark:hover:border-orange-500 transition-all shadow-xl font-black text-slate-800 dark:text-slate-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isAuthenticating ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
            ) : (
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="Google" />
            )}
            {isAuthenticating ? 'Connecting...' : 'Sign in with Google'}
          </button>


        </div>
      </div>
    </div>
  );
};

export default AuthView;
