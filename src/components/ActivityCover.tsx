import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../types';
import { INTERESTS } from '../lib/catalog';

type IconName = keyof typeof Ionicons.glyphMap;

// Each kind of place gets its own colour story.
const PALETTE: Record<Category, [string, string, string]> = {
  quiet: ['#0B4F5A', '#12808A', '#5FD3C9'],
  food: ['#E8551C', '#E3173E', '#FFD27A'],
  social: ['#5B21B6', '#8B5CF6', '#F0ABFC'],
  active: ['#0F766E', '#16A34A', '#BEF264'],
  maker: ['#1E3A8A', '#2563EB', '#93C5FD'],
};

const FALLBACK_ICONS: Record<Category, IconName[]> = {
  quiet: ['library', 'headset', 'book'],
  food: ['cafe', 'ice-cream', 'leaf'],
  social: ['people', 'dice', 'musical-notes'],
  active: ['football', 'walk', 'sunny'],
  maker: ['construct', 'bulb', 'rocket'],
};

interface ActivityCoverProps {
  icon: string;
  category: Category;
  tags: string[];
  height: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode; // overlays (badges)
}

// An illustrated cover generated from the activity itself — always loads, no stock photos of people.
export const ActivityCover: React.FC<ActivityCoverProps> = ({ icon, category, tags, height, style, children }) => {
  const [dark, mid, light] = PALETTE[category];
  const extras = [
    ...tags.map((t) => INTERESTS.find((i) => i.tag === t)?.icon).filter((x): x is IconName => !!x),
    ...FALLBACK_ICONS[category],
  ].filter((x, i, a) => x !== icon && a.indexOf(x) === i);

  const big = Math.round(height * 0.42);

  return (
    <LinearGradient colors={[dark, mid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ height }, style]}>
      {/* soft shapes */}
      <View style={[styles.blob, { width: height * 1.1, height: height * 1.1, right: -height * 0.35, top: -height * 0.45, backgroundColor: light, opacity: 0.22 }]} />
      <View style={[styles.blob, { width: height * 0.7, height: height * 0.7, left: -height * 0.25, bottom: -height * 0.3, backgroundColor: '#FFFFFF', opacity: 0.1 }]} />
      <View style={[styles.dot, { left: '18%', top: '22%', backgroundColor: light }]} />
      <View style={[styles.dot, { right: '22%', bottom: '24%', backgroundColor: '#FFFFFF', width: 6, height: 6 }]} />
      <View style={[styles.dot, { left: '62%', top: '14%', backgroundColor: '#FFFFFF', width: 5, height: 5, opacity: 0.7 }]} />

      {/* floating side icons */}
      {extras[0] && (
        <View style={[styles.float, { left: '12%', top: '48%', transform: [{ rotate: '-12deg' }] }]}>
          <Ionicons name={extras[0]} size={Math.round(height * 0.13)} color="#FFFFFF" />
        </View>
      )}
      {extras[1] && (
        <View style={[styles.float, { right: '13%', top: '26%', transform: [{ rotate: '10deg' }] }]}>
          <Ionicons name={extras[1]} size={Math.round(height * 0.12)} color="#FFFFFF" />
        </View>
      )}
      {extras[2] && (
        <View style={[styles.float, { right: '20%', bottom: '14%', transform: [{ rotate: '-6deg' }], opacity: 0.75 }]}>
          <Ionicons name={extras[2]} size={Math.round(height * 0.09)} color="#FFFFFF" />
        </View>
      )}

      {/* hero icon */}
      <View style={styles.center} pointerEvents="none">
        <View style={[styles.hero, { width: big * 1.55, height: big * 1.55, borderRadius: big }]}>
          <Ionicons name={icon as IconName} size={big} color="#FFFFFF" />
        </View>
      </View>

      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  float: {
    position: 'absolute',
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
