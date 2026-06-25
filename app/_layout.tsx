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
          Modal-presented routes — slide up from the bottom, system
          swipe-down dismisses. iOS-native sheet behavior. Other routes
          use the default stack push.
        */}
        <Stack.Screen name="safety" options={{ presentation: 'modal' }} />
        {/*
          /pulled-over consolidates what used to be four stacked modals
          (/armed-or-not, /recording, /contact, /review-guidance) into a
          single state-machine modal. One presentation, one swipe-down
          dismissal — the user doesn't have to peel off four layers to
          get back to /home after a stressful event.
        */}
        <Stack.Screen
          name="pulled-over"
          options={{ presentation: 'modal' }}
        />
        {/*
          /trip-summary — post-trip recap pop-up (Figma 825:4908), shown on
          arrival. A single-view modal sheet; swipe-down dismisses, same as
          the other safety/flow modals.
        */}
        <Stack.Screen
          name="trip-summary"
          options={{ presentation: 'modal' }}
        />
        {/*
          /share-location — proactive Share Location /safety sub-flow. Single-
          step reason picker; selection starts a global ShareSession and dismisses.
          LiveSafetySheet on /home or /en-route carries the session forward.
        */}
        <Stack.Screen
          name="share-location"
          options={{ presentation: 'modal' }}
        />
        {/*
          /unfamiliar — "Unfamiliar area" /safety sub-flow. Two-step page-sheet
          modal: problem picker → safe-destination picker. Auto-starts a global
          ShareSession on Step 1; the LiveSafetySheet widget on /home or /en-route
          carries the session forward after destination-routing.
        */}
        <Stack.Screen
          name="unfamiliar"
          options={{ presentation: 'modal' }}
        />
        {/*
          /roadside — Roadside Assistance sub-flow. Page-sheet modal with
          internal state machine (problem → action → status), mirroring
          /pulled-over's pattern. DragHandle stays present; usePreventRemove
          traps dismissal on the status step.
        */}
        <Stack.Screen
          name="roadside"
          options={{ presentation: 'modal' }}
        />
        {/*
          /roadside-setup — captures the user's roadside service name + phone.
          Settings-style sheet modal (chevron dismisses); mirrors /fuel.
        */}
        <Stack.Screen
          name="roadside-setup"
          options={{ presentation: 'modal' }}
        />
        {/*
          /insurance-setup — carrier + policy number (+ optional card scan).
          Full stack push from /safety-settings (same register as /fuel and
          /trusted-contact-setup, not a bottom sheet).
        */}
        <Stack.Screen name="insurance-setup" />
        {/*
          /legal — Privacy / Terms / Limitations. Pushed from /menu;
          standard stack push (not modal) since this is a reading
          surface, not a sub-flow.
        */}
        <Stack.Screen name="legal" />
        {/*
          Report uses transparentModal (not modal) so the map underneath
          stays visible — the popup is a centered card over a 20% scrim,
          not an iOS-sheet that takes over the screen. Fade animation
          keeps the entry/exit gentle.
        */}
        <Stack.Screen
          name="report"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
        {/*
          Emergency uses transparentModal for the same reason as
          /report — the calling surface (/en-route map context, or the
          /safety modal) stays visible behind the 20% scrim so the user
          doesn't lose situational awareness mid-crisis. Redesigned per
          Figma 49-5188 / 49-5388 / 49-197 (2026-06-01) to a centered
          card with idle (choose target) → countdown (Stop window) →
          auto-dial pattern.
        */}
        <Stack.Screen
          name="emergency"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
