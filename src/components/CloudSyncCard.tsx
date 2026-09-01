/**
 * Cloud Sync (optional) — mirror your progress to your own Firebase project.
 *
 * Local-first: nothing here is required. Paste your Firebase web config, sign in
 * with email + password, and your whole progress blob is stored in one Firestore
 * document that only you can read (see FIREBASE_SETUP.md).
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  Loader2,
  Check,
  LogOut,
  KeyRound,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/Button';
import { useToaster } from '@/components/Toaster';
import {
  parseConfig,
  saveConfig,
  clearConfig,
  getStoredConfig,
  DEFAULT_EMAIL,
  onAuthChange,
  signIn,
  signUp,
  signOutUser,
  pushState,
  pullState,
  currentUser,
} from '@/lib/firebase';
import {
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  syncNow,
} from '@/lib/firebaseSync';
import { gatherLocalState, applyRemoteState } from '@/lib/sync';

export function CloudSyncCard() {
  const toast = useToaster();

  const [config, setConfig] = useState(() => getStoredConfig());
  const [configText, setConfigText] = useState('');
  const [editingConfig, setEditingConfig] = useState(false);

  const [user, setUser] = useState<User | null>(() => currentUser());
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState('');

  const [autoSync, setAutoSync] = useState(() => isAutoSyncEnabled());
  const [busy, setBusy] = useState<null | 'config' | 'in' | 'up' | 'push' | 'pull' | 'out'>(null);

  useEffect(() => onAuthChange(setUser), []);

  const saveTheConfig = () => {
    setBusy('config');
    try {
      const cfg = parseConfig(configText);
      if (!saveConfig(cfg)) throw new Error('Could not initialise Firebase with that config.');
      setConfig(cfg);
      setEditingConfig(false);
      setConfigText('');
      toast.success('Firebase config saved', 'Now sign in with email and password');
    } catch (e) {
      toast.error('Config error', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const removeConfig = () => {
    clearConfig();
    setConfig(null);
    setUser(null);
    setAutoSync(false);
    setAutoSyncEnabled(false);
    toast.info('Firebase disconnected', 'Your local progress is untouched');
  };

  const doAuth = async (mode: 'in' | 'up') => {
    if (!email.trim() || password.length < 6) {
      toast.error('Enter an email and a password of at least 6 characters');
      return;
    }
    setBusy(mode);
    try {
      const u = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
      setUser(u);
      setPassword('');
      toast.success(mode === 'in' ? 'Signed in' : 'Account created');
      // First connect: pull whatever is already in the cloud.
      try {
        const remote = await pullState();
        if (remote) {
          const note = applyRemoteState(remote.payload);
          toast.info('Pulled cloud progress', note);
        } else {
          await pushState(gatherLocalState());
        }
      } catch {
        /* non-fatal — user can push/pull manually */
      }
    } catch (e) {
      toast.error(mode === 'in' ? 'Sign in failed' : 'Sign up failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    setBusy('push');
    try {
      await pushState(gatherLocalState());
      toast.success('Progress pushed to Firebase');
    } catch (e) {
      toast.error('Push failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const pull = async () => {
    setBusy('pull');
    try {
      const remote = await pullState();
      if (!remote) {
        toast.info('Nothing saved in the cloud yet');
      } else {
        toast.success('Progress pulled', applyRemoteState(remote.payload));
      }
    } catch (e) {
      toast.error('Pull failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const doSignOut = async () => {
    setBusy('out');
    try {
      await signOutUser();
      setUser(null);
      setAutoSync(false);
      setAutoSyncEnabled(false);
    } finally {
      setBusy(null);
    }
  };

  const toggleAutoSync = async (next: boolean) => {
    setAutoSync(next);
    setAutoSyncEnabled(next);
    if (next && user) {
      try {
        await syncNow();
        toast.success('Auto-sync on', 'Your progress will be saved to the cloud automatically');
      } catch {
        toast.warning('Auto-sync on', 'First sync will run shortly');
      }
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Cloud className="w-5 h-5 text-[color:rgb(var(--accent))]" />
        Cloud Sync
        {user && <Check className="w-4 h-4 text-[color:rgb(var(--ok))]" />}
      </h2>
      <p className="text-muted mb-4">
        Optional. Sign in to save your progress to the cloud so it survives clearing your browser
        and follows you across devices. Turn on <span className="font-medium">Auto-sync</span> and
        it just works. To use your own Firebase project instead, see{' '}
        <code className="text-xs bg-black/5 dark:bg-white/10 px-1 rounded">FIREBASE_SETUP.md</code>.
      </p>

      {/* Step 1 — config */}
      {(!config || editingConfig) && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Firebase web config
          </label>
          <textarea
            className="input font-mono text-xs"
            rows={7}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder={'{\n  "apiKey": "AIza...",\n  "authDomain": "my-app.firebaseapp.com",\n  "projectId": "my-app",\n  "appId": "1:123:web:abc"\n}'}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={saveTheConfig} disabled={busy !== null || !configText.trim()}>
              {busy === 'config' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save config
            </Button>
            {editingConfig && (
              <Button variant="ghost" onClick={() => { setEditingConfig(false); setConfigText(''); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 2 — sign in */}
      {config && !editingConfig && !user && (
        <div className="space-y-3">
          <div className="text-sm text-muted">
            Project: <span className="font-mono">{config.projectId}</span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="at least 6 characters"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => doAuth('in')} disabled={busy !== null}>
              {busy === 'in' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Sign in
            </Button>
            <Button variant="secondary" onClick={() => doAuth('up')} disabled={busy !== null}>
              {busy === 'up' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create account
            </Button>
            <Button variant="ghost" onClick={() => setEditingConfig(true)} disabled={busy !== null}>
              Change config
            </Button>
          </div>
          <button
            type="button"
            className="text-xs text-[color:rgb(var(--bad))] hover:underline"
            onClick={removeConfig}
          >
            Disconnect Firebase
          </button>
        </div>
      )}

      {/* Step 3 — signed in */}
      {config && !editingConfig && user && (
        <div className="space-y-4">
          <div className="text-sm">
            Signed in as <span className="font-medium">{user.email}</span>
            <span className="text-muted"> · project <span className="font-mono">{config.projectId}</span></span>
          </div>

          <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => toggleAutoSync(e.target.checked)}
              className="w-4 h-4 accent-[color:rgb(var(--accent))]"
            />
            <span>
              <span className="font-medium">Auto-sync</span>
              <span className="text-muted"> — save to the cloud after every quiz and pull on startup</span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={push} disabled={busy !== null}>
              {busy === 'push' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              Push to cloud
            </Button>
            <Button variant="secondary" onClick={pull} disabled={busy !== null}>
              {busy === 'pull' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              Pull from cloud
            </Button>
            <Button variant="ghost" onClick={doSignOut} disabled={busy !== null}>
              {busy === 'out' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
