import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Flag } from 'phosphor-react-native/src/icons/Flag';
import { EyeSlash } from 'phosphor-react-native/src/icons/EyeSlash';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon as Circle } from 'phosphor-react-native/src/icons/Circle';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsHeader } from '../components/settings/SettingsHeader';
import { useHoldToConfirm } from '../hooks/useHoldToConfirm';
import { useReduceMotion } from '../hooks/useReduceMotion';
import {
  moderationRepository,
  ModerationRepositoryError,
  type ModerationReport,
  type ReportFlag,
} from '../lib/supabase/moderation-repository';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const NEARBY_RADIUS_METERS = 500;
const BULK_BAR_HEIGHT = 80;

function loadReportFlags(reportId: string): Promise<ReportFlag[]> {
  return moderationRepository.fetchReportFlags(reportId);
}

export default function Moderation() {
  const router = useRouter();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setFetchError(false);
    try {
      setReports(await moderationRepository.fetchModerationQueue());
    } catch {
      console.warn('[moderation] queue unavailable');
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  function enterBulkMode() {
    setBulkMode(true);
    setExpandedId(null);
    setSelectedIds(new Set());
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleRestore(reportId: string) {
    setActionError(null);
    try {
      await moderationRepository.restoreReport(
        reportId,
        'Restored via moderation queue',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void fetchQueue();
    } catch (error) {
      console.warn('[moderation] restore unavailable');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setActionError(
        error instanceof ModerationRepositoryError && error.code === 'rejected'
          ? 'Restore failed — try again.'
          : 'Restore failed — check connection.',
      );
    }
  }

  async function handleRemove(reportId: string) {
    setActionError(null);
    try {
      await moderationRepository.removeReport(
        reportId,
        'Removed via moderation queue',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void fetchQueue();
    } catch (error) {
      console.warn('[moderation] remove unavailable');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setActionError(
        error instanceof ModerationRepositoryError && error.code === 'rejected'
          ? 'Remove failed — try again.'
          : 'Remove failed — check connection.',
      );
    }
  }

  async function handleBulkRestore() {
    const applicable = reports.filter(
      (r) => selectedIds.has(r.id) && (r.hidden_at !== null || r.removed_at !== null),
    );
    if (applicable.length === 0) return;
    setBulkActing(true);
    setActionError(null);
    try {
      const { failedIds } = await moderationRepository.runBulkModeration(
        applicable.map((report) => report.id),
        'restore',
      );
      if (failedIds.length > 0) {
        console.warn(`[moderation] bulk restore: ${failedIds.length}/${applicable.length} failed`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setActionError(`${failedIds.length} of ${applicable.length} restores failed. They remain selected.`);
        setSelectedIds(new Set(failedIds));
        setBulkActing(false);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setBulkActing(false);
        exitBulkMode();
      }
      void fetchQueue();
    } catch {
      console.warn('[moderation] bulk restore unavailable');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setActionError('Bulk restore failed — check connection.');
      setBulkActing(false);
    }
  }

  async function handleBulkRemove() {
    const applicable = reports.filter(
      (r) => selectedIds.has(r.id) && r.removed_at === null,
    );
    if (applicable.length === 0) return;
    setBulkActing(true);
    setActionError(null);
    try {
      const { failedIds } = await moderationRepository.runBulkModeration(
        applicable.map((report) => report.id),
        'remove',
      );
      if (failedIds.length > 0) {
        console.warn(`[moderation] bulk remove: ${failedIds.length}/${applicable.length} failed`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setActionError(`${failedIds.length} of ${applicable.length} removals failed. They remain selected.`);
        setSelectedIds(new Set(failedIds));
        setBulkActing(false);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setBulkActing(false);
        exitBulkMode();
      }
      void fetchQueue();
    } catch {
      console.warn('[moderation] bulk remove unavailable');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setActionError('Bulk remove failed — check connection.');
      setBulkActing(false);
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
          icon={<ShieldCheck size={28} color={colors.wiltedgreen} weight="regular" />}
          large
          onClose={() => router.back()}
        />

        {!loading && reports.length > 0 && (
          <View style={styles.toolbar}>
            <Pressable
              onPress={bulkMode ? exitBulkMode : enterBulkMode}
              disabled={bulkActing}
              accessibilityRole="button"
              accessibilityLabel={bulkMode ? 'Exit selection mode' : 'Enter selection mode'}
              style={({ pressed }) => [styles.toolbarBtn, pressed && pressedDim, bulkActing && { opacity: 0.4 }]}
            >
              <Text style={styles.toolbarBtnText}>
                {bulkMode ? 'Done' : 'Select'}
              </Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            bulkMode && selectedIds.size > 0 && styles.scrollContentBulk,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.wiltedgreen} />
            </View>
          )}

          {!loading && fetchError && (
            <View style={styles.centered}>
              <Text style={styles.errorText}>Could not load queue — check connection.</Text>
              <Pressable
                onPress={() => { setLoading(true); void fetchQueue(); }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading queue"
                style={({ pressed }) => [styles.retryBtn, pressed && pressedDim]}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {!loading && !fetchError && reports.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No reports to review</Text>
            </View>
          )}

          {actionError && (
            <Pressable
              onPress={() => setActionError(null)}
              accessibilityRole="alert"
              style={styles.actionErrorBanner}
            >
              <Text style={styles.actionErrorText}>{actionError}</Text>
            </Pressable>
          )}

          {hiddenReports.length > 0 && (
            <QueueSection
              title={`Needs review (${hiddenReports.length})`}
              reports={hiddenReports}
              allReports={reports}
              expandedId={expandedId}
              onToggle={setExpandedId}
              onRestore={handleRestore}
              onRemove={handleRemove}
              bulkMode={bulkMode}
              selectedIds={selectedIds}
              onSelect={toggleSelected}
              loadFlags={loadReportFlags}
            />
          )}

          {visibleReports.length > 0 && (
            <QueueSection
              title={`Visible (${visibleReports.length})`}
              reports={visibleReports}
              allReports={reports}
              expandedId={expandedId}
              onToggle={setExpandedId}
              onRestore={handleRestore}
              onRemove={handleRemove}
              bulkMode={bulkMode}
              selectedIds={selectedIds}
              onSelect={toggleSelected}
              loadFlags={loadReportFlags}
            />
          )}

          {removedReports.length > 0 && (
            <QueueSection
              title={`Removed (${removedReports.length})`}
              reports={removedReports}
              allReports={reports}
              expandedId={expandedId}
              onToggle={setExpandedId}
              onRestore={handleRestore}
              onRemove={handleRemove}
              bulkMode={bulkMode}
              selectedIds={selectedIds}
              onSelect={toggleSelected}
              loadFlags={loadReportFlags}
            />
          )}
        </ScrollView>

        {bulkMode && selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            acting={bulkActing}
            onRestore={handleBulkRestore}
            onRemove={handleBulkRemove}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function QueueSection({
  title,
  reports,
  allReports,
  expandedId,
  onToggle,
  onRestore,
  onRemove,
  bulkMode,
  selectedIds,
  onSelect,
  loadFlags,
}: {
  title: string;
  reports: ModerationReport[];
  allReports: ModerationReport[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  onRestore: (id: string) => void;
  onRemove: (id: string) => void;
  bulkMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  loadFlags: (reportId: string) => Promise<ReportFlag[]>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          allReports={allReports}
          expanded={!bulkMode && expandedId === report.id}
          onToggle={() => onToggle(expandedId === report.id ? null : report.id)}
          onRestore={() => onRestore(report.id)}
          onRemove={() => onRemove(report.id)}
          bulkMode={bulkMode}
          selected={selectedIds.has(report.id)}
          onSelect={() => onSelect(report.id)}
          loadFlags={loadFlags}
        />
      ))}
    </View>
  );
}

function ReportCard({
  report,
  allReports,
  expanded,
  onToggle,
  onRestore,
  onRemove,
  bulkMode,
  selected,
  onSelect,
  loadFlags,
}: {
  report: ModerationReport;
  allReports: ModerationReport[];
  expanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onRemove: () => void;
  bulkMode: boolean;
  selected: boolean;
  onSelect: () => void;
  loadFlags: (reportId: string) => Promise<ReportFlag[]>;
}) {
  const age = formatAge(report.timestamp);
  const displayName = report.place_name ?? report.category_id;
  const isHidden = report.hidden_at !== null;
  const isRemoved = report.removed_at !== null;

  const [showHistory, setShowHistory] = useState(false);
  const [showNearby, setShowNearby] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  const [flags, setFlags] = useState<ReportFlag[] | null>(null);
  const [flagsLoading, setFlagsLoading] = useState(false);

  const submitterReports = useMemo(
    () => allReports.filter((r) => r.device_uuid === report.device_uuid && r.id !== report.id),
    [allReports, report.device_uuid, report.id],
  );

  const nearbyReports = useMemo(() => {
    const results: Array<ModerationReport & { distanceMeters: number }> = [];
    for (const r of allReports) {
      if (r.id === report.id) continue;
      if (!r.location?.latitude || !r.location?.longitude) continue;
      const d = haversineMeters(
        report.location.latitude,
        report.location.longitude,
        r.location.latitude,
        r.location.longitude,
      );
      if (d <= NEARBY_RADIUS_METERS) {
        results.push({ ...r, distanceMeters: d });
      }
    }
    results.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return results;
  }, [allReports, report.id, report.location.latitude, report.location.longitude]);

  useEffect(() => {
    if (!showFlags || flags !== null) return;
    let cancelled = false;
    async function fetchFlags() {
      setFlagsLoading(true);
      try {
        const rows = await loadFlags(report.id);
        if (!cancelled) setFlags(rows);
      } catch (error) {
        if (
          !cancelled &&
          (!(error instanceof ModerationRepositoryError) ||
            error.code !== 'rejected')
        ) {
          setFlags([]);
        }
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    }
    void fetchFlags();
    return () => { cancelled = true; };
  }, [showFlags, flags, report.id, loadFlags]);

  const { holdProgress, pressHandlers, isVoiceOverOn } = useHoldToConfirm({
    thresholdMs: 800,
    onConfirm: onRemove,
  });
  const reduceMotion = useReduceMotion();

  return (
    <View style={[styles.card, isHidden && styles.cardHidden, bulkMode && selected && styles.cardSelected]}>
      <Pressable
        onPress={bulkMode ? onSelect : onToggle}
        accessibilityRole={bulkMode ? 'checkbox' : 'button'}
        accessibilityState={bulkMode ? { checked: selected } : undefined}
        accessibilityLabel={`${displayName}, ${report.category_id}, ${age}`}
        accessibilityHint={bulkMode ? (selected ? 'Deselect' : 'Select') : (expanded ? 'Collapse details' : 'Expand details')}
        style={({ pressed }) => [styles.cardHeader, pressed && pressedDim]}
      >
        {bulkMode && (
          <View style={styles.checkbox} accessibilityElementsHidden importantForAccessibility="no">
            {selected ? (
              <CheckCircle size={24} color={colors.freshgreen} weight="fill" />
            ) : (
              <Circle size={24} color={colors.wiltedgreen} />
            )}
          </View>
        )}
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
              <EyeSlash size={12} color={colors.severityWarning} />
              <Text style={styles.badgeTextHidden}>
                {report.hidden_reason ?? 'hidden'}
              </Text>
            </View>
          )}
          {isRemoved && (
            <View style={[styles.badge, styles.badgeRemoved]}>
              <Trash size={12} color={colors.severityCritical} />
              <Text style={styles.badgeTextRemoved}>removed</Text>
            </View>
          )}
          {report.is_verified_phone && (
            <View style={[styles.badge, styles.badgeVerified]}>
              <Text style={styles.badgeTextVerified}>verified</Text>
            </View>
          )}
          {!bulkMode && (
            <CaretRight
              size={16}
              color={colors.wiltedgreen}
              style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
            />
          )}
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

          <View style={styles.panelGroup}>
            <InvestigationPanel
              icon={<Users size={16} color={colors.wiltedgreen} />}
              title="Submitter history"
              count={submitterReports.length}
              open={showHistory}
              onToggle={() => setShowHistory((v) => !v)}
            >
              {submitterReports.length === 0 ? (
                <Text style={styles.panelEmpty}>No other reports from this device.</Text>
              ) : (
                submitterReports.map((r) => (
                  <View
                    key={r.id}
                    style={styles.panelRow}
                    accessible
                    accessibilityLabel={`${r.category_id}, ${r.place_name ?? r.category_id}, ${formatAge(r.timestamp)}`}
                  >
                    <View style={styles.panelRowLeft}>
                      <Text style={styles.panelRowCategory}>{r.category_id}</Text>
                      <Text style={styles.panelRowName} numberOfLines={1}>
                        {r.place_name ?? r.category_id}
                      </Text>
                    </View>
                    <View style={styles.panelRowRight}>
                      <StatusBadge report={r} />
                      <Text style={styles.panelRowAge}>{formatAge(r.timestamp)}</Text>
                    </View>
                  </View>
                ))
              )}
            </InvestigationPanel>

            <InvestigationPanel
              icon={<MapPin size={16} color={colors.wiltedgreen} />}
              title="Nearby reports"
              count={nearbyReports.length}
              subtitle={`within ${NEARBY_RADIUS_METERS}m`}
              open={showNearby}
              onToggle={() => setShowNearby((v) => !v)}
            >
              {nearbyReports.length === 0 ? (
                <Text style={styles.panelEmpty}>No other reports within {NEARBY_RADIUS_METERS}m.</Text>
              ) : (
                nearbyReports.map((r) => (
                  <View
                    key={r.id}
                    style={styles.panelRow}
                    accessible
                    accessibilityLabel={`${r.category_id}, ${r.place_name ?? r.category_id}, ${formatDistance(r.distanceMeters)} away`}
                  >
                    <View style={styles.panelRowLeft}>
                      <Text style={styles.panelRowCategory}>{r.category_id}</Text>
                      <Text style={styles.panelRowName} numberOfLines={1}>
                        {r.place_name ?? r.category_id}
                      </Text>
                    </View>
                    <View style={styles.panelRowRight}>
                      <Text style={styles.panelRowDistance}>{formatDistance(r.distanceMeters)}</Text>
                      <StatusBadge report={r} />
                    </View>
                  </View>
                ))
              )}
            </InvestigationPanel>

            <InvestigationPanel
              icon={<Flag size={16} color={colors.wiltedgreen} />}
              title="Flags"
              count={flags?.length ?? null}
              loading={flagsLoading}
              open={showFlags}
              onToggle={() => setShowFlags((v) => !v)}
            >
              {flagsLoading && (
                <ActivityIndicator color={colors.wiltedgreen} style={styles.panelLoader} />
              )}
              {!flagsLoading && flags !== null && flags.length === 0 && (
                <Text style={styles.panelEmpty}>No flags on this report.</Text>
              )}
              {!flagsLoading && flags !== null && flags.length > 0 && (
                <>
                  {detectCoordination(flags) && (
                    <View style={styles.coordinationWarning} accessibilityRole="alert">
                      <Text style={styles.coordinationText}>
                        Possible coordinated flagging detected
                      </Text>
                    </View>
                  )}
                  {flags.map((f) => (
                    <View
                      key={f.id}
                      style={styles.panelRow}
                      accessible
                      accessibilityLabel={`Flag: ${f.reason_category}${f.reason ? `, ${f.reason}` : ''}`}
                    >
                      <View style={styles.panelRowLeft}>
                        <Text style={styles.panelRowCategory}>{f.reason_category}</Text>
                        {f.reason && (
                          <Text style={styles.panelRowName} numberOfLines={1}>
                            {f.reason}
                          </Text>
                        )}
                      </View>
                      <View style={styles.panelRowRight}>
                        <Text style={styles.flagMeta}>
                          {f.flagger_device_uuid.slice(0, 6)}
                          {f.flagger_ip ? ` · ${f.flagger_ip}` : ''}
                        </Text>
                        <Text style={styles.panelRowAge}>
                          {formatAge(new Date(f.created_at).getTime())}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </InvestigationPanel>
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
                accessibilityHint={isVoiceOverOn ? 'Double-tap to remove' : 'Hold to confirm removal'}
                style={({ pressed }) => [styles.actionBtn, styles.actionRemove, pressed && pressedDim]}
              >
                {!reduceMotion && (
                  <Animated.View
                    style={[
                      styles.holdRing,
                      {
                        width: holdProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                )}
                <Trash size={18} color={colors.severityCritical} />
                <Text style={styles.actionTextRemove}>
                  {isVoiceOverOn ? 'Remove' : 'Hold to remove'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function BulkActionBar({
  count,
  acting,
  onRestore,
  onRemove,
}: {
  count: number;
  acting: boolean;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const { holdProgress, pressHandlers, isVoiceOverOn } = useHoldToConfirm({
    thresholdMs: 800,
    onConfirm: onRemove,
  });
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const noun = count === 1 ? 'report' : 'reports';

  return (
    <View style={[styles.bulkBar, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
      <Text style={styles.bulkCount}>
        {count} {noun} selected
      </Text>
      <View style={styles.bulkActions}>
        {acting ? (
          <ActivityIndicator color={colors.wiltedgreen} />
        ) : (
          <>
            <Pressable
              onPress={onRestore}
              accessibilityRole="button"
              accessibilityLabel={`Restore ${count} ${noun}`}
              style={({ pressed }) => [styles.bulkBtn, styles.actionRestore, pressed && pressedDim]}
            >
              <ArrowCounterClockwise size={18} color={colors.freshgreen} />
              <Text style={styles.actionTextRestore}>Restore</Text>
            </Pressable>
            <Pressable
              {...pressHandlers}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${count} ${noun}`}
              accessibilityHint={isVoiceOverOn ? 'Double-tap to remove' : 'Hold to confirm removal'}
              style={({ pressed }) => [styles.bulkBtn, styles.actionRemove, pressed && pressedDim]}
            >
              {!reduceMotion && (
                <Animated.View
                  style={[
                    styles.holdRing,
                    {
                      width: holdProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              )}
              <Trash size={18} color={colors.severityCritical} />
              <Text style={styles.actionTextRemove}>
                {isVoiceOverOn ? 'Remove' : 'Hold to remove'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function InvestigationPanel({
  icon,
  title,
  count,
  subtitle,
  loading: isLoading,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number | null;
  subtitle?: string;
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const countLabel = count !== null ? ` (${count})` : '';
  return (
    <View style={styles.panel}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${title}${countLabel}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.panelHeader, pressed && pressedDim]}
      >
        {icon}
        <Text style={styles.panelTitle}>
          {title}
          {countLabel}
        </Text>
        {subtitle && <Text style={styles.panelSubtitle}>{subtitle}</Text>}
        {isLoading && <ActivityIndicator size="small" color={colors.wiltedgreen} />}
        <CaretRight
          size={14}
          color={colors.wiltedgreen}
          style={[styles.panelCaret, { transform: [{ rotate: open ? '90deg' : '0deg' }] }]}
        />
      </Pressable>
      {open && <View style={styles.panelContent}>{children}</View>}
    </View>
  );
}

function StatusBadge({ report }: { report: ModerationReport }) {
  if (report.removed_at) {
    return (
      <View style={[styles.miniBadge, styles.badgeRemoved]} accessibilityRole="text" accessibilityLabel="Status: removed">
        <Text style={styles.miniBadgeText}>removed</Text>
      </View>
    );
  }
  if (report.hidden_at) {
    return (
      <View style={[styles.miniBadge, styles.badgeHidden]} accessibilityRole="text" accessibilityLabel="Status: hidden">
        <Text style={styles.miniBadgeTextHidden}>hidden</Text>
      </View>
    );
  }
  return null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectCoordination(flags: ReportFlag[]): boolean {
  if (flags.length < 2) return false;
  const withIp = flags.filter((f) => f.flagger_ip != null);
  const ips = new Set(withIp.map((f) => f.flagger_ip));
  const devices = new Set(flags.map((f) => f.flagger_device_uuid));
  const ipDuplicate = withIp.length >= 2 && ips.size < withIp.length;
  return ipDuplicate || devices.size < flags.length;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfacePage,
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
  scrollContentBulk: {
    paddingBottom: spacing.xl * 2 + BULK_BAR_HEIGHT,
  },
  centered: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    ...dynamicType(typography.bodyRegular),
    color: colors.wiltedgreen,
  },
  errorText: {
    ...dynamicType(typography.bodyRegular),
    color: colors.severityCritical, // readable error copy on light surface — .cursorrules #8
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.chipVerifiedFill,
    minHeight: tapTarget44.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.freshgreen,
  },
  actionErrorBanner: {
    backgroundColor: colors.chipAvoidFill,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionErrorText: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.severityCritical, // readable error copy on light surface — .cursorrules #8
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  toolbarBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: tapTarget44.height,
    minWidth: tapTarget44.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnText: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.freshgreen,
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
    backgroundColor: colors.surfaceCard,
    borderRadius: radii.md,
    ...shadows.e1,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardHidden: {
    backgroundColor: colors.chipCautionFill,
  },
  cardSelected: {
    borderColor: colors.freshgreen,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: tapTarget44.height,
  },
  checkbox: {
    marginRight: spacing.sm,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardCategory: {
    ...dynamicType(typography.caption1Regular),
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
    color: colors.severityWarning,
  },
  badgeTextRemoved: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.severityCritical,
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

  // Investigation panels
  panelGroup: {
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorSubtle,
    paddingTop: spacing.md,
  },
  panel: {
    backgroundColor: colors.surfacePage,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: tapTarget44.height,
  },
  panelTitle: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.wiltedgreen,
  },
  panelSubtitle: {
    ...dynamicType(typography.caption1Regular),
    color: colors.mutedSecondary,
  },
  panelCaret: {
    marginLeft: 'auto',
  },
  panelContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  panelEmpty: {
    ...dynamicType(typography.caption1Regular),
    color: colors.mutedSecondary,
    paddingVertical: spacing.xs,
  },
  panelLoader: {
    paddingVertical: spacing.sm,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorSubtle,
    gap: spacing.sm,
  },
  panelRowLeft: {
    flex: 1,
    gap: 1,
  },
  panelRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  panelRowCategory: {
    ...dynamicType(typography.caption1Regular),
    color: colors.wiltedgreen,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  panelRowName: {
    ...dynamicType(typography.caption1Regular),
    color: colors.black,
  },
  panelRowAge: {
    ...dynamicType(typography.caption1Regular),
    color: colors.mutedSecondary,
  },
  panelRowDistance: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.wiltedgreen,
  },
  flagMeta: {
    ...dynamicType(typography.caption1Regular),
    color: colors.mutedSecondary,
  },
  miniBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  miniBadgeText: {
    ...dynamicType(typography.caption2Regular),
    color: colors.severityCritical,
  },
  miniBadgeTextHidden: {
    ...dynamicType(typography.caption1Regular),
    color: colors.severityWarning,
  },
  coordinationWarning: {
    backgroundColor: colors.chipCautionFill,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  coordinationText: {
    ...dynamicType(typography.caption1Emphasized),
    color: colors.severityWarning,
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
    minHeight: tapTarget44.height,
    overflow: 'hidden',
  },
  actionRestore: {
    backgroundColor: colors.chipVerifiedFill,
  },
  actionRemove: {
    backgroundColor: colors.chipAvoidFill,
  },
  holdRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.chipAvoidFill,
  },
  actionTextRestore: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.systemGreen,
  },
  actionTextRemove: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.severityCritical,
  },

  // Bulk action bar
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorSubtle,
    ...shadows.e1,
  },
  bulkCount: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: tapTarget44.height,
    overflow: 'hidden',
  },
});
