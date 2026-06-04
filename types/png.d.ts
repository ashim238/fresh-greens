// TypeScript module declaration for PNG imports (e.g. menu avatar).
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}
