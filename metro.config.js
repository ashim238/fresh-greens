// Metro config — extends Expo's default to add SVG-as-component
// support via react-native-svg-transformer. Lets us `import Fuel from
// '../assets/illustrations/fuel.svg'` and render it as a real RN
// component (backed by react-native-svg) instead of needing SvgXml +
// runtime XML parsing.
//
// Two parts:
//   - `transformer.babelTransformerPath` — runs the SVG transformer
//     during the Metro pipeline so .svg imports come out as ready-to-
//     render components.
//   - `resolver.assetExts` / `sourceExts` — tells Metro to NOT treat
//     .svg as an image asset (the default), and to instead treat it
//     as a source file the transformer can compile.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

module.exports = config;
