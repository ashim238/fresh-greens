// TypeScript module declaration for SVG imports.
//
// react-native-svg-transformer turns `.svg` files into React components
// at build time, but TypeScript doesn't know that without a declaration.
// This module shim tells TS that any `.svg` import resolves to a
// component compatible with react-native-svg's SvgProps.
//
// Without this, importing `from '...something.svg'` would be a TS
// error even though Metro happily resolves it at runtime.
declare module '*.svg' {
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
