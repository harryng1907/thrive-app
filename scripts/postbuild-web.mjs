// Adds home-screen icon + app tags to the exported web page (Expo's web export doesn't).
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'dist/index.html';
let html = readFileSync(file, 'utf8');
const tags = `
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Thrive" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
`;
if (!html.includes('apple-touch-icon')) {
  html = html.replace('</head>', `${tags}</head>`);
  writeFileSync(file, html);
}
console.log('postbuild: icon tags added');
