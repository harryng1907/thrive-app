import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

interface MatchingOverlayProps {
  visible: boolean;
  tags?: string[];
}

export const MatchingOverlay: React.FC<MatchingOverlayProps> = ({ visible, tags = [] }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Subtle rotation for spark
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulse.start();
      rotate.start();

      return () => {
        pulse.stop();
        rotate.stop();
      };
    }
  }, [visible, pulseAnim, rotateAnim]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.iconCircle,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sparkles" size={36} color={THEME.colors.primaryOrange} />
            </Animated.View>
          </Animated.View>

          <Text style={styles.titleText}>AI assembling your squad...</Text>
          <View style={styles.stepsRow}>
            {(['calendar', 'school', 'heart', 'location'] as const).map((icon) => (
              <View key={icon} style={styles.stepIcon}>
                <Ionicons name={icon} size={16} color={THEME.colors.deepTeal} />
              </View>
            ))}
          </View>

          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="large" color={THEME.colors.primaryOrange} />
          </View>

          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.miniBadge}>
                <Text style={styles.miniBadgeText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 23, 38, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: THEME.radii.card,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...THEME.shadows.cardHover,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: THEME.colors.primaryOrangeLight,
    borderWidth: 2,
    borderColor: '#CFF2BD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  spinnerContainer: {
    marginBottom: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  miniBadge: {
    backgroundColor: THEME.colors.deepTealLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.tag,
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.deepTeal,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.deepTealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
