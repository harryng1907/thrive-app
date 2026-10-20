import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { Connection, Me } from '../types';
import { yearLabel } from '../lib/format';
import { INTERESTS } from '../lib/catalog';
import { AvatarPhoto } from '../components/AvatarPhoto';

interface ProfileScreenProps {
  me: Me | null;
  busy: boolean;
  onResetDemo: () => void;
  onOpenMetrics: () => void;
  onEditProfile: () => void;
  connections: Connection[];
  onInvite: (c: Connection) => void;
  onToggleRealOnly: (value: boolean) => void;
  onDeleteAccount: () => void;
  onChangePhoto: () => void;
  onAddFriend: (code: string) => Promise<string>;
  onSignOut: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hour = (h: number) => (h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`);
const GROUP_PREF = { one: 'Just one person', small: 'A small group (3–4)', any: 'Either is fine' };

// Only you can see this page. Squad-mates see your name, degree and status line after a squad confirms.
const FriendCode: React.FC<{ code: string; busy: boolean; onAdd: (code: string) => Promise<string> }> = ({
  code,
  busy,
  onAdd,
}) => {
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const submit = async () => {
    try {
      const name = await onAdd(value);
      setMsg({ ok: true, text: `${name} added — find them in Your people` });
      setValue('');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not add friend' });
    }
  };
  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Add friends</Text>
        <Ionicons name="person-add" size={18} color={THEME.colors.deepTeal} />
      </View>
      <View style={styles.codeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.codeLabel}>YOUR CODE</Text>
          <Text style={styles.codeValue}>{code}</Text>
        </View>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => {
            try {
              (globalThis as any).navigator?.clipboard?.writeText(code);
            } catch {}
            setCopied(true);
          }}
          accessibilityLabel="Copy your friend code"
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={THEME.colors.deepTeal} />
          <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.codeInput}
          placeholder="Friend's code"
          placeholderTextColor={THEME.colors.textMuted}
          value={value}
          onChangeText={(t) => setValue(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          onSubmitEditing={() => value.length === 6 && submit()}
        />
        <TouchableOpacity
          style={[styles.addBtn, (value.length !== 6 || busy) && { opacity: 0.4 }]}
          disabled={value.length !== 6 || busy}
          onPress={submit}
          accessibilityLabel="Add friend"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>
      {msg && <Text style={[styles.codeMsg, { color: msg.ok ? THEME.colors.successGreen : '#DC2626' }]}>{msg.text}</Text>}
      <Text style={styles.codeHint}>Only people you give your code to can add you. Nobody can search for you.</Text>
    </View>
  );
};

const DeleteAccount: React.FC<{ busy: boolean; onConfirm: () => void }> = ({ busy, onConfirm }) => {
  const [armed, setArmed] = useState(false);
  return (
    <View style={styles.dangerBox}>
      {armed ? (
        <>
          <Text style={styles.dangerText}>
            This permanently deletes your profile, squads, ratings and chats. It can't be undone.
          </Text>
          <View style={styles.dangerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setArmed(false)} disabled={busy}>
              <Text style={styles.cancelText}>Keep it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onConfirm} disabled={busy}>
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={styles.deleteText}>Delete forever</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity style={styles.deleteLink} onPress={() => setArmed(true)} accessibilityLabel="Delete account">
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={styles.deleteLinkText}>Delete my account</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  me,
  busy,
  onResetDemo,
  onOpenMetrics,
  onEditProfile,
  connections,
  onInvite,
  onToggleRealOnly,
  onDeleteAccount,
  onChangePhoto,
  onAddFriend,
  onSignOut,
}) => {
  if (!me) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={THEME.colors.primaryOrange} />
      </View>
    );
  }

  const isDemo = me.is_guest || me.email.endsWith('@pool.demo');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.profileHeaderRow}>
          <View style={[styles.avatarBig, { backgroundColor: me.avatar_color }]}>
            <Text style={styles.avatarBigText}>{me.initials}</Text>
            <AvatarPhoto url={me.avatar_url} />
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileNameBox}>
            <View style={styles.nameRow}>
              <Text style={styles.studentName}>{me.full_name ?? me.name}</Text>
              <View style={styles.unswTag}>
                <Text style={styles.unswTagText}>Uni</Text>
              </View>
            </View>
            <Text style={styles.degreeText}>
              {me.degree} ({yearLabel(me.year)} Year)
            </Text>
            <Text style={styles.zidText}>{me.is_guest ? 'Guest · demo account' : me.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{me.stats.squads_done}</Text>
            <Text style={styles.statLabel}>Sessions Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{me.stats.people_met}</Text>
            <Text style={styles.statLabel}>People Met</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{me.stats.hours} hrs</Text>
            <Text style={styles.statLabel}>Together</Text>
          </View>
        </View>
      </View>

      {/* Who can end up in your squads */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={[styles.prefIconBox, me.real_only && { backgroundColor: THEME.colors.successGreenLight }]}>
            <Ionicons
              name={me.real_only ? 'people' : 'hardware-chip-outline'}
              size={18}
              color={me.real_only ? THEME.colors.successGreen : THEME.colors.deepTeal}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Real people only</Text>
            <Text style={styles.toggleSub}>
              {me.real_only
                ? 'Only real students join your squads. Test with friends!'
                : '30 simulated students fill squads instantly (demo mode).'}
            </Text>
          </View>
          <Switch
            value={me.real_only}
            onValueChange={onToggleRealOnly}
            disabled={busy}
            trackColor={{ false: '#D1D5DB', true: THEME.colors.successGreen }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Real people only"
          />
        </View>
      </View>

      {/* Add friends by code — no search, no browsing. */}
      <FriendCode code={me.friend_code} busy={busy} onAdd={onAddFriend} />

      {/* Your people: you met, and you BOTH said you'd go again. No friend requests. */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Your people</Text>
          <View style={styles.countBubble}>
            <Ionicons name="heart" size={12} color={THEME.colors.primaryOrange} />
            <Text style={styles.countBubbleText}>{connections.length}</Text>
          </View>
        </View>
        {connections.length === 0 ? (
          <View style={styles.peopleEmpty}>
            <Ionicons name="people-circle-outline" size={34} color={THEME.colors.textMuted} />
            <Text style={styles.peopleEmptyText}>
              Do a session, rate 4★+. If they rate you 4★+ too, they show up here.
            </Text>
          </View>
        ) : (
          connections.map((c) => (
            <View key={c.id} style={styles.personRow}>
              <View style={[styles.personAvatar, { backgroundColor: c.avatar_color }]}>
                <Text style={styles.personInitials}>{c.initials}</Text>
                <AvatarPhoto url={c.avatar_url} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>
                  {c.name} <Text style={styles.personMeta}>· {c.degree_short} · {yearLabel(c.year)} yr</Text>
                </Text>
                <View style={styles.personSubRow}>
                  <Ionicons name="repeat" size={12} color={THEME.colors.textMuted} />
                  <Text style={styles.personSub} numberOfLines={1}>
                    {c.sessions_together > 0
                      ? `${c.sessions_together}× · ${c.last_activity}`
                      : 'Friend · added with code'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.inviteBtn, busy && { opacity: 0.5 }]}
                onPress={() => onInvite(c)}
                disabled={busy}
                accessibilityLabel={`Invite ${c.name} to a new session`}
              >
                <Ionicons name="calendar" size={14} color="#FFFFFF" />
                <Text style={styles.inviteText}>Invite</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {me.interests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My vibe</Text>
          <View style={styles.interestWrap}>
            {me.interests.map((tag) => {
              const it = INTERESTS.find((i) => i.tag === tag);
              return (
                <View key={tag} style={styles.interestChip}>
                  <Ionicons name={it?.icon ?? 'sparkles'} size={14} color={THEME.colors.primaryOrange} />
                  <Text style={styles.interestText}>{it?.label ?? tag}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>What the matcher knows</Text>
          <TouchableOpacity style={styles.editBtn} onPress={onEditProfile} accessibilityLabel="Edit profile">
            <Ionicons name="pencil" size={14} color={THEME.colors.deepTeal} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.prefItem}>
          <View style={styles.prefIconBox}>
            <Ionicons name="book-outline" size={18} color={THEME.colors.deepTeal} />
          </View>
          <View style={styles.prefContent}>
            <Text style={styles.prefLabel}>COURSES</Text>
            <Text style={styles.prefValue}>{me.courses.join(', ') || '—'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.prefItem}>
          <View style={styles.prefIconBox}>
            <Ionicons name="time-outline" size={18} color={THEME.colors.deepTeal} />
          </View>
          <View style={styles.prefContent}>
            <Text style={styles.prefLabel}>FREE TIMES</Text>
            <Text style={styles.prefValue}>
              {me.availability.map((a) => `${DAYS[a.dow]} ${hour(a.start)}–${hour(a.end)}`).join(' · ') || '—'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.prefItem}>
          <View style={styles.prefIconBox}>
            <Ionicons name="people-outline" size={18} color={THEME.colors.deepTeal} />
          </View>
          <View style={styles.prefContent}>
            <Text style={styles.prefLabel}>SQUAD SIZE</Text>
            <Text style={styles.prefValue}>{GROUP_PREF[me.group_pref]}</Text>
          </View>
        </View>

        {me.vibe && (
          <>
            <View style={styles.divider} />
            <View style={styles.prefItem}>
              <View style={styles.prefIconBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={THEME.colors.deepTeal} />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>IN YOUR WORDS</Text>
                <Text style={styles.prefValue}>"{me.vibe}"</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.divider} />
        <View style={styles.prefItem}>
          <View style={styles.prefIconBox}>
            <Ionicons name="lock-closed-outline" size={18} color={THEME.colors.deepTeal} />
          </View>
          <View style={styles.prefContent}>
            <Text style={styles.prefLabel}>WHO CAN SEE THIS</Text>
            <Text style={styles.prefValue}>Only you. Squad-mates see your name and degree after a squad confirms.</Text>
          </View>
        </View>
      </View>

      <View style={styles.demoCard}>
        <View style={styles.demoCardHeader}>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>{isDemo ? 'DEMO CONTROLS' : 'APP'}</Text>
          </View>
          <Image
            source={require('../../assets/logo_dark.png')}
            style={styles.demoLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.shortcutButtons}>
          <TouchableOpacity style={styles.shortcutBtn} onPress={onOpenMetrics} activeOpacity={0.7}>
            <Ionicons name="stats-chart" size={16} color={THEME.colors.deepTeal} />
            <Text style={styles.shortcutBtnText}>Metrics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutBtn} onPress={onSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={16} color={THEME.colors.primaryOrange} />
            <Text style={styles.shortcutBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {isDemo && (
          <TouchableOpacity
            style={[styles.resetFullBtn, busy && { opacity: 0.6 }]}
            onPress={onResetDemo}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Ionicons name="reload" size={16} color="#FFFFFF" />
            <Text style={styles.resetFullBtnText}>Reset my swipes & squads</Text>
          </TouchableOpacity>
        )}
      </View>
      {!isDemo || me.is_guest ? <DeleteAccount busy={busy} onConfirm={onDeleteAccount} /> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: THEME.radii.card,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 18,
    ...THEME.shadows.card,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  avatarBig: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...THEME.shadows.buttonOrange,
  },
  avatarBigText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: THEME.colors.deepTeal,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileNameBox: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  unswTag: {
    backgroundColor: THEME.colors.unswYellow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unswTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.darkNavy,
  },
  degreeText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  zidText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F9F9F8',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.darkNavy,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.border,
  },
  card: {
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: THEME.radii.card,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 18,
    ...THEME.shadows.card,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 16,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.colors.deepTealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefContent: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prefValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: 12,
  },
  demoCard: {
    backgroundColor: '#0E1726',
    borderRadius: THEME.radii.card,
    padding: 20,
    marginBottom: 16,
  },
  demoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  demoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E3173E',
    letterSpacing: 0.8,
  },
  demoLogo: {
    width: 26,
    height: 26,
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  demoSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 14,
    lineHeight: 17,
  },
  shortcutButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shortcutBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resetFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primaryOrange,
    paddingVertical: 12,
    borderRadius: THEME.radii.pill,
  },
  resetFullBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  interestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.primaryOrangeLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.tag,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.deepTealLight,
  },
  editText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  countBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.primaryOrangeLight,
  },
  countBubbleText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primaryOrange,
  },
  peopleEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peopleEmptyText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  personName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  personMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  personSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  personSub: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.deepTeal,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  toggleSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  dangerBox: {
    marginTop: 4,
    marginBottom: 24,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  dangerText: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  dangerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.grayButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.grayButtonText,
  },
  deleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: THEME.radii.pill,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cameraBtn: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.deepTeal,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.deepTealLight,
    borderRadius: 14,
    padding: 12,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: THEME.colors.textMuted,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    color: THEME.colors.deepTealDark,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.cardWhite,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  codeInput: {
    flex: 1,
    minWidth: 0,
    width: 0,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    color: THEME.colors.textPrimary,
    backgroundColor: '#FAFAF8',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: THEME.colors.primaryOrange,
  },
  addText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  codeMsg: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  codeHint: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 8,
  },
});
