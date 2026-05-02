import { Stack } from 'expo-router';

/**
 * Root layout — wraps every screen in the app/ directory.
 *
 * The underscore prefix (`_layout`) is an expo-router convention: files
 * starting with `_` aren't routes themselves, they're layouts that wrap
 * the routes inside their folder.
 *
 * `Stack` is a stack navigator: each screen pushes on top of the previous,
 * with a back gesture/swipe handled natively. headerShown is off here
 * because our designs are full-bleed and use custom in-screen back buttons.
 */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
