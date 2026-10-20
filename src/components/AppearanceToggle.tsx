import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { Appearance, appearanceSupported, getAppearance, onAppearanceChange, setAppearance } from '../appearance';

const OPTIONS: { value: Appearance; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

// Profile → Appearance: follow the phone, or force light / dark.
export const AppearanceToggle: React.FC = () => {
  const [value, setValue] = useState<Appearance>(getAppearance());
  useEffect(() => {
    const off = onAppearanceChange(setValue);
    return () => {
      off();
    };
  }, []);
  if (!appearanceSupported) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="contrast-outline" size={18} color={THEME.colors.deepTeal} />
        <Text style={styles.title}>Appearance</Text>
        <Text style={styles.sub}>{value === 'system' ? 'Follows your phone' : value === 'dark' ? 'Always dark' : 'Always light'}</Text>
      </View>
      <View style={styles.segment}>
        {OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[styles.btn, on && styles.btnOn]}
              onPress={() => setAppearance(o.value)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Appearance: ${o.label}`}
            >
              <Ionicons name={o.icon} size={15} color={on ? '#FFFFFF' : THEME.colors.textSecondary} />
              <Text style={[styles.btnText, on && { color: '#FFFFFF' }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '800', color: THEME.colors.textPrimary },
  sub: { marginLeft: 'auto', fontSize: 12, color: THEME.colors.textMuted },
  segment: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.grayButton,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
  },
  btnOn: { backgroundColor: THEME.colors.deepTeal },
  btnText: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary },
});
