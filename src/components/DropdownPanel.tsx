import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type {
  DataStatus,
  PositioningResult,
  RenderItemParams,
} from '../types';
import { Row } from './Row';
import { EmptyState } from './EmptyState';
import { EditableInput } from './EditableInput';
import { useTheme, hairline, fontFor, textDir, type DropdownTheme } from '../theme';

const MIN_PANEL_HEIGHT = 60; // never collapse below this; keeps loading spinner / empty text visible

export interface DropdownPanelHandle {
  focusSearch: () => void;
  blurSearch: () => void;
  scrollToIndex: (index: number) => void;
}

export interface DropdownPanelProps<T> {
  position: PositioningResult;
  items: T[];
  status: DataStatus;

  // search
  isSearch: boolean;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  searchPlaceholder: string;
  autoFocusSearch: boolean;
  /** When false the panel will NOT render its internal search row (used when the trigger is editable). */
  showSearchRow?: boolean;

  // empty / error
  emptyText: string;
  searchEmptyText: string;
  errorText: string;
  minSearchText: string;
  showEmptyAction?: boolean;
  emptyActionLabel?: string;
  onEmptyActionPress?: () => void;
  emptyContainerStyle?: StyleProp<ViewStyle>;
  emptyTextStyle?: StyleProp<TextStyle>;
  emptyActionStyle?: StyleProp<ViewStyle>;
  emptyActionTextStyle?: StyleProp<TextStyle>;

  // sizing
  /** When true, panel shrinks to fit actual content height (capped by position.height). */
  shrinkToContent?: boolean;
  minListHeight?: number;
  /** Render in document flow (relative, full width) instead of absolutely positioned. */
  inline?: boolean;
  /** Max height of the inline list before it scrolls internally. Keeps the list
   *  from running under the keyboard. */
  inlineMaxHeight?: number;

  // rendering
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string | undefined;
  getImageUri?: (item: T) => string | undefined;
  renderRowLeft?: (item: T) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  isSelectedItem: (item: T) => boolean;
  onSelectItem: (item: T) => void;
  renderItem?: (params: RenderItemParams<T>) => React.ReactNode;
  /** Custom loading content (replaces the default spinner). */
  renderLoading?: () => React.ReactNode;
  /** Fixed row height → enables getItemLayout (smooth scroll on huge lists). */
  itemHeight?: number;
  /** Virtualize the inline list (FlatList instead of ScrollView). */
  virtualizeInline?: boolean;
  /** Keyboard-nav: index of the active (highlighted) item in `items`. */
  activeIndex?: number;
  /** Key events from the search input (keyboard navigation). */
  onSearchKeyPress?: (e: import('react-native').TextInputKeyPressEvent) => void;
  highlightSelected: boolean;
  groupBy?: (item: T) => string;
  renderSectionHeader?: (group: string) => React.ReactNode;
  isItemDisabled?: (item: T) => boolean;
  /** Node rendered above the list (e.g. select-all row). */
  listHeader?: React.ReactNode;

  // perf
  initialNumToRender: number;
  listProps?: Partial<FlatListProps<T>>;
  style?: StyleProp<ViewStyle>;

  // pagination
  onLoadMore?: () => void;
  paginating?: boolean;

  testID?: string;
}

function DropdownPanelInner<T>(
  props: DropdownPanelProps<T>,
  ref: React.Ref<DropdownPanelHandle>,
) {
  const {
    position,
    items,
    status,
    isSearch,
    searchText,
    onSearchTextChange,
    searchPlaceholder,
    autoFocusSearch,
    showSearchRow = isSearch,
    emptyText,
    searchEmptyText,
    errorText,
    minSearchText,
    showEmptyAction,
    emptyActionLabel,
    onEmptyActionPress,
    emptyContainerStyle,
    emptyTextStyle,
    emptyActionStyle,
    emptyActionTextStyle,
    shrinkToContent = true,
    minListHeight = 0,
    inline = false,
    inlineMaxHeight,
    getLabel,
    getDescription,
    getImageUri,
    renderRowLeft,
    keyExtractor,
    isSelectedItem,
    onSelectItem,
    renderItem,
    renderLoading,
    itemHeight,
    virtualizeInline,
    activeIndex,
    onSearchKeyPress,
    highlightSelected,
    groupBy,
    renderSectionHeader,
    isItemDisabled,
    listHeader,
    initialNumToRender,
    listProps,
    style,
    onLoadMore,
    paginating,
    testID,
  } = props;

  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const inputRef = useRef<import('react-native').TextInputInstance | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<FlatList<any> | null>(null);

  // Measured intrinsic heights of each section. Used to shrink the panel to
  // fit its content (e.g., when a filter narrows the list down to 1 item or
  // when only the empty state is showing).
  const [searchRowHeight, setSearchRowHeight] = useState(0);
  const [listHeaderHeight, setListHeaderHeight] = useState(0);
  const [listContentHeight, setListContentHeight] = useState(0);
  const [emptyHeight, setEmptyHeight] = useState(0);
  const [loadingHeight, setLoadingHeight] = useState(0);

  useImperativeHandle(ref, () => ({
    focusSearch: () => inputRef.current?.focus(),
    blurSearch: () => inputRef.current?.blur(),
    scrollToIndex: (index: number) => {
      if (index < 0 || index >= items.length) return;
      try {
        listRef.current?.scrollToIndex({ index, animated: false });
      } catch {
        // ignore: virtualized list may throw if index isn't measured yet
      }
    },
  }));

  const showLoading = status === 'loading';
  const showEmpty = !showLoading && items.length === 0;

  // Pick the right body height based on what's currently rendered.
  const bodyContentHeight = showLoading
    ? loadingHeight
    : showEmpty
      ? emptyHeight
      : listContentHeight;

  // Intrinsic height of everything inside the panel (incl. border lines).
  const intrinsicHeight =
    searchRowHeight + listHeaderHeight + bodyContentHeight + 2;

  // Effective panel height. If shrinkToContent is enabled and we have at least
  // one measurement, clamp to min(position.height, intrinsicHeight, max). Always
  // honor minListHeight (and the absolute floor MIN_PANEL_HEIGHT) so the panel
  // doesn't collapse before content has been measured.
  const measured = bodyContentHeight > 0;
  const effectiveHeight =
    shrinkToContent && measured
      ? Math.max(
          MIN_PANEL_HEIGHT,
          minListHeight,
          Math.min(position.height, intrinsicHeight),
        )
      : position.height;

  // For up-direction, the panel is anchored by its BOTTOM (just above the
  // trigger). When we shrink, slide the top down so the bottom stays put.
  const panelBottom = position.top + position.height;
  const effectiveTop =
    position.direction === 'up'
      ? panelBottom - effectiveHeight
      : position.top;

  // When the panel opens upward it sits ABOVE the trigger, so the search row
  // must move to the BOTTOM of the panel to stay adjacent to the trigger (and
  // the list renders above it). When opening down, search stays at the top.
  // Inline mode always renders below the trigger -> search at top.
  const searchAtBottom = !inline && position.direction === 'up';

  const searchNode =
    isSearch && showSearchRow ? (
      <View
        style={[
          styles.searchRow,
          searchAtBottom ? styles.searchRowBottom : styles.searchRowTop,
        ]}
        onLayout={(e) => setSearchRowHeight(e.nativeEvent.layout.height)}>
        <EditableInput
          inputRef={(node) => {
            inputRef.current = node;
          }}
          value={searchText}
          onChangeText={onSearchTextChange}
          onKeyPress={onSearchKeyPress}
          placeholder={searchPlaceholder}
          autoFocus={autoFocusSearch}
          style={styles.searchInput}
          testID={testID ? `${testID}-search` : undefined}
        />
      </View>
    ) : null;

  const renderRow = (item: T, index: number) => {
    const selected = isSelectedItem(item);
    const disabled = isItemDisabled ? isItemDisabled(item) : false;
    const key = keyExtractor(item, index);
    const select = () => {
      if (!disabled) onSelectItem(item);
    };
    if (renderItem) {
      return (
        <React.Fragment key={key}>
          {renderItem({
            item,
            index,
            isSelected: selected,
            onPress: select,
          })}
        </React.Fragment>
      );
    }
    return (
      <Row
        key={key}
        label={getLabel(item)}
        description={getDescription ? getDescription(item) : undefined}
        imageUri={getImageUri ? getImageUri(item) : undefined}
        leftNode={renderRowLeft ? renderRowLeft(item) : undefined}
        isSelected={selected}
        active={activeIndex === index}
        highlightSelected={highlightSelected}
        disabled={disabled}
        onPress={select}
        testID={testID ? `${testID}-row-${index}` : undefined}
      />
    );
  };

  // Flat "entries" = items, optionally interleaved with section headers. Same
  // shape feeds both the FlatList (Modal) and the inline ScrollView.
  type Entry =
    | { key: string; kind: 'header'; label: string }
    | { key: string; kind: 'item'; item: T; index: number };

  const entries = useMemo<Entry[]>(() => {
    if (!groupBy) {
      return items.map((item, index) => ({
        key: keyExtractor(item, index),
        kind: 'item' as const,
        item,
        index,
      }));
    }
    const groups: { label: string; rows: { item: T; index: number }[] }[] = [];
    const pos = new Map<string, number>();
    items.forEach((item, index) => {
      const label = groupBy(item);
      let gi = pos.get(label);
      if (gi == null) {
        gi = groups.length;
        pos.set(label, gi);
        groups.push({ label, rows: [] });
      }
      groups[gi]!.rows.push({ item, index });
    });
    const out: Entry[] = [];
    groups.forEach((g) => {
      out.push({ key: `__h:${g.label}`, kind: 'header', label: g.label });
      g.rows.forEach(({ item, index }) =>
        out.push({ key: keyExtractor(item, index), kind: 'item', item, index }),
      );
    });
    return out;
  }, [items, groupBy, keyExtractor]);

  const stickyHeaderIndices = useMemo(
    () =>
      groupBy
        ? entries.reduce<number[]>((acc, e, i) => {
            if (e.kind === 'header') acc.push(i);
            return acc;
          }, [])
        : undefined,
    [entries, groupBy],
  );

  const renderEntry = (e: Entry) => {
    if (e.kind === 'header') {
      return renderSectionHeader ? (
        <React.Fragment key={e.key}>
          {renderSectionHeader(e.label)}
        </React.Fragment>
      ) : (
        <View key={e.key} style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{e.label}</Text>
        </View>
      );
    }
    return renderRow(e.item, e.index);
  };

  const footer = paginating ? (
    <View style={styles.footer} testID="dropdown-paginating">
      <ActivityIndicator />
    </View>
  ) : null;

  const onScrollNearEnd = onLoadMore
    ? (e: {
        nativeEvent: {
          layoutMeasurement: { height: number };
          contentOffset: { y: number };
          contentSize: { height: number };
        };
      }) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
          onLoadMore();
        }
      }
    : undefined;

  // getItemLayout only valid for uniform rows (no group headers).
  const getItemLayoutFn =
    itemHeight != null && !groupBy
      ? (_data: unknown, index: number) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })
      : undefined;

  const body = showLoading ? (
    <View
      style={styles.center}
      onLayout={(e) => setLoadingHeight(e.nativeEvent.layout.height)}
      testID="dropdown-loading">
      {renderLoading ? renderLoading() : <ActivityIndicator />}
    </View>
  ) : showEmpty ? (
    <EmptyState
      status={status}
      emptyText={emptyText}
      searchEmptyText={searchEmptyText}
      errorText={errorText}
      minSearchText={minSearchText}
      showAction={showEmptyAction}
      actionLabel={emptyActionLabel}
      onActionPress={onEmptyActionPress}
      containerStyle={emptyContainerStyle}
      textStyle={emptyTextStyle}
      actionStyle={emptyActionStyle}
      actionTextStyle={emptyActionTextStyle}
      onLayout={(e) => setEmptyHeight(e.nativeEvent.layout.height)}
    />
  ) : inline ? (
    // Inline: render rows in a plain ScrollView (NOT a VirtualizedList, which
    // must never nest inside the host ScrollView). Bounded by inlineMaxHeight
    // so the list never runs under the keyboard; scrolls internally past that.
    virtualizeInline ? (
      <FlatList
        ref={listRef}
        data={entries}
        keyExtractor={(e) => e.key}
        style={inlineMaxHeight ? { maxHeight: inlineMaxHeight } : undefined}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={stickyHeaderIndices}
        getItemLayout={getItemLayoutFn}
        initialNumToRender={initialNumToRender}
        onScroll={onScrollNearEnd}
        scrollEventThrottle={200}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={footer ?? undefined}
        renderItem={({ item }) => renderEntry(item)}
        {...(listProps as object)}
      />
    ) : (
      <ScrollView
        style={inlineMaxHeight ? { maxHeight: inlineMaxHeight } : undefined}
        nestedScrollEnabled
        persistentScrollbar
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        onScroll={onScrollNearEnd}
        scrollEventThrottle={200}>
        {entries.map(renderEntry)}
        {footer}
      </ScrollView>
    )
  ) : (
    <FlatList
      ref={listRef}
      data={entries}
      keyExtractor={(e) => e.key}
      stickyHeaderIndices={stickyHeaderIndices}
      getItemLayout={getItemLayoutFn}
      initialNumToRender={initialNumToRender}
      keyboardShouldPersistTaps="handled"
      style={styles.list}
      onContentSizeChange={(_w, h) => setListContentHeight(h)}
      onScrollToIndexFailed={() => {
        // Index not measured yet (no getItemLayout). Fail silently instead of
        // throwing — auto-scroll-to-selected is best-effort.
      }}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={footer ?? undefined}
      renderItem={({ item }) => renderEntry(item)}
      {...(listProps as object)}
    />
  );

  return (
    <View
      style={[
        styles.panel,
        inline
          ? styles.panelInline
          : {
              top: effectiveTop,
              left: position.left,
              width: position.width,
              height: effectiveHeight,
            },
        style,
      ]}
      testID={testID}
    >
      {searchAtBottom ? null : searchNode}

      {listHeader ? (
        <View
          onLayout={(e) => setListHeaderHeight(e.nativeEvent.layout.height)}>
          {listHeader}
        </View>
      ) : null}

      <View style={inline ? undefined : styles.body}>{body}</View>

      {searchAtBottom ? searchNode : null}
    </View>
  );
}

export const DropdownPanel = forwardRef(DropdownPanelInner) as <T>(
  props: DropdownPanelProps<T> & { ref?: React.Ref<DropdownPanelHandle> },
) => React.ReactElement;

const makeStyles = (t: DropdownTheme) =>
  StyleSheet.create({
  panelInline: {
    // In-flow below the trigger: pushes content down so the whole page (in the
    // host ScrollView) can scroll up when the keyboard opens. Not a floating
    // overlay — the trade-off for whole-UI keyboard scrolling.
    position: 'relative',
    width: '100%',
    marginTop: 4,
  },
  panel: {
    position: 'absolute',
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.md,
    borderWidth: hairline,
    borderColor: t.colors.border,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: t.colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  searchRow: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    backgroundColor: t.colors.surface,
  },
  // Search at top (panel opens down): divider below separates it from the list.
  searchRowTop: {
    borderBottomWidth: hairline,
    borderBottomColor: t.colors.divider,
  },
  // Search at bottom (panel opens up): divider above separates it from the list.
  searchRowBottom: {
    borderTopWidth: hairline,
    borderTopColor: t.colors.divider,
  },
  searchInput: {
    height: t.sizes.input,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: t.fontSizes.input,
    ...fontFor(t),
    ...textDir(t),
    color: t.colors.text,
    backgroundColor: 'transparent',
  },
  body: {
    flex: 1,
    backgroundColor: t.colors.surface,
  },
  list: {
    // Fill the height-bounded body so the FlatList viewport is smaller than its
    // content and it actually scrolls. (flexGrow:0 let it size to full content,
    // overflow the panel, and clip — making long lists unscrollable.)
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    backgroundColor: t.colors.surface,
    borderBottomWidth: hairline,
    borderBottomColor: t.colors.divider,
  },
  sectionHeaderText: {
    fontSize: t.fontSizes.sm,
    ...fontFor(t, 'bold'),
    ...textDir(t),
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
