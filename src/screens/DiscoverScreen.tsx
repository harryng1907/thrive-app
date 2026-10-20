import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { ActivityCard, Nudge, SquadType } from '../types';
import { formatDuration, formatWhen, SQUAD_TYPE_LABEL } from '../lib/format';
import { ActivityCover } from '../components/ActivityCover';
import { ActivityDetailSheet } from '../components/ActivityDetailSheet';

type IconName = keyof typeof Ionicons.glyphMap;

const TYPE_ICON: Record<ActivityCard['squad_type'], IconName> = {
  deadline: 'hourglass-outline',
  hobby: 'sparkles',
  career: 'trending-up',
};

// "Pick what kind of squad you want" — filter chips on top of the deck.
type Filter = 'all' | 'society' | SquadType;
const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'society', label: 'Societies', icon: 'balloon' },
  { key: 'deadline', label: 'Study', icon: 'hourglass-outline' },
  { key: 'hobby', label: 'Hobby', icon: 'sparkles' },
  { key: 'career', label: 'Career', icon: 'trending-up' },
];

const SWIPE_DISTANCE = 110;

// Fri–Sun in Sydney → "Weekend's here"
const isWeekend = () => {
  const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short' }).format(new Date());
  return ['Fri', 'Sat', 'Sun'].includes(day);
};

const CATEGORY_PLACE: Record<ActivityCard['category'], string> = {
  quiet: 'Quiet study spot',
  social: 'Social campus spot',
  active: 'Sports centre',
  maker: 'Makerspace',
  food: 'Campus café',
};

interface DiscoverScreenProps {
  cards: ActivityCard[];
  loading: boolean;
  busy: boolean;
  notice: string | null;
  nudges: Nudge[];
  onImIn: (card: ActivityCard) => void;
  onNotForMe: (card: ActivityCard) => void;
  onRebook: (nudge: Nudge) => void;
  onRefresh: () => void;
  onSuggest: () => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  cards,
  loading,
  busy,
  notice,
  nudges,
  onImIn,
  onNotForMe,
  onRebook,
  onRefresh,
  onSuggest,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const visible =
    filter === 'all' ? cards
    : filter === 'society' ? cards.filter((c) => c.host)
    : cards.filter((c) => c.squad_type === filter);
  const card = visible[0];
  const nudge = nudges[0];
  const [details, setDetails] = useState<ActivityCard | null>(null);

  // Drag the card: right = I'm in, left = Not for me.
  const pan = useRef(new Animated.Value(0)).current;
  const latest = useRef({ card, busy, onImIn, onNotForMe, openDetails: (_: ActivityCard) => {} });
  latest.current = { card, busy, onImIn, onNotForMe, openDetails: setDetails };

  // One gesture handler for the card: a small touch = tap (details), a sideways drag = swipe.
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.busy,
      onMoveShouldSetPanResponder: (_, g) =>
        !latest.current.busy && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => pan.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const { card: c, onImIn: yes, onNotForMe: no, openDetails } = latest.current;
        if (c && Math.abs(g.dx) > SWIPE_DISTANCE) {
          const right = g.dx > 0;
          Animated.timing(pan, { toValue: right ? 600 : -600, duration: 180, useNativeDriver: false }).start(() =>
            right ? yes(c) : no(c),
          );
          return;
        }
        Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
        if (c && Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) openDetails(c);
      },
      // Let the page scroll take over for vertical drags.
      onPanResponderTerminationRequest: (_, g) => Math.abs(g.dx) < 8,
      onPanResponderTerminate: () => Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;

  // New top card (or a failed swipe) → snap back to the middle.
  useEffect(() => {
    if (!busy) pan.setValue(0);
  }, [card?.id, busy, pan]);

  const rotate = pan.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const inOpacity = pan.interpolate({ inputRange: [0, SWIPE_DISTANCE], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = pan.interpolate({ inputRange: [-SWIPE_DISTANCE, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* "Go again?" — built from your past ratings */}
      {nudge && (
        <TouchableOpacity
          style={styles.nudgeCard}
          onPress={() => onRebook(nudge)}
          activeOpacity={0.85}
          disabled={busy}
          accessibilityLabel={`Book again with ${nudge.names.join(', ')}`}
        >
          <View style={styles.nudgeIcon}>
            <Ionicons name="repeat" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nudgeTitle}>
              {isWeekend() ? "Weekend's here! " : ''}Re-Thrive with {nudge.names.join(' & ')}?
            </Text>
            <Text style={styles.nudgeSub}>
              You rated them {nudge.top_score}★ after {nudge.activity_title}
              {nudge.venue_score != null && nudge.venue_score <= 2 && nudge.venue_name
                ? ` · we'll skip ${nudge.venue_name}`
                : ''}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={THEME.colors.deepTeal} />
        </TouchableOpacity>
      )}

      {notice && (
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle" size={18} color={THEME.colors.deepTeal} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <View style={styles.bannerRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((ft) => {
            const on = filter === ft.key;
            return (
              <TouchableOpacity
                key={ft.key}
                style={[styles.filterChip, on && styles.filterChipOn]}
                onPress={() => setFilter(ft.key)}
                accessibilityLabel={`Show ${ft.label} activities`}
              >
                <Ionicons name={ft.icon} size={14} color={on ? '#FFFFFF' : THEME.colors.deepTeal} />
                <Text style={[styles.filterText, on && { color: '#FFFFFF' }]}>{ft.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.suggestBtn} onPress={onSuggest} accessibilityLabel="Suggest an activity">
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading && !card ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator color={THEME.colors.primaryOrange} />
        </View>
      ) : !card && cards.length > 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name={FILTERS.find((x) => x.key === filter)!.icon} size={40} color={THEME.colors.textMuted} />
          <Text style={styles.emptyTitle}>Nothing here right now</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => setFilter('all')} activeOpacity={0.8}>
            <Ionicons name="apps" size={16} color={THEME.colors.deepTeal} />
            <Text style={styles.refreshText}>Show all</Text>
          </TouchableOpacity>
        </View>
      ) : !card ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-done-circle" size={44} color={THEME.colors.deepTeal} />
          <Text style={styles.emptyTitle}>You've seen everything</Text>
          <Text style={styles.emptySub}>New sessions get added every week. Check your squads in the meantime.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color={THEME.colors.deepTeal} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.cardWrapper}>
            {visible.length > 1 && <View style={styles.stackCardBack} />}

            <Animated.View
              style={[styles.card, { transform: [{ translateX: pan }, { rotate }] }]}
              {...responder.panHandlers}
            >
              <View accessibilityRole="button" accessibilityLabel={`See details for ${card.title}`}>
                <ActivityCover icon={card.icon} category={card.category} tags={card.tags} height={300} style={styles.cover}>
                  <View style={styles.coverTop}>
                    <View style={styles.glassPill}>
                      <Ionicons
                        name={card.host ? 'balloon' : card.course ? 'school' : card.suggested ? 'person' : TYPE_ICON[card.squad_type]}
                        size={13}
                        color={card.host ? '#7C3AED' : THEME.colors.deepTeal}
                      />
                      <Text style={[styles.glassText, card.host ? { color: '#7C3AED' } : null]} numberOfLines={1}>
                        {card.host ?? card.course ?? (card.suggested ? 'Student idea' : SQUAD_TYPE_LABEL[card.squad_type])}
                      </Text>
                    </View>
                    {card.kind === 'session' && (
                      <View style={styles.glassPill}>
                        <View style={styles.liveDot} />
                        <Text style={styles.glassText}>Live</Text>
                      </View>
                    )}
                  </View>
                  {card.interested_count > 0 && (
                    <View style={styles.coverBottom}>
                      <View style={styles.darkPill}>
                        <Ionicons name="flame" size={13} color="#8EEA5E" />
                        <Text style={styles.darkPillText}>{card.interested_count} in</Text>
                      </View>
                    </View>
                  )}

                  <Animated.View style={[styles.stamp, styles.stampIn, { opacity: inOpacity }]} pointerEvents="none">
                    <Ionicons name="checkmark-circle" size={22} color={THEME.colors.successGreen} />
                    <Text style={[styles.stampText, { color: THEME.colors.successGreen }]}>I'M IN</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]} pointerEvents="none">
                    <Ionicons name="close-circle" size={22} color="#6B7280" />
                    <Text style={[styles.stampText, { color: '#6B7280' }]}>NOPE</Text>
                  </Animated.View>
                </ActivityCover>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{card.title}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.meta}>
                      <Ionicons name="calendar-outline" size={15} color={THEME.colors.primaryOrange} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {card.starts_at ? formatWhen(card.starts_at).replace(/^(\w{3})\w*/, '$1') : 'Flexible'}
                      </Text>
                    </View>
                    <View style={styles.meta}>
                      <Ionicons name="time-outline" size={15} color={THEME.colors.textSecondary} />
                      <Text style={styles.metaText}>{formatDuration(card.duration_mins)}</Text>
                    </View>
                    {card.spots_left != null && (
                      <View style={styles.meta}>
                        <Ionicons name="people-outline" size={15} color={THEME.colors.deepTeal} />
                        <Text style={styles.metaText}>{card.spots_left} left</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.moreRow}>
                    <Ionicons name="location-outline" size={14} color={THEME.colors.textMuted} />
                    <Text style={styles.moreText} numberOfLines={1}>
                      {card.venue?.name ?? CATEGORY_PLACE[card.category]}
                    </Text>
                    <View style={styles.detailsLink}>
                      <Text style={styles.detailsText}>Details</Text>
                      <Ionicons name="chevron-up" size={14} color={THEME.colors.deepTeal} />
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>

          <View style={styles.roundRow}>
            <TouchableOpacity
              style={[styles.roundBtn, styles.roundNope, busy && styles.disabled]}
              onPress={() => onNotForMe(card)}
              disabled={busy}
              activeOpacity={0.75}
              accessibilityLabel="Not for me, show next activity"
            >
              <Ionicons name="close" size={32} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roundBtn, styles.roundInfo]}
              onPress={() => setDetails(card)}
              activeOpacity={0.75}
              accessibilityLabel="Show details"
            >
              <Ionicons name="information" size={24} color={THEME.colors.deepTeal} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roundBtn, styles.roundYes, busy && styles.disabled]}
              onPress={() => onImIn(card)}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityLabel="I'm in, find me a squad"
            >
              <Ionicons name="checkmark" size={36} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>Swipe ← nope · I'm in → · tap the card for details</Text>
      </View>

      <ActivityDetailSheet
        card={details}
        busy={busy}
        onClose={() => setDetails(null)}
        onImIn={(c) => {
          setDetails(null);
          onImIn(c);
        }}
        onNotForMe={(c) => {
          setDetails(null);
          onNotForMe(c);
        }}
      />
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
    paddingBottom: 24,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  activeBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: THEME.colors.cardWhite,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radii.tag,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  orangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primaryOrange,
  },
  activeBannerText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.darkNavy,
    letterSpacing: 0.6,
  },
  countPill: {
    backgroundColor: THEME.colors.cardWhite,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radii.tag,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  stackCardBack: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: -8,
    backgroundColor: '#EAEAE7',
    borderRadius: THEME.radii.card,
    opacity: 0.7,
  },
  card: {
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.cardHover,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cohortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.deepTealLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radii.tag,
  },
  cohortBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
    letterSpacing: 0.4,
  },
  verifiedCampusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedCampusText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  timePlaceBox: {
    backgroundColor: '#FBFBFA',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginBottom: 16,
    gap: 8,
  },
  timePlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  timePlaceText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  timePlaceDot: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  timePlaceDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radii.tag,
    flexDirection: 'row',
    alignItems: 'center',
  },
  regularTagPill: {
    backgroundColor: '#F3F4F6',
  },
  spotTagPill: {
    backgroundColor: THEME.colors.primaryOrangeLight,
    borderWidth: 1,
    borderColor: '#CFF2BD',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  regularTagText: {
    color: THEME.colors.darkNavy,
  },
  spotTagText: {
    color: THEME.colors.primaryOrange,
  },
  descriptionBox: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.deepTeal,
  },
  descriptionText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  subtextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  fireIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtext: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  notForMeButton: {
    flex: 1,
    height: 56,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.grayButton,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  notForMeText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.grayButtonText,
  },
  imInButton: {
    flex: 1.4,
    height: 56,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...THEME.shadows.buttonOrange,
  },
  imInText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  hintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  hintText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: THEME.colors.primaryOrangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.deepTealLight,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#CDE5E9',
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.deepTealDark,
  },
  nudgeSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: THEME.radii.card,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 20,
    minHeight: 260,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.deepTealLight,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.deepTeal,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipOn: {
    backgroundColor: THEME.colors.deepTeal,
    borderColor: THEME.colors.deepTeal,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  stamp: {
    position: 'absolute',
    top: 70,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#FFFFFFEE',
  },
  stampIn: {
    left: 18,
    borderColor: THEME.colors.successGreen,
    transform: [{ rotate: '-8deg' }],
  },
  stampNope: {
    right: 18,
    borderColor: '#9CA3AF',
    transform: [{ rotate: '8deg' }],
  },
  stampText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  suggestBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...THEME.shadows.buttonOrange,
  },
  societyBadge: {
    backgroundColor: '#F3E8FF',
    flexShrink: 1,
    marginRight: 8,
  },
  cover: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  coverTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.pill,
  },
  glassText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.successGreen,
  },
  coverBottom: {
    position: 'absolute',
    left: 14,
    bottom: 14,
  },
  darkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(14,23,38,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.pill,
  },
  darkPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 18,
    paddingTop: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  moreText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginTop: 4,
    marginBottom: 10,
  },
  roundBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: THEME.colors.cardWhite,
    ...THEME.shadows.card,
  },
  roundNope: {
    width: 66,
    height: 66,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  roundInfo: {
    width: 48,
    height: 48,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  roundYes: {
    width: 76,
    height: 76,
    backgroundColor: THEME.colors.primaryOrange,
    ...THEME.shadows.buttonOrange,
  },
});
