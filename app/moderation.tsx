import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Flag } from 'phosphor-react-native/src/icons/Flag';
import { Eye } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlash } from 'phosphor-react-native/src/icons/EyeSlash';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsHeader } from '../components/settings/SettingsHeader';
import { useHoldToConfirm } from '../hooks/useHoldToConfirm';
import { getAuthHeaders } from '../lib/supabase-auth';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type ModerationReport = {
  id: string;
  category_id: string;
  location: { latitude: number; longitude: number };
  detail: string | null;
  place_name: string | null;
  place_type: string | null;
  submitted_by: string | null;
  timestamp: number;
  device_uuid: string;
  auth_user_id: string | null;
  submitter_ip: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
  removed_at: string | null;
  is_verified_phone: boolean;
  flag_count?: number;
};

export default function Moderation() {
  const router = useRouter();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
      const url = `${base}/rest/v1/community_reports_moderation?select=*&order=hidden_at.desc.nullslast,timestamp.desc`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn('[moderation] fetch failed:', res.status);
        return;
      }
      const rows = (await res.json()) as ModerationReport[];
      setReports(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.warn('[moderation] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  async function handleRestore(reportId: string) {
    try {
      const headers = await getAuthHeaders();
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
      const url = `${base}/rest/v1/rpc/moderator_restore_report`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_report_id: reportId,
          p_reason: 'Restored via moderation queue',
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        void fetchQueue();
      }
    } catch (error) {
      console.warn('[moderation] restore error:', error);
    }
  }

  async function handleRemove(reportId: string) {
    try {
      const headers = await getAuthHeaders();
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
      const url = `${base}/rest/v1/rpc/moderator_remove_report`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_report_id: reportId,
          p_reason: 'Removed via moderation queue',
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        void fetchQueue();
      }
    } catch (error) {
      console.warn('[moderation] remove error:', error);
    }
  }

  const hiddenReports = reports.filter((r) => r.hidden_at !== null && r.removed_at === null);
  const visibleReports = reports.filter((r) => r.hidden_at === null && r.removed_at === null);
  const removedReports = reports.filter((r) => r.removed_at !== null);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader
          title="Moderation"
          icon={<ShieldCheck size={28} color={colors.wiltedgreen} weight="bold" />}
          large
          onClose={() => router.back()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.wiltedgreen} />
            </View>
          )}

          {!loading && reports.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No reports to review.</Text>
            </View>
          )}

          {hiddenReports.length > 0 && (
            <QueueSection
              title={`Needs review (${hiddenReports.length})`}
              reports={hiddenReports}
              expandedId={expandedId}
              onToggle={setExpandedId}
              onRestore={handleRestore}
              onRemove={handleRemove}
            />
          )}

          {visibleReports.length > 0 && (
            <QueueSection
              title={`Visible (${visibleReports.length})`}
              reports={visibleReports}
              expandedId={expandedId}
              onToggle={setExpandedId}
              onRestore={handleRestore}
              onRemove={handleRemove}
            />
          )}

          {removedReports.length > 0 && (
            <QueueSection
              title={`Removed (${removedReports.length})`}
              reports={removedReports}
              expandedId={expandedId}
              onToggle={setExpandedId}
              onRestore={handleRestore}
              onRemove={handleRemove}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function QueueSection({
  title,
  reports,
  expandedId,
  onToggle,
  onRestore,
  onRemove,
}: {
  title: string;
  reports: ModerationReport[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  onRestore: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          expanded={expandedId === report.id}
          onToggle={() => onToggle(expandedId === report.id ? null : report.id)}
          onRestore={() => onRestore(report.id)}
          onRemove={() => onRemove(report.id)}
        />
      ))}
    </View>
  );
}

function ReportCard({
  report,
  expanded,
  onToggle,
  onRestore,
  onRemove,
}: {
  report: ModerationReport;
  expanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const age = formatAge(report.timestamp);
  const displayName = report.place_name ?? report.category_id;
  const isHidden = report.hidden_at !== null;
  const isRemoved = report.removed_at !== null;

  const { holdProgress, pressHandlers } = useHoldToConfirm({
    thresholdMs: 800,
    onConfirm: onRemove,
  });

  return (
    <View style={[styles.card, isHidden && styles.cardHidden]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, ${report.category_id}, ${age}`}
        accessibilityHint={expanded ? 'Collapse details' : 'Expand details'}
        style={({ pressed }) => [styles.cardHeader, pressed && pressedDim]}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.cardCategory}>{report.category_id}</Text>
          <Text style={styles.cardName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.cardAge}>{age}</Text>
        </View>
        <View style={styles.cardBadges}>
          {isHidden && (
            <View style={[styles.badge, styles.badgeHidden]}>
              <EyeSlash size={12} color={colors.orange} />
              <Text style={styles.badgeTextHidden}>
                {report.hidden_reason ?? 'hidden'}
              </Text>
            </View>
          )}
          {isRemoved && (
            <View style={[styles.badge, styles.badgeRemoved]}>
              <Trash size={12} color={colors.red} />
              <Text style={styles.badgeTextRemoved}>removed</Text>
            </View>
          )}
          {report.is_verified_phone && (
            <View style={[styles.badge, styles.badgeVerified]}>
              <Text style={styles.badgeTextVerified}>verified</Text>
            </View>
          )}
          <CaretRight
            size={16}
            color={colors.wiltedgreen}
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.expandedBody}>
          {report.detail && (
            <Text style={styles.detailText}>{report.detail}</Text>
          )}

          <View style={styles.metaGrid}>
            <MetaRow label="Device" value={report.device_uuid.slice(0, 8) + '…'} />
            <MetaRow
              label="Auth"
              value={report.auth_user_id ? report.auth_user_id.slice(0, 8) + '…' : 'anonymous'}
            />
            {report.submitter_ip && (
              <MetaRow label="IP" value={report.submitter_ip} />
            )}
            <MetaRow label="Location" value={`${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`} />
          </View>

          <View style={styles.actions}>
            {(isHidden || isRemoved) && (
              <Pressable
                onPress={onRestore}
                accessibilityRole="button"
                accessibilityLabel="Restore report"
                style={({ pressed }) => [styles.actionBtn, styles.actionRestore, pressed && pressedDim]}
              >
                <ArrowCounterClockwise size={18} color={colors.freshgreen} />
                <Text style={styles.actionTextRestore}>Restore</Text>
              </Pressable>
            )}
            {!isRemoved && (
              <Pressable
                {...pressHandlers}
                accessibilityRole="button"
                accessibilityLabel="Remove report"
                accessibilityHint="Hold to confirm removal"
                style={({ pressed }) => [styles.actionBtn, styles.actionRemove, pressed && pressedDim]}
              >
                <Animated.View
                  style={[
                    styles.holdRing,
                    {
                      transform: [
                        {
                          scaleX: holdProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Trash size={18} color={colors.red} />
                <Text style={styles.actionTextRemove}>Hold to remove</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.systemGroupedBackground,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    ...dynamicType(typography.bodyRegular),
    color: colors.wiltedgreen,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.wiltedgreen,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    ...shadows.e1,
    overflow: 'hidden',
  },
  cardHidden: {
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: tapTarget44.minHeight,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardCategory: {
    ...dynamicType(typography.caption2Regular),
    color: colors.wiltedgreen,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  cardName: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  cardAge: {
    ...dynamicType(typography.caption1Regular),
    color: colors.wiltedgreen,
  },
  cardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeHidden: {
    backgroundColor: colors.chipCautionFill,
  },
  badgeRemoved: {
    backgroundColor: colors.chipAvoidFill,
  },
  badgeVerified: {
    backgroundColor: colors.chipVerifiedFill,
  },
  badgeTextHidden: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.orange,
  },
  badgeTextRemoved: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.red,
  },
  badgeTextVerified: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.systemGreen,
  },
  expandedBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorSubtle,
    padding: spacing.md,
    gap: spacing.md,
  },
  detailText: {
    ...dynamicType(relaxedLineHeight(typography.subheadlineRegular)),
    color: colors.black,
  },
  metaGrid: {
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.wiltedgreen,
    width: 60,
  },
  metaValue: {
    ...dynamicType(typography.caption1Regular),
    color: colors.black,
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: tapTarget44.minHeight,
    overflow: 'hidden',
  },
  actionRestore: {
    backgroundColor: colors.chipVerifiedFill,
  },
  actionRemove: {
    backgroundColor: colors.chipAvoidFill,
  },
  holdRing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    transformOrigin: 'left',
  },
  actionTextRestore: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.systemGreen,
  },
  actionTextRemove: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.red,
  },
});
