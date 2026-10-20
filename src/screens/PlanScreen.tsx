import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { PlanOption, PlanTarget } from '../types';
import { getPlanOptions } from '../lib/api';
import { formatDate, formatDuration, formatWhen } from '../lib/format';

type IconName = keyof typeof Ionicons.glyphMap;

const PLACE: Record<PlanOption['category'], { label: string; icon: IconName }> = {
  quiet: { label: 'Quiet study spot', icon: 'library' },
  social: { label: 'Social spot', icon: 'people' },
  active: { label: 'Sports centre', icon: 'football' },
  maker: { label: 'Makerspace', icon: 'construct' },
  food: { label: 'Campus café', icon: 'cafe' },
};

interface PlanScreenProps {
  target: PlanTarget;
  busy: boolean;
  onPick: (option: PlanOption) => void;
  onCreateOwn: () => void;
}

// "Plan something with Mei": a few options with times you're all free, not just a repeat.
export const PlanScreen: React.FC<PlanScreenProps> = ({ target, busy, onPick, onCreateOwn }) => {
  const [options, setOptions] = useState<PlanOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlanOptions(target.userIds, target.rebookOf)
      .then(setOptions)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load options'));
  }, [target]);

  const who = target.names.join(' & ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="repeat" size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Plan something with {who}</Text>
          <Text style={styles.sub}>Pick one — every time below works for all of you.</Text>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!options && !error && <ActivityIndicator color={THEME.colors.primaryOrange} style={{ marginTop: 40 }} />}
      {options && options.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="calendar-clear-outline" size={36} color={THEME.colors.textMuted} />
          <Text style={styles.emptyText}>No shared free time this week. Try adding more free times in your profile.</Text>
        </View>
      )}

      {options?.map((o, i) => (
        <TouchableOpacity
          key={o.activity_id}
          style={[styles.card, i === 0 && styles.cardFirst, busy && { opacity: 0.6 }]}
          onPress={() => onPick(o)}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityLabel={`Plan ${o.title}`}
        >
          <View style={styles.cardTop}>
            <View style={styles.iconBox}>
              <Ionicons name={o.icon as IconName} size={24} color={THEME.colors.primaryOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.reasonPill}>
                <Ionicons
                  name={o.reason === 'Same as last time' ? 'repeat' : 'sparkles'}
                  size={11}
                  color={THEME.colors.deepTeal}
                />
                <Text style={styles.reasonText}>{o.reason}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{o.title}</Text>
              {o.host && <Text style={styles.host}>🎈 {o.host}</Text>}
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <Ionicons name="calendar-outline" size={14} color={THEME.colors.primaryOrange} />
              <Text style={styles.metaText}>{formatDate(o.starts_at)} · {formatWhen(o.starts_at).split(' ').slice(1).join(' ')}</Text>
            </View>
            <View style={styles.meta}>
              <Ionicons name={PLACE[o.category].icon} size={14} color={THEME.colors.deepTeal} />
              <Text style={styles.metaText}>{PLACE[o.category].label}</Text>
            </View>
            <View style={styles.meta}>
              <Ionicons name="time-outline" size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.metaText}>{formatDuration(o.duration_mins)}</Text>
            </View>
          </View>
          <View style={styles.pickRow}>
            <Text style={styles.pickText}>Pick this</Text>
            <Ionicons name="arrow-forward" size={16} color={THEME.colors.primaryOrange} />
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.own} onPress={onCreateOwn} activeOpacity={0.85} accessibilityLabel="Create your own plan">
        <View style={styles.ownIcon}>
          <Ionicons name="create" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownTitle}>Create your own</Text>
          <Text style={styles.ownSub}>Your idea, just for {who} — we'll find the time and place</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={THEME.colors.primaryOrange} />
      </TouchableOpacity>

      <Text style={styles.note}>They still get to say yes or no — nobody is booked without agreeing.</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  content: { padding: 20, paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.colors.deepTeal,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 21, fontWeight: '800', color: THEME.colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: THEME.colors.cardWhite, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.colors.border, ...THEME.shadows.card,
  },
  cardFirst: { borderColor: '#CFF2BD', borderWidth: 2 },
  cardTop: { flexDirection: 'row', gap: 12 },
  iconBox: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: THEME.colors.primaryOrangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  reasonPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: THEME.colors.deepTealLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: THEME.radii.tag, marginBottom: 4,
  },
  reasonText: { fontSize: 11, fontWeight: '800', color: THEME.colors.deepTeal },
  cardTitle: { fontSize: 16, fontWeight: '800', color: THEME.colors.textPrimary },
  host: { fontSize: 12, color: '#7C3AED', fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: THEME.colors.textSecondary },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.colors.borderLight,
  },
  pickText: { fontSize: 14, fontWeight: '800', color: THEME.colors.primaryOrange },
  empty: { alignItems: 'center', gap: 10, marginTop: 30 },
  emptyText: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  note: { fontSize: 12, color: THEME.colors.textMuted, textAlign: 'center', marginTop: 8 },
  error: { color: '#DC2626', marginTop: 16 },
  own: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, marginBottom: 12,
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#8EEA5E', backgroundColor: THEME.colors.primaryOrangeLight,
  },
  ownIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.colors.primaryOrange,
    alignItems: 'center', justifyContent: 'center',
  },
  ownTitle: { fontSize: 16, fontWeight: '800', color: THEME.colors.textPrimary },
  ownSub: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 },
});
