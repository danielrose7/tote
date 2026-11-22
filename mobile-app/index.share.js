// expo-share-extension hardcodes `index.share.js` as the share extension's
// entry file for Release (embedded) bundles. The real entry is TypeScript, so
// this file only forwards to it. Debug builds load from Metro and don't need it.
import './index.share.tsx';
