/**
 * Firebase cloud sync (optional, bring-your-own-project).
 *
 * Local-first: nothing here is required for the app to work. If the user pastes
 * their own Firebase web config and signs in with email + password, their whole
 * progress blob is mirrored to a single Firestore document (`users/{uid}`).
 *
 * The web config (apiKey, projectId, …) is NOT a secret — for a Firebase web app
 * it ships in the client by design; access is gated by Firestore security rules
 * (see FIREBASE_SETUP.md), not by hiding the config.
 */

import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

export interface SyncPayload {
  attempts: unknown;
  mistakes: unknown;
  srs: unknown;
  streak: unknown;
  customQuestions: unknown;
  settings: unknown;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const CONFIG_KEY = 'faq_firebase_config';
const DISCONNECTED = '__disconnected__';

/**
 * Built-in project so the app works out of the box on this deployment.
 * A Firebase web config is not a secret — it ships in every Firebase web app by
 * design; access is gated by Firestore security rules, not by hiding this.
 * A user can still override it (Settings → Cloud Sync → Change config) or opt
 * out entirely (Disconnect).
 */
export const DEFAULT_CONFIG: FirebaseConfig = {
  apiKey: 'AIzaSyBYXR5IQyA9NJBYWoSvhhzK9PnirzLxhug',
  authDomain: 'acca-fa-quiz.firebaseapp.com',
  projectId: 'acca-fa-quiz',
  storageBucket: 'acca-fa-quiz.firebasestorage.app',
  messagingSenderId: '160911601575',
  appId: '1:160911601575:web:cf8afa051fcb964bde5082',
};

/** Convenience default shown in the sign-in form (the account this app's owner uses). */
export const DEFAULT_EMAIL = 'dark@dark.fazo';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/** Minimal shape check on a pasted config. */
export function isValidConfig(c: unknown): c is FirebaseConfig {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.apiKey === 'string' &&
    o.apiKey.length > 10 &&
    typeof o.authDomain === 'string' &&
    typeof o.projectId === 'string' &&
    o.projectId.length > 0 &&
    typeof o.appId === 'string'
  );
}

/**
 * Parse a pasted config. Accepts either raw JSON or the
 * `const firebaseConfig = { … };` snippet the Firebase console shows.
 */
export function parseConfig(text: string): FirebaseConfig {
  const trimmed = text.trim();
  let jsonish = trimmed;

  const brace = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (brace !== -1 && end !== -1) jsonish = trimmed.slice(brace, end + 1);

  // Tolerate JS object literal syntax (unquoted keys, single quotes, trailing commas).
  const normalised = jsonish
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalised);
  } catch {
    throw new Error('Could not read that config. Paste the firebaseConfig object from the Firebase console.');
  }
  if (!isValidConfig(parsed)) {
    throw new Error('That config is missing required fields (apiKey, authDomain, projectId, appId).');
  }
  return {
    apiKey: parsed.apiKey,
    authDomain: parsed.authDomain,
    projectId: parsed.projectId,
    appId: parsed.appId,
    storageBucket: parsed.storageBucket,
    messagingSenderId: parsed.messagingSenderId,
  };
}

export function getStoredConfig(): FirebaseConfig | null {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw === DISCONNECTED) return null; // user explicitly opted out
    if (!raw) return DEFAULT_CONFIG; // nothing saved → use the built-in project
    const parsed = JSON.parse(raw);
    return isValidConfig(parsed) ? parsed : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function isConfigured(): boolean {
  return getStoredConfig() !== null;
}

function teardown() {
  const existing = getApps();
  for (const a of existing) {
    try {
      deleteApp(a);
    } catch {
      /* ignore */
    }
  }
  app = null;
  auth = null;
  db = null;
}

/** Initialise (or re-initialise) the Firebase app from a stored/passed config. */
export function initFirebase(config?: FirebaseConfig): boolean {
  if (typeof window === 'undefined') return false;
  const cfg = config ?? getStoredConfig();
  if (!cfg) return false;

  if (app) {
    if (app.options.projectId === cfg.projectId && app.options.apiKey === cfg.apiKey) return true;
    teardown();
  }

  try {
    app = getApps()[0] ?? initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
    void setPersistence(auth, browserLocalPersistence);
    return true;
  } catch {
    teardown();
    return false;
  }
}

/** Persist a config and (re)initialise. */
export function saveConfig(config: FirebaseConfig): boolean {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    return false;
  }
  teardown();
  return initFirebase(config);
}

export function clearConfig(): void {
  try {
    localStorage.setItem(CONFIG_KEY, DISCONNECTED);
  } catch {
    /* ignore */
  }
  teardown();
}

function ensureReady(): { auth: Auth; db: Firestore } {
  if (!auth || !db) {
    if (!initFirebase() || !auth || !db) {
      throw new Error('Firebase is not configured. Paste your web config first.');
    }
  }
  return { auth, db };
}

// ============================= Auth =============================

export function currentUser(): User | null {
  return auth?.currentUser ?? null;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!auth) {
    if (!initFirebase() || !auth) {
      cb(null);
      return () => {};
    }
  }
  return onAuthStateChanged(auth, cb);
}

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/missing-password':
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists — sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/network-request-failed':
      return 'Network error reaching Firebase.';
    case 'auth/operation-not-allowed':
      return 'Enable Email/Password sign-in in the Firebase console (Authentication → Sign-in method).';
    default:
      return (e as Error)?.message || 'Authentication failed.';
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const { auth } = ensureReady();
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (e) {
    throw new Error(friendlyAuthError(e));
  }
}

export async function signUp(email: string, password: string): Promise<User> {
  const { auth } = ensureReady();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (e) {
    throw new Error(friendlyAuthError(e));
  }
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

// ============================= Firestore blob sync =============================

function stateDoc(uid: string) {
  const { db } = ensureReady();
  return doc(db, 'users', uid);
}

/** Push the whole local state to Firestore (last-write-wins). */
export async function pushState(payload: SyncPayload): Promise<void> {
  const user = currentUser();
  if (!user) throw new Error('Sign in first.');
  // Strip undefined — Firestore rejects it.
  const clean = JSON.parse(JSON.stringify(payload));
  await setDoc(stateDoc(user.uid), { state: clean, updatedAt: serverTimestamp() }, { merge: true });
}

/** Pull the whole state for the signed-in user. Returns null if nothing saved yet. */
export async function pullState(): Promise<{ payload: Partial<SyncPayload>; updatedAt: string | null } | null> {
  const user = currentUser();
  if (!user) throw new Error('Sign in first.');
  const snap = await getDoc(stateDoc(user.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const ts = data?.updatedAt;
  const updatedAt =
    ts && typeof ts.toDate === 'function' ? (ts.toDate() as Date).toISOString() : null;
  return { payload: (data?.state ?? {}) as Partial<SyncPayload>, updatedAt };
}

// Initialise on module load (client only) so a returning user is auto-signed-in.
if (typeof window !== 'undefined') {
  initFirebase();
}
