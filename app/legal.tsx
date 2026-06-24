import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsHeader } from '../components/settings/SettingsHeader';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Section = {
  id: 'privacy' | 'terms' | 'limitations';
  label: string;
};

const SECTIONS: Section[] = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'limitations', label: 'Limitations' },
];

/**
 * /legal — Privacy / Terms / Limitations.
 *
 * Settings-register page: SettingsHeader chrome over a grouped-gray bg,
 * with the legal body in a white card. Below the header sits a sticky
 * tab pill row (Privacy / Terms / Limitations) — the page's primary nav,
 * which lets the user jump between sections (and surfaces the current one).
 * Content mirrors `docs/legal/{privacy,terms,limitations}.md` verbatim;
 * those markdown files are the canonical source for App Store Connect
 * and any hosted page, this surface is for in-app reading.
 *
 * Effective date is hard-coded; bump it on this file AND in the three
 * markdown docs simultaneously when the policies meaningfully change.
 */
export default function Legal() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const anchorOffsets = useRef<Record<Section['id'], number>>({
    privacy: 0,
    terms: 0,
    limitations: 0,
  });
  const [activeSection, setActiveSection] = useState<Section['id']>('privacy');

  function jumpTo(id: Section['id']) {
    const y = anchorOffsets.current[id];
    scrollRef.current?.scrollTo({ y, animated: true });
    setActiveSection(id);
  }

  function recordAnchor(id: Section['id'], y: number) {
    anchorOffsets.current[id] = y;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader
          title="Privacy & Terms"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <View style={styles.tabRow}>
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => jumpTo(s.id)}
                style={({ pressed }) => [
                  styles.tab,
                  isActive && styles.tabActive,
                  pressed && pressedDim,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${s.label}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentCard}>
          <View
            onLayout={(e) => recordAnchor('privacy', e.nativeEvent.layout.y)}
          >
            <SectionHeader>Privacy</SectionHeader>
            <EffectiveDate />
            <Paragraph>
              Fresh Greens is a graduate thesis project — a navigation and safety
              app exploring how to make solo travel feel less alone. This policy
              is the honest description of what the app does with your data. We
              wrote it specifically to match what Fresh Greens actually does,
              not as a generic template.
            </Paragraph>

            <H2>TL;DR</H2>
            <Bullet>Fresh Greens runs locally on your device. There is no Fresh Greens server.</Bullet>
            <Bullet>The only data that leaves your device is the route-search query sent to Mapbox so the map can show you places and routes.</Bullet>
            <Bullet>We do not track you across other apps or websites.</Bullet>
            <Bullet>We do not show ads.</Bullet>
            <Bullet>We do not sell or share your data for advertising, analytics, or any other purpose.</Bullet>

            <H2>What we collect</H2>
            <H3>Your location (foreground only)</H3>
            <Paragraph>
              Fresh Greens uses your device&apos;s location to draw routes, show
              nearby places, and let you share with a trusted contact during a
              safety event. We request location only while the app is in use.
              We do not request background location. Your location stays on
              your device.
            </Paragraph>
            <Paragraph>
              When you search for a place, the query (e.g. &quot;gas station&quot;)
              and a coarse nearby anchor point are sent to Mapbox to get back
              results. Mapbox&apos;s privacy policy governs that request.
            </Paragraph>
            <Paragraph>
              When you start a safety session, the &quot;is being notified&quot;
              indicator represents your intent to share — in this version the
              app does not yet transmit your live location to your contact.
            </Paragraph>

            <H3>Your trusted contact</H3>
            <Paragraph>
              You can pick one contact for safety flows. We read only the
              contact you select — we do not scan your address book. Their
              name, phone number, and home address (if available) are stored
              locally on your device. We do not send any messages from Fresh
              Greens to your contact; any calls or texts are placed by you
              through your phone&apos;s normal dialer.
            </Paragraph>

            <H3>Audio recordings</H3>
            <Paragraph>
              During a Pulled-over event, Fresh Greens can record audio for
              your personal record. Recordings are stored locally — they are
              not uploaded anywhere, not added to your Photos library, and
              not shared automatically. You can delete recordings from
              /recordings at any time.
            </Paragraph>

            <H3>Preferences and route history</H3>
            <Paragraph>
              Your routing preferences, saved places, trusted contact, roadside
              service info, and share-session state are stored in your device&apos;s
              local storage. Nothing is uploaded.
            </Paragraph>

            <H2>Third parties</H2>
            <Bullet>Apple — Apple Sign In, if you use it.</Bullet>
            <Bullet>Mapbox — map tiles, geocoding, place search.</Bullet>
            <Bullet>Expo — the framework Fresh Greens is built on; may collect anonymous crash data if you have opted in via device settings.</Bullet>
            <Bullet>OpenStreetMap — fallback routing when Mapbox is unreachable.</Bullet>
            <Paragraph>
              We do not use Google Analytics, Firebase, Crashlytics, Mixpanel,
              Segment, or any other analytics SDK.
            </Paragraph>

            <H2>Your rights</H2>
            <Bullet>Delete your data — uninstalling the app removes everything.</Bullet>
            <Bullet>See what&apos;s stored — all persisted data is visible inside the app.</Bullet>
            <Bullet>Withdraw a permission — revoke Location, Contacts, or Microphone access in iOS Settings at any time.</Bullet>
          </View>

          <View
            onLayout={(e) => recordAnchor('terms', e.nativeEvent.layout.y)}
          >
            <SectionHeader>Terms</SectionHeader>
            <EffectiveDate />

            <H2>What Fresh Greens is not</H2>
            <Paragraph>
              <BoldInline>Fresh Greens is not an emergency-response service.</BoldInline>{' '}
              It does not summon police, fire, or medical help. It does not
              contact 911 on your behalf. It does not transmit your live
              location to emergency dispatchers.
            </Paragraph>
            <Paragraph>
              <BoldInline>Fresh Greens is not a certified safety product.</BoldInline>{' '}
              It has not been audited by any safety-product standard body. Its
              routing recommendations are best-effort and may be wrong.
            </Paragraph>
            <Paragraph>
              <BoldInline>Fresh Greens is not a navigation system for vehicles in motion.</BoldInline>{' '}
              Do not interact with the app while driving.
            </Paragraph>

            <H2>Use the app safely</H2>
            <Bullet>In a genuine emergency, call 911 directly. Do not use Fresh Greens as a substitute.</Bullet>
            <Bullet>Treat the &quot;Share location&quot; indicator as a commitment to share, not as confirmation your contact is viewing your location in real time.</Bullet>
            <Bullet>The Roadside flow dials a number you saved — we don&apos;t verify or guarantee the service.</Bullet>
            <Bullet>Pulled-over recordings are personal records, not automatic transmissions.</Bullet>

            <H2>Acceptable use</H2>
            <Bullet>Respect recording-consent laws in your jurisdiction.</Bullet>
            <Bullet>Don&apos;t use Fresh Greens to stalk, harass, or set a trusted contact who hasn&apos;t consented.</Bullet>
            <Bullet>Don&apos;t use routing features to plan illegal activity.</Bullet>

            <H2>Limitation of liability</H2>
            <Paragraph>
              To the maximum extent permitted by law, the author of Fresh
              Greens is not liable for any damages arising from your use of the
              app. Fresh Greens is a thesis project. Use it the way you would
              use a thesis project.
            </Paragraph>

            <H2>Changes</H2>
            <Paragraph>
              We may change these terms over time. Significant changes will be
              surfaced in the app on next launch.
            </Paragraph>
          </View>

          <View
            onLayout={(e) => recordAnchor('limitations', e.nativeEvent.layout.y)}
          >
            <SectionHeader>Limitations of use</SectionHeader>
            <Paragraph>
              Fresh Greens is a thesis project — a working prototype designed to
              explore what a safety-aware navigation app could feel like. Some
              parts of the app are not yet what they appear to be. We want to
              be honest about that.
            </Paragraph>

            <H2>Sharing your location is simulated in this version</H2>
            <Paragraph>
              When you start a Roadside, Unfamiliar Area, or Share Location
              session, the app shows a &quot;is being notified&quot; indicator
              and a sharing widget. In this version, the indicator reflects
              your intent — not active transmission. Your trusted contact does
              not receive an SMS or live-location feed from Fresh Greens.
            </Paragraph>
            <Paragraph>
              A future version will add real transmission with your explicit
              opt-in. Until then, treat the affordance as a commitment to share —
              the next thing you should do is text or call your contact
              yourself.
            </Paragraph>

            <H2>Roadside Assistance dials your service — we don&apos;t provide one</H2>
            <Paragraph>
              Fresh Greens has no relationship with any roadside service.
              &quot;Call your roadside service&quot; dials the number you saved.
              We don&apos;t verify the number, negotiate response time, or know
              whether the service is available right now.
            </Paragraph>

            <H2>Pulled-over recordings are for your personal record</H2>
            <Paragraph>
              Recordings stay on your device. They aren&apos;t auto-sent to
              police, attorneys, or a cloud backup. If you want someone else to
              have a copy, you share it yourself.
            </Paragraph>
            <Paragraph>
              Recording-consent laws vary by jurisdiction. In most U.S. states
              recording your own interaction with police is legal, but the
              specifics differ. You are responsible for the law in your state.
            </Paragraph>

            <H2>We are not an emergency service</H2>
            <Paragraph>
              If you are in immediate physical danger, call 911 on your phone,
              not Fresh Greens. The app is designed to help you feel less alone
              and to make it easy to reach the people who care about you. It is
              not a panic button or a monitored security service.
            </Paragraph>

            <H2>Routing is best-effort, not guaranteed</H2>
            <Paragraph>
              Map data has errors. Lighting data is sparse. Safety scores are
              heuristics. A route that looks safe on the map can change in real
              conditions. Trust your own judgment.
            </Paragraph>

            <H2>In summary</H2>
            <Paragraph>
              Fresh Greens is a prototype. Use it like a prototype — as a
              thoughtful companion, not a guarantee. In any situation where
              your safety actually depends on a working tool, use a real one.
            </Paragraph>
          </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// --- Inline typography helpers ------------------------------------------

function SectionHeader({ children }: { children: string }) {
  return (
    <Text style={styles.sectionHeader} accessibilityRole="header">
      {children}
    </Text>
  );
}

function EffectiveDate() {
  return <Text style={styles.effectiveDate}>Effective date: 2026-05-31</Text>;
}

function H2({ children }: { children: string }) {
  return (
    <Text style={styles.h2} accessibilityRole="header">
      {children}
    </Text>
  );
}

function H3({ children }: { children: string }) {
  return (
    <Text style={styles.h3} accessibilityRole="header">
      {children}
    </Text>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function BoldInline({ children }: { children: string }) {
  return <Text style={styles.boldInline}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.systemGroupedBackground },
  safe: { flex: 1 },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.systemGroupedBackground,
  },
  tabActive: {
    backgroundColor: colors.freshgreen,
  },
  tabLabel: {
    // subheadlineEmphasized (15pt) per the 2026-06-01 text-size
    // audit. The Privacy / Terms / Licenses tab pills are primary
    // navigation on this page — 13pt left them sitting at caption
    // tier, which read as auxiliary metadata rather than the active
    // nav surface.
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.labelSecondary,
  },
  tabLabelActive: {
    color: colors.white,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  // White card holding the legal body on the grouped-gray page. The
  // section anchor offsets (recordAnchor) are measured relative to this
  // card now; jumpTo scrolls to a y that's short by the card's own top
  // offset (~spacing.md), an imperceptible overshoot on a long doc.
  contentCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.e1,
  },
  sectionHeader: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  effectiveDate: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    marginBottom: spacing.md,
  },
  h2: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  h3: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.labelSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  paragraph: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.black,
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  bulletDot: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
    marginRight: spacing.sm,
  },
  bulletText: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.black,
    flex: 1,
  },
  boldInline: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
});
