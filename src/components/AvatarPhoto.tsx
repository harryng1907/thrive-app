import React from 'react';
import { Image, StyleSheet } from 'react-native';

// Drop inside any round initials avatar: covers the initials when there's a photo.
// Thrive keeps data minimal: no profile photos, initials only (photos are never shown).
export const AvatarPhoto: React.FC<{ url?: string | null }> = () => null;

const styles = StyleSheet.create({
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
  },
});
