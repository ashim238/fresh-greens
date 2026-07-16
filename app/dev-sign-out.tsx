import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../lib/account-session/session-provider';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function DevSignOut() {
  const router = useRouter();
  const { phase, beginSignOut } = useSession();

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/login');
      return;
    }

    if (phase !== 'authenticated') {
      router.replace('/sign-out');
      return;
    }

    let cancelled = false;
    void (async () => {
      await beginSignOut();
      if (!cancelled) router.replace('/sign-out');
    })();

    return () => {
      cancelled = true;
    };
  }, [beginSignOut, phase, router]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Starting dev sign out</Text>
      <Text style={styles.body}>Running the same account cleanup path.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surfacePage,
  },
  title: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
    textAlign: 'center',
  },
  body: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
    textAlign: 'center',
  },
});
