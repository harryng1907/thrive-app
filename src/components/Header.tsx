import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { ScreenType } from '../types';
import { AvatarPhoto } from './AvatarPhoto';

interface HeaderProps {
  title: string;
  currentScreen: ScreenType;
  onProfilePress: () => void;
  onBackPress?: () => void;
  onResetPress?: () => void;
  showBack?: boolean;
  initials?: string;
  avatarColor?: string;
  avatarUrl?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  currentScreen,
  onProfilePress,
  onBackPress,
  onResetPress,
  showBack = false,
  initials = '',
  avatarColor,
  avatarUrl,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        {showBack && onBackPress ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoBadgeContainer}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.campusTag}>
              <Text style={styles.campusText}>Uni</Text>
            </View>
          </View>
        )}
        <Text style={styles.screenTitle}>{title}</Text>
      </View>

      <View style={styles.rightContainer}>
        {onResetPress && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={onResetPress}
            activeOpacity={0.7}
            accessibilityLabel="Reset Pitch Demo"
          >
            <Ionicons name="reload" size={14} color={THEME.colors.deepTeal} />
            <Text style={styles.resetText}>Demo</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.profileButton,
            currentScreen === 'profile' && styles.profileButtonActive,
          ]}
          onPress={onProfilePress}
          activeOpacity={0.7}
          accessibilityLabel="Open Profile"
        >
          <View style={[styles.avatarCircle, avatarColor ? { backgroundColor: avatarColor } : null]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
            <AvatarPhoto url={avatarUrl} />
          </View>
          <View style={styles.onlineBadge} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: THEME.colors.background,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  campusTag: {
    backgroundColor: THEME.colors.unswYellow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  campusText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.darkNavy,
    letterSpacing: 0.5,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.card,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: THEME.colors.deepTealLight,
    borderWidth: 1,
    borderColor: '#C7E4E9',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.deepTeal,
  },
  profileButton: {
    position: 'relative',
    padding: 2,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  profileButtonActive: {
    borderColor: THEME.colors.primaryOrange,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.card,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.successGreen,
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
});
