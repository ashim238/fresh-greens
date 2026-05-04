import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
 *
 * SafeAreaProvider exposes the device's safe-area inset values via React
 * context. The SafeAreaView from react-native-safe-area-context (used in
 * each screen) reads from this provider to know what padding to apply.
 * Required at the root for the new SafeAreaView to function.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/*
          /safety is presented as a modal — slides up from the bottom over
          the current screen, system swipe-down to dismiss. iOS-native
          modal sheet behavior. Other routes use the default stack push.
        */}
        <Stack.Screen name="safety" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
