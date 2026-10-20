import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import {
  AccountExistsError,
  DEMO_ACCOUNTS,
  isUnswEmail,
  signIn,
  signInDemo,
  signInGuest,
  signInWithMicrosoft,
  signUp,
  takeAuthRedirectError,
} from '../lib/api';

// The four-square Microsoft mark, drawn so we don't need an image.
const MicrosoftMark: React.FC = () => (
  <View style={{ width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
    {['#F25022', '#7FBA00', '#00A4EF', '#FFB900'].map((c) => (
      <View key={c} style={{ width: 9, height: 9, backgroundColor: c }} />
    ))}
  </View>
);

type Mode = 'join' | 'login';

// Join / log in with a UNSW email, or jump in as a demo student.
// UNSW-only is enforced again by a database trigger, not just here.
export const LoginScreen: React.FC = () => {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('join');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkInbox, setCheckInbox] = useState(false);
  const [showEmail, setShowEmail] = useState(true);

  // Coming back from Microsoft with an error (e.g. a non-UNSW account)?
  useEffect(() => {
    const message = takeAuthRedirectError();
    if (message) {
      setError(message);
      setShowEmail(true);
    }
  }, []);

  const microsoft = async () => {
    setPending('microsoft');
    setError(null);
    try {
      await signInWithMicrosoft(); // navigates away to Microsoft on success
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start UNSW sign-in');
      setShowEmail(true);
      setPending(null);
    }
  };

  const canSubmit =
    isUnswEmail(email) && password.length >= 8;

  const submit = async () => {
    setPending('form');
    setError(null);
    try {
      if (mode === 'join') {
        const signedIn = await signUp(email, password);
        if (!signedIn) setCheckInbox(true);
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      if (e instanceof AccountExistsError) setMode('login'); // keep the email + password, just switch tabs
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPending(null);
    }
  };

  const guest = async () => {
    setPending('guest');
    setError(null);
    try {
      await signInGuest();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start guest mode');
      setPending(null);
    }
  };

  const demo = async (demoEmail: string) => {
    setPending(demoEmail);
    setError(null);
    try {
      await signInDemo(demoEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
      setPending(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Image source={require('../../assets/logo_dark.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Don’t just survive in uni.</Text>
      <Text style={[styles.title, { color: THEME.colors.successGreen, fontSize: 34, marginTop: -6 }]}>THRIVE in uni.</Text>
      <Text style={styles.tagline}>Belonging first, opportunity follows.</Text>

      <View style={styles.pillsRow}>
        <View style={styles.pill}>
          <Ionicons name="shield-checkmark" size={14} color={THEME.colors.deepTeal} />
          <Text style={styles.pillText}>Uni students only</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="eye-off" size={14} color={THEME.colors.deepTeal} />
          <Text style={styles.pillText}>No browsing</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="people" size={14} color={THEME.colors.deepTeal} />
          <Text style={styles.pillText}>Squads of 2–4</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="location" size={14} color={THEME.colors.deepTeal} />
          <Text style={styles.pillText}>Public spots</Text>
        </View>
      </View>

      {false && Platform.OS === 'web' && !checkInbox && ( /* uni SSO hidden: email + guest only for now */
        <>
          <TouchableOpacity
            style={[styles.msButton, pending !== null && { opacity: 0.6 }]}
            onPress={microsoft}
            disabled={pending !== null}
            activeOpacity={0.85}
            accessibilityLabel="Continue with your UNSW Microsoft account"
          >
            {pending === 'microsoft' ? <ActivityIndicator color={THEME.colors.textPrimary} /> : <MicrosoftMark />}
            <View style={{ flex: 1 }}>
              <Text style={styles.msTitle}>Continue with UNSW</Text>
              <Text style={styles.msSub}>Your zID Microsoft login · no new password</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          {!showEmail && (
            <TouchableOpacity style={styles.emailToggle} onPress={() => setShowEmail(true)}>
              <Ionicons name="mail-outline" size={15} color={THEME.colors.deepTeal} />
              <Text style={styles.emailToggleText}>or use your UNSW email</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {!showEmail && !checkInbox ? null : checkInbox ? (
        <View style={styles.inboxBox}>
          <Ionicons name="mail-unread" size={32} color={THEME.colors.deepTeal} />
          <Text style={styles.inboxTitle}>Check your uni inbox</Text>
          <Text style={styles.inboxSub}>Tap the link we sent to {email.trim()}, then log in.</Text>
          <TouchableOpacity
            onPress={() => {
              setCheckInbox(false);
              setMode('login');
            }}
          >
            <Text style={styles.link}>Go to log in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formCard}>
          <View style={styles.segment}>
            {(['join', 'login'] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.segmentBtn, mode === m && styles.segmentOn]}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                <Ionicons
                  name={m === 'join' ? 'person-add' : 'log-in'}
                  size={16}
                  color={mode === m ? '#FFFFFF' : THEME.colors.textSecondary}
                />
                <Text style={[styles.segmentText, mode === m && { color: '#FFFFFF' }]}>
                  {m === 'join' ? 'Join' : 'Log in'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>


          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="you@student.uni.edu.au"
              placeholderTextColor={THEME.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {email.length > 3 && (
              <Ionicons
                name={isUnswEmail(email) ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isUnswEmail(email) ? THEME.colors.successGreen : '#F59E0B'}
              />
            )}
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Password (8+ characters)"
              placeholderTextColor={THEME.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'join' ? 'new-password' : 'current-password'}
              onSubmitEditing={() => canSubmit && submit()}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!canSubmit || pending !== null) && { opacity: 0.45 }]}
            disabled={!canSubmit || pending !== null}
            onPress={submit}
            activeOpacity={0.85}
          >
            {pending === 'form' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryText}>{mode === 'join' ? 'Create account' : 'Log in'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or just look around</Text>
        <View style={styles.orLine} />
      </View>

      <TouchableOpacity
        style={styles.guestRow}
        onPress={guest}
        disabled={pending !== null}
        activeOpacity={0.85}
        accessibilityLabel="Try Thrive as a guest"
      >
        <View style={styles.guestIcon}>
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.guestTitle}>Try it as a guest</Text>
          <Text style={styles.guestSub}>Your own fresh account · 1 minute setup</Text>
        </View>
        {pending === 'guest' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {DEMO_ACCOUNTS.map((account) => (
        <TouchableOpacity
          key={account.email}
          style={styles.accountRow}
          onPress={() => demo(account.email)}
          disabled={pending !== null}
          activeOpacity={0.8}
        >
          <View style={[styles.avatar, { backgroundColor: account.color }]}>
            <Text style={styles.avatarText}>{account.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountBlurb}>{account.blurb}</Text>
          </View>
          {pending === account.email ? (
            <ActivityIndicator color={THEME.colors.primaryOrange} />
          ) : (
            <Ionicons name="arrow-forward" size={20} color={THEME.colors.textMuted} />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    width: 150,
    height: 48,
    marginBottom: 20,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.deepTeal,
    marginTop: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.deepTealLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.tag,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.deepTeal,
  },
  msButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  msTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  msSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  emailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  emailToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.deepTeal,
  },
  formCard: {
    marginTop: 4,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 24,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.grayButton,
    borderRadius: THEME.radii.pill,
    padding: 4,
    marginBottom: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: THEME.radii.pill,
  },
  segmentOn: {
    backgroundColor: THEME.colors.deepTeal,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAFAF8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  primaryBtn: {
    height: 52,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.primaryOrange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  inboxBox: {
    backgroundColor: THEME.colors.deepTealLight,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  inboxTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.deepTealDark,
  },
  inboxSub: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
    marginTop: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  error: {
    flex: 1,
    color: '#DC2626',
    fontSize: 13,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  orText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.deepTeal,
    borderRadius: 20,
    padding: 12,
    marginBottom: 8,
  },
  guestIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  guestSub: {
    fontSize: 12,
    color: '#FFFFFFCC',
    marginTop: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 20,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  accountBlurb: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
});
