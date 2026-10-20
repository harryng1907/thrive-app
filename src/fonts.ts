// Thrive type: Fredoka for headings, Nunito for everything else (matches the pitch deck).
// Web build: load both from Google Fonts and give every <Text> Nunito by default;
// big bold text (titles) switches to Fredoka. Icon fonts set their own family, so they're untouched.
import { Platform, StyleSheet, Text } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const href =
    'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap';
  if (!document.querySelector(`link[href="${href}"]`)) {
    for (const origin of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
      const pre = document.createElement('link');
      pre.rel = 'preconnect';
      pre.href = origin;
      if (origin.includes('gstatic')) pre.crossOrigin = 'anonymous';
      document.head.appendChild(pre);
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  const AnyText = Text as unknown as { render?: (props: any, ref: any) => any };
  const original = AnyText.render;
  if (original && !(AnyText as any).__thrive) {
    (AnyText as any).__thrive = true;
    AnyText.render = function (props: any, ref: any) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return original.call(this, props, ref); // icons etc.
      const weight = Number(flat.fontWeight) || 400;
      const size = Number(flat.fontSize) || 14;
      const heading = weight >= 700 && size >= 19;
      const fontFamily = heading ? 'Fredoka, Nunito, system-ui, sans-serif' : 'Nunito, system-ui, sans-serif';
      return original.call(this, { ...props, style: [{ fontFamily }, props.style, heading ? { fontWeight: '600', letterSpacing: 0 } : null] }, ref);
    };
  }
}
