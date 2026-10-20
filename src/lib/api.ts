// Every call the app makes to the backend lives here.
// Business logic (matching, privacy, scheduling) runs in Postgres — see supabase/schema.sql.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { ActivityCard, ActivityInput, Connection, Me, Message, Metrics, Nudge, PlanOption, ProfileInput, Squad, TimeOption } from '../types';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// --- Auth -------------------------------------------------------------

export const DEMO_ACCOUNTS = [
  { email: 'maya@pool.demo', name: 'Maya', blurb: 'SENG · 1st yr · likes small groups', color: '#F57C2A', initials: 'ML' },
  { email: 'alex@pool.demo', name: 'Alex', blurb: 'CS · 1st yr · prefers one-on-one', color: '#0EA5E9', initials: 'AN' },
  { email: 'sam@pool.demo', name: 'Sam', blurb: 'Commerce/CS · 2nd yr · open to anything', color: '#16A34A', initials: 'SP' },
];
const DEMO_PASSWORD = 'pool-demo-2026';

export async function signInDemo(email: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(error.message);
}

const UNI_EMAIL = /@([a-z0-9-]+\.)+edu\.au$/i;
export const isUnswEmail = (email: string) => UNI_EMAIL.test(email.trim()); // any Australian university (.edu.au)

/** Create an account. Returns true if signed in straight away, false if a confirmation email was sent. */
export class AccountExistsError extends Error {}

export async function signUp(email: string, password: string): Promise<boolean> {
  if (!isUnswEmail(email)) throw new Error('Use your university email (ending in .edu.au)');
  // Already have an account? Don't send another sign-up email — log in instead.
  const { data: exists } = await supabase.rpc('account_exists', { p_email: email.trim() });
  if (exists) throw new AccountExistsError('You already have an account with this email — log in instead.');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' && window.location ? window.location.origin : undefined,
    },
  });
  if (error) throw new Error(error.message.includes('Database error') ? 'Thrive is only open to university emails (.edu.au).' : error.message);
  return !!data.session;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === 'Email not confirmed' ? 'Check your uni inbox and confirm your email first.' : error.message);
}

/**
 * Sign in with the student's UNSW Microsoft 365 account (zID@ad.unsw.edu.au).
 * Supabase's Azure provider is locked to UNSW's tenant, and the database rejects any non-UNSW email.
 * Web: redirects to Microsoft and back. (Native store builds will use an in-app browser later.)
 */
export async function signInWithMicrosoft() {
  // Don't send people to a raw error page if the provider isn't switched on in Supabase yet.
  const settings = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '' },
  })
    .then((r) => r.json())
    .catch(() => null);
  if (settings && !settings.external?.azure) {
    throw new Error("UNSW sign-in isn't switched on yet — use your UNSW email below.");
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid email profile',
      redirectTo: typeof window !== 'undefined' && window.location ? window.location.origin : undefined,
    },
  });
  if (error) throw new Error(error.message);
}

/** If Microsoft sign-in bounced back with an error, turn it into a friendly message (and clean the URL). */
export function takeAuthRedirectError(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''));
  const raw = params.get('error_description') || params.get('error');
  if (!raw) return null;
  window.history.replaceState(null, '', window.location.pathname);
  if (/database error/i.test(raw)) return 'Thrive is only open to university students (.edu.au).';
  if (/provider is not enabled|unsupported provider/i.test(raw)) return 'UNSW sign-in isn\'t switched on yet. Use your UNSW email below.';
  if (/admin|consent|approval/i.test(raw)) return 'UNSW needs to approve Pool for Microsoft sign-in. Use your UNSW email below for now.';
  return `Microsoft sign-in didn't finish: ${raw.replace(/\+/g, ' ')}`;
}

/** A private throwaway account (Supabase anonymous sign-in) — each judge/visitor gets their own. */
export async function signInGuest() {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      /anonymous/i.test(error.message) ? 'Guest mode is switched off right now. Try a demo student below.' : error.message,
    );
  }
}

/** Permanently deletes the signed-in account and everything attached to it. */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  await supabase.auth.signOut({ scope: 'local' }); // this device only
}

export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' }); // this device only
}

// --- Profile ----------------------------------------------------------

export const getMe = () => rpc<Me | null>('get_me');

export const saveProfile = (input: ProfileInput) => rpc<Me>('save_profile', { p: input });

// On the web, shrink big phone photos to a 512px JPEG before uploading.
async function shrinkOnWeb(uri: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = uri;
  });
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(512, side);
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85));
}

/** Pick a photo, upload it (random file name, your own folder), save it on your profile. Null if cancelled. */
export async function pickAndUploadAvatar(): Promise<Me | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const body = Platform.OS === 'web' ? await shrinkOnWeb(asset.uri) : await (await fetch(asset.uri)).arrayBuffer();
  const contentType = Platform.OS === 'web' ? 'image/jpeg' : asset.mimeType ?? 'image/jpeg';
  const path = `${auth.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType });
  if (error) throw new Error(error.message.includes('size') ? 'That photo is too big — try another' : error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return saveProfile({ avatar_url: data.publicUrl });
}

export const removeAvatar = () => saveProfile({ avatar_url: '' });

/** Add a friend with the code they gave you. */
export const addFriend = (code: string) => rpc<{ id: string; name: string }>('add_friend', { p_code: code });

// --- Deck -------------------------------------------------------------

export const getDeck = (limit = 20) => rpc<ActivityCard[]>('get_deck', { p_limit: limit });

/** Records the swipe. On "in", the matcher runs and returns a squad id (or null if no match yet). */
export const swipe = (activityId: string, decision: 'in' | 'pass') =>
  rpc<string | null>('swipe', { p_activity: activityId, p_decision: decision });

// --- Squads -----------------------------------------------------------

export const getMySquads = () => rpc<Squad[]>('get_my_squads');

export const respondToSquad = (squadId: string, accept: boolean) =>
  rpc<string>('respond_squad', { p_squad: squadId, p_accept: accept });

/** Vote to start with whoever has said yes. Returns 'confirmed' once everyone who said yes agrees. */
export const voteGoAhead = (squadId: string) => rpc<string>('vote_go_ahead', { p_squad: squadId });

/** "I'm here" at the session (real attendance). */
export const checkIn = (squadId: string) => rpc<void>('check_in', { p_squad: squadId });

/** Ask Claude (Edge Function) to write the "why you matched" sentence. Returns null if unavailable. */
export async function requestAiReason(squadId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('match-reason', { body: { squad_id: squadId } });
  if (error || !data?.reason) return null;
  return data.reason as string;
}

/** Other times this week, best first (everyone free → most free). */
export const getTimeOptions = (squadId: string) => rpc<TimeOption[]>('squad_time_options', { p_squad: squadId });

/** Move the squad to a new time; everyone else is asked to OK it. Returns the squad status. */
export const proposeTime = (squadId: string, at: string) => rpc<string>('propose_time', { p_squad: squadId, p_at: at });

export const endSession = (squadId: string) => rpc<void>('end_session', { p_squad: squadId });

export const rateSquad = (
  squadId: string,
  scores: { user_id: string; score: number }[],
  venueScore: number | null,
  comment?: string,
) =>
  rpc<void>('rate_squad', {
    p_squad: squadId,
    p_scores: scores,
    p_venue_score: venueScore,
    p_comment: comment ?? null,
  });

export const getNudges = () => rpc<Nudge[]>('get_nudges');

/** Suggest an activity. Returns the new card id and a squad id if one formed straight away. */
export const createActivity = (input: ActivityInput) =>
  rpc<{ activity_id: string; squad_id: string | null }>('create_activity', { p: input });

// --- Plan again with people you've met -----------------------------------

export const getPlanOptions = (userIds: string[], rebookOf: string | null) =>
  rpc<PlanOption[]>('suggest_with', { p_users: userIds, p_rebook_of: rebookOf });

/** Book a picked option. Returns the new squad id (null if the time stopped working). */
export const planWith = (activityId: string, userIds: string[], at: string | null, rebookOf: string | null) =>
  rpc<string | null>('plan_with', { p_activity: activityId, p_users: userIds, p_at: at, p_rebook_of: rebookOf });

// --- Your people --------------------------------------------------------

export const getConnections = () => rpc<Connection[]>('get_connections');

/** New 1-on-1 with a connection. Returns the squad id, or null if you share no free time this week. */
export const inviteConnection = (userId: string) => rpc<string | null>('invite_connection', { p_user: userId });

// --- Chat & safety ----------------------------------------------------

export const getMessages = (squadId: string, after = 0) =>
  rpc<Message[]>('get_messages', { p_squad: squadId, p_after: after });

export const sendMessage = (squadId: string, body: string) =>
  rpc<void>('send_message', { p_squad: squadId, p_body: body });

export const reportMember = (squadId: string, userId: string, reason: string) =>
  rpc<void>('report_member', { p_squad: squadId, p_user: userId, p_reason: reason });

/** Re-match with the people you rated 4★+ in a past squad. Returns the new squad id, or null if no shared time. */
export const rebook = (squadId: string) => rpc<string | null>('rebook', { p_squad: squadId });

// --- Metrics / demo ---------------------------------------------------

export const getMetrics = (includeSeed = false) =>
  rpc<Metrics>('get_metrics', { p_include_seed: includeSeed });

export const resetMyDemo = () => rpc<void>('reset_my_demo');

export async function logEvent(name: string, props?: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('app_events').insert({ user_id: data.user.id, name, props: props ?? null });
}
