import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { ActivityCard } from '../types';
import { INTERESTS } from '../lib/catalog';
import { formatDuration, formatWhen, SQUAD_TYPE_LABEL } from '../lib/format';
import { ActivityCover } from './ActivityCover';

type IconName = keyof typeof Ionicons.glyphMap;

const PLACE: Record<ActivityCard['category'], string> = {
  quiet: 'A quiet study spot on campus',
  social: 'A social spot on campus',
  active: 'Campus sports centre',
  maker: 'The Makerspace',
  food: 'A campus café',
};

interface Props {
  card: ActivityCard | null;
  busy: boolean;
  onClose: () => void;
  onImIn: (card: ActivityCard) => void;
  onNotForMe: (card: ActivityCard) => void;
}

// Tap a card → everything you'd want to know before saying "I'm in".
export const ActivityDetailSheet: React.FC<Props> = ({ card, busy, onClose, onImIn, onNotForMe }) => (
  <Modal visible={!!card} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close details" />
    {card && (
      // Full-width row pinned to the bottom; the sheet sits centred in it at phone width.
      <View style={styles.sheetRow} pointerEvents="box-none">
      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <ActivityCover icon={card.icon} category={card.category} tags={card.tags} height={190} style={styles.cover}>
            <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close details">
              <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </ActivityCover>

          <View style={styles.body}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, card.host ? styles.badgeSociety : null]}>
                <Ionicons
                  name={card.host ? 'balloon' : card.course ? 'school' : card.suggested ? 'person' : 'sparkles'}
                  size={12}
                  color={card.host ? '#7C3AED' : THEME.colors.deepTeal}
                />
                <Text style={[styles.badgeText, card.host ? { color: '#7C3AED' } : null]}>
                  {card.host ?? card.course ?? (card.suggested ? 'Student idea' : SQUAD_TYPE_LABEL[card.squad_type])}
                </Text>
              </View>
              {card.kind === 'session' && (
                <View style={styles.badge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.badgeText}>Real session</Text>
                </View>
              )}
            </View>

            <Text style={styles.title}>{card.title}</Text>
            {card.description && <Text style={styles.desc}>{card.description}</Text>}

            <View style={styles.facts}>
              <Fact
                icon="calendar"
                color={THEME.colors.primaryOrange}
                label={card.starts_at ? formatWhen(card.starts_at) : 'A time your whole squad is free'}
                sub={card.starts_at ? undefined : 'We check everyone\'s free times for you'}
              />
              <Fact
                icon="location"
                color={THEME.colors.deepTeal}
                label={card.venue?.name ?? PLACE[card.category]}
                sub={card.venue?.detail ?? 'Always a public campus venue'}
              />
              <Fact icon="time" color="#6366F1" label={formatDuration(card.duration_mins)} />
              <Fact
                icon="people"
                color="#16A34A"
                label={card.spots_left != null ? `${card.spots_left} of ${card.capacity} spots open` : 'Squad of 2–4'}
                sub={
                  card.interested_count > 0
                    ? `${card.interested_count} student${card.interested_count === 1 ? '' : 's'} already said "I'm in"`
                    : 'Be the first to say yes'
                }
              />
            </View>

            <View style={styles.tags}>
              {card.tags
                .filter((t) => t !== card.course)
                .map((t) => {
                  const it = INTERESTS.find((i) => i.tag === t);
                  return (
                    <View key={t} style={styles.tag}>
                      {it && <Ionicons name={it.icon} size={13} color={THEME.colors.primaryOrange} />}
                      <Text style={styles.tagText}>{it?.label ?? t}</Text>
                    </View>
                  );
                })}
            </View>

            <View style={styles.how}>
              <Ionicons name="shield-checkmark" size={16} color={THEME.colors.deepTeal} />
              <Text style={styles.howText}>
                Say "I'm in" and we'll find 1–3 students who fit. Nobody sees your name until everyone agrees.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.nope, busy && { opacity: 0.5 }]}
            disabled={busy}
            onPress={() => onNotForMe(card)}
            accessibilityLabel="Not for me"
          >
            <Ionicons name="close" size={22} color={THEME.colors.grayButtonText} />
            <Text style={styles.nopeText}>Not for me</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.yes, busy && { opacity: 0.5 }]}
            disabled={busy}
            onPress={() => onImIn(card)}
            accessibilityLabel="I'm in"
          >
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            <Text style={styles.yesText}>I'm in</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    )}
  </Modal>
);

const Fact: React.FC<{ icon: IconName; color: string; label: string; sub?: string }> = ({ icon, color, label, sub }) => (
  <View style={styles.fact}>
    <View style={[styles.factIcon, { backgroundColor: color + '1A' }]}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.factLabel}>{label}</Text>
      {sub && <Text style={styles.factSub}>{sub}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14,23,38,0.45)' },
  sheetRow: {
    position: 'absolute', left: 0, right: 0, top: '12%', bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%', maxWidth: 480, maxHeight: '100%',
    backgroundColor: THEME.colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
  },
  cover: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  close: {
    position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: THEME.radii.tag, backgroundColor: THEME.colors.deepTealLight,
  },
  badgeSociety: { backgroundColor: '#F3E8FF' },
  badgeText: { fontSize: 12, fontWeight: '800', color: THEME.colors.deepTeal },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.colors.successGreen },
  title: { fontSize: 24, fontWeight: '800', color: THEME.colors.textPrimary, marginTop: 12, letterSpacing: -0.4 },
  desc: { fontSize: 15, color: THEME.colors.textSecondary, lineHeight: 22, marginTop: 6 },
  facts: {
    marginTop: 16, backgroundColor: THEME.colors.cardWhite, borderRadius: 20, padding: 14, gap: 12,
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  factLabel: { fontSize: 15, fontWeight: '700', color: THEME.colors.textPrimary },
  factSub: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: THEME.radii.pill, backgroundColor: THEME.colors.primaryOrangeLight,
  },
  tagText: { fontSize: 13, fontWeight: '700', color: THEME.colors.textPrimary },
  how: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, borderRadius: 14,
    backgroundColor: THEME.colors.deepTealLight,
  },
  howText: { flex: 1, fontSize: 13, color: THEME.colors.deepTealDark, lineHeight: 18 },
  actions: {
    flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 22, borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight, backgroundColor: THEME.colors.background,
  },
  nope: {
    flex: 1, height: 54, borderRadius: THEME.radii.pill, backgroundColor: THEME.colors.grayButton,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  nopeText: { fontSize: 15, fontWeight: '800', color: THEME.colors.grayButtonText },
  yes: {
    flex: 1.4, height: 54, borderRadius: THEME.radii.pill, backgroundColor: THEME.colors.primaryOrange,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, ...THEME.shadows.buttonOrange,
  },
  yesText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
});
