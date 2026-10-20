import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { Metrics } from '../types';
import { getMetrics } from '../lib/api';

interface MetricsScreenProps {
  onBack: () => void;
}

// Live funnel + retention computed from the production tables (see get_metrics in schema.sql).
export const MetricsScreen: React.FC<MetricsScreenProps> = () => {
  const [includeSeed, setIncludeSeed] = useState(false);
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await getMetrics(includeSeed));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load metrics');
    }
  }, [includeSeed]);

  useEffect(() => {
    load();
  }, [load]);

  const top = data?.funnel[0]?.users || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Live from the database</Text>
          <Text style={styles.subtitle}>Every number is a query, not a slide.</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.backBtn} accessibilityLabel="Refresh">
          <Ionicons name="refresh" size={18} color={THEME.colors.deepTeal} />
        </TouchableOpacity>
      </View>

      <View style={styles.toggleRow}>
        {[false, true].map((v) => (
          <TouchableOpacity
            key={String(v)}
            style={[styles.toggle, includeSeed === v && styles.toggleOn]}
            onPress={() => setIncludeSeed(v)}
          >
            <Text style={[styles.toggleText, includeSeed === v && styles.toggleTextOn]}>
              {v ? 'Incl. simulated students' : 'Real users only'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!data && !error && <ActivityIndicator color={THEME.colors.primaryOrange} style={{ marginTop: 40 }} />}

      {data && (
        <>
          <Text style={styles.sectionLabel}>ACTIVATION FUNNEL</Text>
          <View style={styles.card}>
            {data.funnel.map((step, i) => {
              const prev = i === 0 ? step.users : data.funnel[i - 1].users;
              const pct = top ? step.users / top : 0;
              const conv = prev ? Math.round((step.users / prev) * 100) : 0;
              return (
                <View key={step.step} style={styles.funnelRow}>
                  <View style={styles.funnelLabelRow}>
                    <Text style={styles.funnelStep}>{step.step}</Text>
                    <Text style={styles.funnelNum}>
                      {step.users}
                      {i > 0 && <Text style={styles.funnelConv}>  {conv}%</Text>}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { width: `${Math.max(pct * 100, step.users ? 2 : 0)}%` }]} />
                  </View>
                </View>
              );
            })}
            <Text style={styles.footnote}>% = conversion from the step above.</Text>
          </View>

          <Text style={styles.sectionLabel}>HEALTH</Text>
          <View style={styles.tiles}>
            <Tile label="Weekly active" value={String(data.totals.weekly_active)} />
            <Tile label="Squads formed" value={String(data.totals.squads)} />
            <Tile label="Avg 'Re-Thrive'" value={data.totals.avg_member_rating ? `${data.totals.avg_member_rating}★` : '—'} />
            <Tile label="Avg venue" value={data.totals.avg_venue_rating ? `${data.totals.avg_venue_rating}★` : '—'} />
          </View>

          <Text style={styles.sectionLabel}>WEEKLY SIGN-UP COHORTS</Text>
          <View style={styles.card}>
            <View style={styles.cohortHeader}>
              <Text style={[styles.cohortCell, styles.cohortHead]}>Week of</Text>
              <Text style={[styles.cohortCell, styles.cohortHead]}>Signed up</Text>
              <Text style={[styles.cohortCell, styles.cohortHead]}>Back in week 2</Text>
            </View>
            {data.cohorts.map((c) => (
              <View key={c.week} style={styles.cohortRow}>
                <Text style={styles.cohortCell}>{c.week}</Text>
                <Text style={styles.cohortCell}>{c.signed_up}</Text>
                <Text style={styles.cohortCell}>
                  {c.active_week_1} ({c.signed_up ? Math.round((c.active_week_1 / c.signed_up) * 100) : 0}%)
                </Text>
              </View>
            ))}
            <Text style={styles.footnote}>Churn = 100% − week-2 return rate.</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.tile}>
    <Text style={styles.tileValue}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.deepTealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  toggle: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.grayButton,
    alignItems: 'center',
  },
  toggleOn: {
    backgroundColor: THEME.colors.deepTeal,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.grayButtonText,
  },
  toggleTextOn: {
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 10,
  },
  card: {
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  funnelRow: {
    marginBottom: 12,
  },
  funnelLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  funnelStep: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  funnelNum: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  funnelConv: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F1F2F4',
    overflow: 'hidden',
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.primaryOrange,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  tileLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  cohortHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  cohortRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  cohortCell: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  cohortHead: {
    fontWeight: '800',
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  footnote: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 8,
  },
  error: {
    color: '#DC2626',
    marginTop: 16,
  },
});
