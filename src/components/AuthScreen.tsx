import React, { useState } from 'react';
import { api } from '../lib/api.ts';
import { sendFirebaseReset, signInWithFirebaseEmail } from '../lib/firebase.ts';
import { isSupabaseClientConfigured, signInWithSupabasePassword } from '../lib/supabase.ts';
import type { AuthSessionResponse } from '../types/workspace.ts';

interface AuthScreenProps {
  slotsUsed: number;
  maxSlots: number;
  providers: {
    firebase: boolean;
    supabase: boolean;
  };
  sessionNotice?: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAuthenticated: (session: AuthSessionResponse) => void;
}

function generateInitialKeyfile(email: string): { filename: string; keyData: Record<string, unknown> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const keyIdBytes = new Uint8Array(4);
  crypto.getRandomValues(keyIdBytes);
  const keyId = `trv-key-${Array.from(keyIdBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  const slug = email.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  return {
    filename: `${slug}-key.json`,
    keyData: {
      product: 'truvornex',
      keyId,
      email: email.trim().toLowerCase(),
      issuedAt: new Date().toISOString(),
      secret,
    },
  };
}

export function AuthScreen({
  providers,
  sessionNotice,
  theme,
  onToggleTheme,
  onAuthenticated,
}: AuthScreenProps) {
  const [stage, setStage] = useState<'login' | 'keyfile'>('login');
  const [authAction, setAuthAction] = useState<'signin' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteToken, setInviteToken] = useState('');

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [keyfileConfigured, setKeyfileConfigured] = useState(true);
  const [keyFileName, setKeyFileName] = useState('');
  const [parsedKeyData, setParsedKeyData] = useState<unknown>(null);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabaseReady = isSupabaseClientConfigured && providers.supabase;

  function handleSessionStep(session: AuthSessionResponse, activeEmail: string) {
    if (session.authenticated && session.token) {
      onAuthenticated(session);
      return;
    }
    if (session.keyfileRequired && session.pendingToken) {
      setPendingToken(session.pendingToken);
      setPendingEmail(session.user?.email || activeEmail.trim().toLowerCase());
      setKeyfileConfigured(session.keyfileConfigured !== false);
      setParsedKeyData(null);
      setKeyFileName('');
      setError(null);
      setInfo(null);
      setStage('keyfile');
      return;
    }
    throw new Error('Unable to initiate session.');
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (authAction === 'reset') {
        await sendFirebaseReset(email);
        setInfo(`Reset link sent to ${email.trim()}.`);
        setAuthAction('signin');
        return;
      }

      const trimmedCode = inviteToken.trim() || undefined;

      try {
        const { idToken } = await signInWithFirebaseEmail(email, password);
        const session = await api.exchangeAuth({
          provider: 'firebase',
          token: idToken,
          inviteToken: trimmedCode,
        });
        handleSessionStep(session, email);
        return;
      } catch (primaryErr) {
        const msg = primaryErr instanceof Error ? primaryErr.message : '';
        const serverRejected =
          msg.includes('Access restricted') ||
          msg.includes('capacity reached') ||
          msg.includes('suspended') ||
          msg.includes('expired') ||
          msg.includes('Invitation');
        if (!serverRejected && supabaseReady) {
          const { accessToken } = await signInWithSupabasePassword(email, password);
          const session = await api.exchangeAuth({
            provider: 'supabase',
            token: accessToken,
            inviteToken: trimmedCode,
          });
          handleSessionStep(session, email);
          return;
        }
        throw primaryErr;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Login failed.';
      if (raw.includes('auth/') || raw.includes('Invalid login credentials')) {
        setError('Invalid email or password.');
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleKeyFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setInfo(null);
    const file = e.target.files?.[0];
    if (!file) {
      setKeyFileName('');
      setParsedKeyData(null);
      return;
    }
    if (file.size > 64 * 1024) {
      setError('Key file is too large (max 64 KB).');
      setKeyFileName('');
      setParsedKeyData(null);
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Selected file must contain a valid JSON key object.');
        setKeyFileName('');
        setParsedKeyData(null);
        return;
      }
      setKeyFileName(file.name);
      setParsedKeyData(parsed);
    } catch {
      setError('Could not parse .json key file.');
      setKeyFileName('');
      setParsedKeyData(null);
    }
  }

  async function handleKeyfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) {
      setStage('login');
      setError('Session expired. Please log in again.');
      return;
    }
    if (!parsedKeyData) {
      setError('Choose your .json key file first.');
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const verified = await api.verifyKeyfile(pendingToken, parsedKeyData);
      onAuthenticated(verified);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Key file verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInitialKeyfile() {
    if (!pendingToken) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { filename, keyData } = generateInitialKeyfile(pendingEmail || email);
      const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const verified = await api.verifyKeyfile(pendingToken, keyData);
      onAuthenticated(verified);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize key file.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-[#121212] text-black dark:text-[#e5e5e5] font-sans p-5 sm:p-10">
      <div className="max-w-[340px] mx-auto mt-10 sm:mt-16 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-normal">
            {stage === 'keyfile' ? 'Access Key' : authAction === 'reset' ? 'Reset Password' : 'Login'}
          </h1>
          <button
            type="button"
            onClick={onToggleTheme}
            className="text-xs underline text-[#444] dark:text-[#aaa] hover:text-black dark:hover:text-white"
          >
            {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </div>

        <hr className="border-[#cccccc] dark:border-[#333333]" />

        {sessionNotice && !error && stage === 'login' && (
          <p role="status" className="text-xs border border-[#b45309] p-2 bg-[#fffbeb] dark:bg-[#241b08] text-[#92400e] dark:text-[#fcd34d]">
            {sessionNotice}
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs border border-[#b91c1c] p-2 bg-[#fef2f2] dark:bg-[#2a0f0f] text-[#b91c1c] dark:text-[#fca5a5]">
            {error}
          </p>
        )}

        {info && (
          <p className="text-xs border border-[#15803d] p-2 bg-[#f0fdf4] dark:bg-[#0f2416] text-[#15803d] dark:text-[#86efac]">
            {info}
          </p>
        )}

        {stage === 'login' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {authAction === 'reset' && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthAction('signin');
                    setError(null);
                  }}
                  className="text-xs underline text-[#0000ee] dark:text-[#93c5fd]"
                >
                  &larr; Back
                </button>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 px-2 text-base sm:text-sm bg-white dark:bg-[#1a1a1a] text-black dark:text-white border border-[#767676] dark:border-[#555] rounded-none"
              />
            </div>

            {authAction === 'signin' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="auth-pass" className="block text-xs">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-[11px] underline text-[#444] dark:text-[#aaa]"
                  >
                    {showPassword ? 'hide' : 'show'}
                  </button>
                </div>
                <input
                  id="auth-pass"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 px-2 text-base sm:text-sm bg-white dark:bg-[#1a1a1a] text-black dark:text-white border border-[#767676] dark:border-[#555] rounded-none"
                />
              </div>
            )}

            {authAction === 'signin' && showInviteInput && (
              <div>
                <label htmlFor="auth-token" className="block text-xs mb-1">
                  Access code
                </label>
                <input
                  id="auth-token"
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="code"
                  className="w-full h-9 px-2 text-xs font-mono bg-white dark:bg-[#1a1a1a] text-black dark:text-white border border-[#767676] dark:border-[#555] rounded-none"
                />
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-3.5 py-1.5 text-xs bg-[#efefef] hover:bg-[#e2e2e2] dark:bg-[#2a2a2a] dark:hover:bg-[#383838] text-black dark:text-white border border-[#767676] dark:border-[#666] rounded-none disabled:opacity-50"
              >
                {loading ? 'Please wait...' : authAction === 'reset' ? 'Send Reset' : 'Submit'}
              </button>
            </div>

            {authAction === 'signin' && (
              <div className="flex items-center justify-between pt-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthAction('reset');
                    setError(null);
                  }}
                  className="underline text-[#0000ee] dark:text-[#93c5fd]"
                >
                  Forgot password
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteInput((v) => !v)}
                  className="underline text-[#555] dark:text-[#aaa]"
                >
                  {showInviteInput ? 'hide code' : 'access code'}
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleKeyfileSubmit} className="space-y-3">
            <p className="text-xs text-[#333] dark:text-[#bbb]">
              Upload your <code className="font-mono">.json</code> key file to continue.
            </p>

            <div>
              <label htmlFor="auth-keyfile" className="block text-xs mb-1">
                Key file (.json)
              </label>
              <input
                id="auth-keyfile"
                type="file"
                accept=".json,application/json"
                onChange={handleKeyFileSelected}
                className="block w-full text-xs text-black dark:text-[#e5e5e5] file:mr-2.5 file:py-1 file:px-2.5 file:border file:border-[#767676] dark:file:border-[#666] file:bg-[#efefef] dark:file:bg-[#2a2a2a] file:text-xs file:text-black dark:file:text-white file:rounded-none"
              />
              {keyFileName && (
                <p className="mt-1 text-[11px] font-mono text-[#444] dark:text-[#aaa]">
                  Selected: {keyFileName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={loading || !parsedKeyData}
                className="px-3.5 py-1.5 text-xs bg-[#efefef] hover:bg-[#e2e2e2] dark:bg-[#2a2a2a] dark:hover:bg-[#383838] text-black dark:text-white border border-[#767676] dark:border-[#666] rounded-none disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStage('login');
                  setPendingToken(null);
                  setParsedKeyData(null);
                  setKeyFileName('');
                  setError(null);
                  setInfo(null);
                }}
                className="px-3 py-1.5 text-xs bg-white dark:bg-[#1a1a1a] text-black dark:text-white border border-[#767676] dark:border-[#555] rounded-none disabled:opacity-50"
              >
                Back
              </button>
            </div>

            {!keyfileConfigured && (
              <div className="pt-2 text-[11px]">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCreateInitialKeyfile}
                  className="underline text-[#0000ee] dark:text-[#93c5fd]"
                >
                  Generate initial key.json
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
