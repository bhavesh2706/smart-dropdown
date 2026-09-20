import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  findNodeHandle,
  I18nManager,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
  useColorScheme,
  useWindowDimensions,
  View as RNView,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';

import type {
  DropdownRef,
  DropdownSelectProps,
  PositioningResult,
  TriggerRect,
} from './types';
import { withDefaults } from './defaults';
import { useKeyboard } from './hooks/useKeyboard';
import { useMeasureTrigger } from './hooks/useMeasureTrigger';
import { usePositioning } from './hooks/usePositioning';
import { useSearch } from './hooks/useSearch';
import { useSelection } from './hooks/useSelection';
import { Trigger } from './components/Trigger';
import { Field } from './components/Field';
import { SelectAllRow } from './components/SelectAllRow';
import { CreateRow } from './components/CreateRow';
import { DropdownModal } from './components/DropdownModal';
import {
  DropdownPanel,
  type DropdownPanelHandle,
} from './components/DropdownPanel';
import { DEFAULT_TEXTS } from './defaults';
import { getLabel, isSameValue, makeKeyExtractor } from './utils/itemKeys';
import { registerOpen, unregisterOpen, markInsideTap } from './openRegistry';
import {
  darkTheme,
  deviceScale,
  lightTheme,
  mergeTheme,
  scaleTheme,
  ThemeProvider,
} from './theme';

// LayoutAnimation needs an explicit opt-in on Android (old architecture).
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_ANIM = LayoutAnimation.create(
  160,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

// Inline keyboard-reveal tuning. Space reserved ABOVE the inline list (status
// bar + header + the trigger row + margins) when bounding it to the area above
// the keyboard, and the clearance left BELOW the list and the keyboard's top
// edge. The reveal effect and `inlineMaxHeight` share both so the host scroll
// and the list cap stay in agreement (otherwise the last row clips behind the
// keyboard).
const INLINE_TRIGGER_RESERVE = 160;
const INLINE_LIST_GAP = 48;

function DropdownSelectInner<T>(
  rawProps: DropdownSelectProps<T>,
  ref: React.Ref<DropdownRef>,
) {
  const props = withDefaults(rawProps);
  const {
    items,
    labelKey,
    valueKey,
    keyExtractor: customKeyExtractor,
    descriptionKey,
    imageKey,
    renderRowLeft,

    mode,
    multiDisplay,
    value: controlledValue,
    defaultValue,
    selectedValues: controlledSelectedValues,
    defaultSelectedValues,
    onChange,
    onChangeMulti,
    maxSelections,
    minSelections,
    onValidityChange,
    includeSelectedInList,

    placeholder = DEFAULT_TEXTS.placeholder,
    disabled,
    triggerStyle,
    triggerTextStyle,
    placeholderStyle,
    chipStyle,
    chipTextStyle,
    maxVisibleChips,
    theme: themeOverride,
    colorScheme,

    direction,
    allowDirectionFallback,
    listHeight,
    minListHeight,
    maxListHeight,
    autoAdjustHeight,
    shrinkToContent,
    edgeMargin,

    closeOnSelect,
    open: openProp,
    onOpenChange,
    showOverlay,
    overlayColor,
    closeOnOutsidePress,
    inline,
    animated,
    rtl,
    scrollRef,

    isSearch,
    searchMode,
    searchInTrigger,
    searchPlaceholder = DEFAULT_TEXTS.searchPlaceholder,
    autoFocusSearch,
    minSearchLength,
    searchDebounceMs,
    filterFunction,
    onSearchTextChange,
    fetchData,
    enablePagination,
    pageSize,
    loadOnOpen,
    persistSearchOnSelect,

    loading,

    emptyText = DEFAULT_TEXTS.emptyText,
    searchEmptyText = DEFAULT_TEXTS.searchEmptyText,
    errorText = DEFAULT_TEXTS.errorText,
    minSearchText = DEFAULT_TEXTS.minSearchText,
    showEmptyAction,
    emptyActionLabel = DEFAULT_TEXTS.emptyActionLabel,
    onEmptyActionPress,
    renderEmptyState,
    emptyContainerStyle,
    emptyTextStyle,
    emptyActionStyle,
    emptyActionTextStyle,

    groupBy,
    renderSectionHeader,
    isItemDisabled,
    renderTrigger,
    showSelectAll,
    selectAllText = DEFAULT_TEXTS.selectAllText,
    clearAllText = DEFAULT_TEXTS.clearAllText,
    allowCreate,
    onCreateOption,
    createOptionLabel,
    renderItem,
    renderLoading,
    renderLeftAccessory,
    renderRightAccessory,
    renderClearAccessory,
    caretUpIcon,
    caretDownIcon,
    clearIcon,
    leftIcon,
    leftIconStyle,

    showRightAccessory,
    isClearable,
    showClearOnlyWhenHasValue,
    openOnClear,

    highlightSelected,
    autoScrollToSelected,
    initialNumToRender,
    listProps,
    itemHeight,
    virtualizeInline,

    label,
    helperText,
    error,
    required,
    labelStyle,
    helperTextStyle,

    accessibilityLabel,
    testID,
  } = props;

  // --- theme resolution (colorScheme base + partial override)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const systemScheme = useColorScheme();
  const resolvedTheme = useMemo(() => {
    const isDark =
      colorScheme === 'dark' ||
      (colorScheme === 'system' && systemScheme === 'dark');
    // Scale the base for tablet/iPad, THEN apply the user's exact overrides.
    const factor = deviceScale(Math.min(windowWidth, windowHeight));
    const scaledBase = scaleTheme(isDark ? darkTheme : lightTheme, factor);
    const merged = mergeTheme(scaledBase, themeOverride);
    // RTL: explicit prop wins, else theme override, else the device setting.
    return { ...merged, rtl: rtl ?? themeOverride?.rtl ?? I18nManager.isRTL };
  }, [colorScheme, systemScheme, themeOverride, windowWidth, windowHeight, rtl]);

  // --- selection (controlled/uncontrolled single + multi) — see useSelection
  const keyExtractor = useMemo(
    () => makeKeyExtractor<T>(valueKey, customKeyExtractor),
    [valueKey, customKeyExtractor],
  );

  const {
    isSingle,
    value,
    selectedValues,
    hasValue,
    triggerLabel,
    chips,
    isSelectedItem,
    select,
    removeChip,
    clearSelection,
    setMulti,
  } = useSelection<T>({
    mode,
    multiDisplay,
    value: controlledValue,
    defaultValue,
    selectedValues: controlledSelectedValues,
    defaultSelectedValues,
    onChange,
    onChangeMulti,
    maxSelections,
    minSelections,
    labelKey,
    valueKey,
    keyExtractor,
  });

  const showChips = !isSingle && multiDisplay === 'chips';

  // --- open state + measurement
  // Controlled when `open` prop is provided; else internal state.
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? !!openProp : internalOpen;
  const [rect, setRect] = useState<TriggerRect | null>(null);
  const { ref: triggerRef, measure } = useMeasureTrigger();
  const panelRef = useRef<DropdownPanelHandle | null>(null);
  const triggerInputRef = useRef<TextInputInstance | null>(null);
  // Fallback dimensions captured via the trigger's onLayout. Used when
  // measureInWindow returns zeros (Android quirk on the first measure).
  const triggerLayoutRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const keyboard = useKeyboard();

  // Editable mode requires search to be enabled.
  const editableTrigger = isSearch && searchInTrigger;

  // searchInTrigger puts the focused TextInput inside the floating Modal, which
  // the app's ScrollView cannot scroll. When the keyboard would cover the
  // trigger, lift the anchor so the input's bottom sits just above the keyboard
  // (with a small gap). Both the input overlay AND the panel are positioned
  // from this rect, so the whole dropdown rises together above the keyboard.
  const KEYBOARD_GAP = 8;
  const anchorRect = useMemo<TriggerRect | null>(() => {
    if (!rect) return null;
    if (!editableTrigger || !keyboard.visible || keyboard.height <= 0) {
      return rect;
    }
    const usableBottom = windowHeight - keyboard.height;
    const overflow = rect.y + rect.height - (usableBottom - KEYBOARD_GAP);
    if (overflow <= 0) return rect;
    return { ...rect, y: Math.max(edgeMargin, rect.y - overflow) };
  }, [
    rect,
    editableTrigger,
    keyboard.visible,
    keyboard.height,
    windowHeight,
    edgeMargin,
  ]);

  // --- search controller
  const search = useSearch<T>({
    items,
    searchMode,
    minSearchLength,
    debounceMs: searchDebounceMs,
    labelKey,
    filterFunction,
    fetchData,
    onSearchTextChange,
    externalLoading: loading,
    enablePagination,
    pageSize,
  });

  // Rendered list = search results, plus any selected value(s) not present in
  // `items` (prepended, deduped) so off-list defaults still show + highlight.
  const displayItems = useMemo<T[]>(() => {
    const base = search.itemsEffective;
    if (!includeSelectedInList) return base;
    const selected = isSingle ? (value != null ? [value] : []) : selectedValues;
    if (selected.length === 0) return base;
    const missing = selected.filter(
      (sv) =>
        !items.some((it) => isSameValue(it, sv, valueKey)) &&
        !base.some((it) => isSameValue(it, sv, valueKey)),
    );
    return missing.length ? [...missing, ...base] : base;
  }, [
    includeSelectedInList,
    isSingle,
    value,
    selectedValues,
    items,
    search.itemsEffective,
    valueKey,
  ]);

  // --- positioning
  const position = usePositioning({
    rect: anchorRect,
    keyboardHeight: keyboard.height,
    direction,
    allowDirectionFallback,
    requestedHeight: listHeight,
    minListHeight,
    maxListHeight,
    autoAdjustHeight,
    edgeMargin,
  });

  // --- imperative
  /**
   * Combines measureInWindow (for absolute x/y) with the onLayout-captured
   * width/height. measureInWindow occasionally returns 0/0/0/0 on the first
   * call on Android, especially when the trigger contains a TextInput. Using
   * the layout fallback prevents the panel from being positioned at y=0 (which
   * would otherwise cover the trigger).
   */
  const measureWithFallback = useCallback(async () => {
    const r = await measure();
    const layout = triggerLayoutRef.current;
    const merged: TriggerRect = {
      x: r.x,
      y: r.y,
      width: r.width > 0 ? r.width : layout.width,
      height: r.height > 0 ? r.height : layout.height,
    };
    setRect(merged);
    return merged;
  }, [measure]);

  const remeasure = useCallback(async () => {
    await measureWithFallback();
  }, [measureWithFallback]);

  // Stable close identity for the single-open registry (close's deps change
  // across renders; the registry needs one constant reference per instance).
  const closeRef = useRef<() => void>(() => {});
  const stableClose = useRef(() => closeRef.current()).current;

  const maybeAnimate = useCallback(() => {
    if (animated) LayoutAnimation.configureNext(LAYOUT_ANIM);
  }, [animated]);

  const open = useCallback(async () => {
    if (disabled) return;
    // Close any other open dropdown first (only one open at a time).
    registerOpen(stableClose, inline);
    if (loadOnOpen) search.loadInitial();
    await measureWithFallback();
    maybeAnimate();
    // Controlled: let the parent flip `open`; we only request via onOpenChange.
    if (!isControlled) setInternalOpen(true);
    onOpenChange?.(true);
  }, [
    disabled,
    measureWithFallback,
    stableClose,
    inline,
    loadOnOpen,
    search,
    maybeAnimate,
    isControlled,
    onOpenChange,
  ]);

  const close = useCallback(() => {
    unregisterOpen(stableClose);
    maybeAnimate();
    if (!isControlled) setInternalOpen(false);
    onOpenChange?.(false);
    Keyboard.dismiss();
    panelRef.current?.blurSearch();
    if (editableTrigger) {
      triggerInputRef.current?.blur();
      search.resetSearch();
    }
  }, [
    editableTrigger,
    search,
    stableClose,
    maybeAnimate,
    isControlled,
    onOpenChange,
  ]);

  // Controlled: when the parent flips `open` programmatically (not via our
  // open()/close()), measure + register on open and release on close.
  useEffect(() => {
    if (!isControlled) return;
    if (openProp) {
      registerOpen(stableClose, inline);
      if (loadOnOpen) search.loadInitial();
      void measureWithFallback();
    } else {
      unregisterOpen(stableClose);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, openProp]);

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  // Drop our registry slot on unmount so a destroyed instance can't be closed.
  useEffect(() => () => unregisterOpen(stableClose), [stableClose]);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else void open();
  }, [isOpen, open, close]);

  const clear = useCallback(() => {
    clearSelection();
    search.resetSearch();
    Keyboard.dismiss();
    panelRef.current?.blurSearch();
    if (openOnClear) void open();
  }, [clearSelection, search, openOnClear, open]);

  useImperativeHandle(
    ref,
    (): DropdownRef => ({
      open: () => void open(),
      close,
      toggle,
      clear,
      focusSearch: () => panelRef.current?.focusSearch(),
      blurSearch: () => panelRef.current?.blurSearch(),
      remeasure: () => void remeasure(),
      scrollToSelected: () => {
        const target = isSingle ? value : selectedValues[0];
        if (!target) return;
        const index = displayItems.findIndex((it) =>
          isSameValue(it, target, valueKey),
        );
        if (index >= 0) panelRef.current?.scrollToIndex(index);
      },
    }),
    [open, close, toggle, clear, remeasure, isSingle, value, selectedValues, valueKey, displayItems],
  );

  // Re-measure on keyboard transitions while open.
  useEffect(() => {
    if (!isOpen) return;
    void remeasure();
  }, [isOpen, keyboard.visible, keyboard.height, remeasure]);

  // Outside-tap close is handled by markInsideTap (wrapper) + markUserTap (host
  // root) in the open registry — keyboard-independent. Hiding the keyboard via
  // its collapse/Done/Back button produces no app touch, so the list stays open.

  // Inline + keyboard: scroll the HOST ScrollView so the focused field sits high
  // enough that the list BELOW it clears the keyboard (KeyboardAwareScrollView
  // technique). `scrollResponderScrollNativeHandleToKeyboard(node, offset, ...)`
  // scrolls so `node` ends up `offset` px above the keyboard — we use the list
  // height as the offset, leaving exactly enough room for the list underneath.
  useEffect(() => {
    if (!inline || !isOpen || !keyboard.visible) return;
    const sv = scrollRef?.current as
      | {
          scrollResponderScrollNativeHandleToKeyboard?: (
            node: number,
            offset: number,
            prevent: boolean,
          ) => void;
          getScrollResponder?: () => {
            scrollResponderScrollNativeHandleToKeyboard?: (
              node: number,
              offset: number,
              prevent: boolean,
            ) => void;
          };
        }
      | null
      | undefined;
    const node = triggerRef.current ? findNodeHandle(triggerRef.current) : null;
    if (!sv || node == null) return;
    // scrollResponderScrollNativeHandleToKeyboard reveals the node `offset` px
    // above the keyboard, anchored on the node's TOP. The list renders BELOW the
    // trigger, so the offset must reserve the trigger's own height + the list
    // height + a gap, or the list's bottom lands under the keyboard. Keep this in
    // sync with `inlineMaxHeight` (same INLINE_TRIGGER_RESERVE / INLINE_LIST_GAP).
    const triggerH = rect?.height ?? 56;
    const listH = Math.max(
      120,
      Math.min(listHeight, keyboard.screenY - INLINE_TRIGGER_RESERVE),
    );
    const offset = listH + triggerH + INLINE_LIST_GAP;
    const reveal = () => {
      const fn =
        sv.scrollResponderScrollNativeHandleToKeyboard ??
        sv.getScrollResponder?.()?.scrollResponderScrollNativeHandleToKeyboard;
      fn?.(node, offset, true);
    };
    const t = setTimeout(reveal, 60);
    return () => clearTimeout(t);
  }, [
    inline,
    isOpen,
    keyboard.visible,
    keyboard.screenY,
    listHeight,
    scrollRef,
    triggerRef,
    rect,
  ]);

  // Auto-scroll to selected ONCE per open. The ref guard prevents re-scrolling
  // on every selection change (which would yank a multi-select list back to
  // selectedValues[0] = the first selected item, i.e. the top, after each pick).
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      didAutoScrollRef.current = false;
      return;
    }
    if (!autoScrollToSelected || didAutoScrollRef.current) return;
    didAutoScrollRef.current = true;
    const target = isSingle ? value : selectedValues[0];
    if (!target) return;
    const index = displayItems.findIndex((it) =>
      isSameValue(it, target, valueKey),
    );
    if (index >= 0) {
      // wait one tick for FlatList to mount
      const t = setTimeout(() => panelRef.current?.scrollToIndex(index), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, autoScrollToSelected, isSingle, value, selectedValues, displayItems, valueKey]);

  // --- selection handler: update selection (via hook), then layer UI effects.
  const handleSelect = useCallback(
    (item: T) => {
      // Multi adds a chip → animate the trigger height/anchor change.
      if (!isSingle) maybeAnimate();
      select(item);
      // Clear the typed search after a pick so the user can search for the next
      // item (multi stays open). Single closes anyway; panel search also resets.
      // Opt out with `persistSearchOnSelect` to keep the query after a pick.
      if (isSearch && !persistSearchOnSelect) {
        search.resetSearch();
      }
      if (closeOnSelect) close();
    },
    [
      select,
      editableTrigger,
      search,
      closeOnSelect,
      close,
      isSingle,
      maybeAnimate,
      persistSearchOnSelect,
    ],
  );

  const handleRemoveChip = useCallback(
    (index: number) => {
      maybeAnimate();
      removeChip(index);
    },
    [removeChip, maybeAnimate],
  );

  // --- keyboard navigation (arrow / enter / esc) — web + hardware keyboard.
  // Native touch never emits these keys, so this is purely additive.
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  // Reset the highlight when opening/closing or the query changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [isOpen, search.searchText]);

  const handleKeyPress = useCallback(
    (e: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => {
      const key = e?.nativeEvent?.key;
      if (!key) return;
      const n = displayItems.length;
      if (key === 'ArrowDown') {
        e.preventDefault?.();
        setActiveIndex((i) => {
          const ni = Math.min((i < 0 ? -1 : i) + 1, n - 1);
          if (ni >= 0) panelRef.current?.scrollToIndex(ni);
          return ni;
        });
      } else if (key === 'ArrowUp') {
        e.preventDefault?.();
        setActiveIndex((i) => {
          const ni = Math.max((i <= 0 ? 0 : i - 1), 0);
          panelRef.current?.scrollToIndex(ni);
          return ni;
        });
      } else if (key === 'Enter') {
        const i = activeIndexRef.current;
        if (i >= 0 && i < n) {
          const item = displayItems[i];
          if (!(isItemDisabled && isItemDisabled(item))) handleSelect(item);
        }
      } else if (key === 'Escape') {
        close();
      }
    },
    [displayItems, isItemDisabled, handleSelect, close],
  );

  // --- validation (min/max selections + required)
  const isValid = useMemo(() => {
    if (isSingle) return required ? hasValue : true;
    const n = selectedValues.length;
    if (minSelections != null && n < minSelections) return false;
    if (maxSelections != null && n > maxSelections) return false;
    return required ? n > 0 : true;
  }, [
    isSingle,
    required,
    hasValue,
    selectedValues,
    minSelections,
    maxSelections,
  ]);
  const prevValidRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevValidRef.current !== isValid) {
      prevValidRef.current = isValid;
      onValidityChange?.(isValid);
    }
  }, [isValid, onValidityChange]);

  // --- accessory visibility
  const showClear =
    isClearable &&
    !disabled &&
    (showClearOnlyWhenHasValue ? hasValue : true);

  // Custom empty render override
  const customEmpty = renderEmptyState
    ? renderEmptyState({
        status: search.status,
        searchText: search.searchText,
        onActionPress: onEmptyActionPress,
      })
    : null;

  // Editable-trigger handlers. The overlay's TextInput drives the search.
  const handleTriggerChangeText = useCallback(
    (text: string) => {
      search.setSearchText(text);
    },
    [search],
  );

  // Shared visual props so the in-modal overlay matches the main-app trigger.
  const sharedTriggerProps = {
    label: triggerLabel,
    placeholder,
    isOpen,
    disabled,
    hasValue,
    value,
    selectedValues,
    showRight: showRightAccessory,
    showClear,
    renderLeft: renderLeftAccessory,
    renderRight: renderRightAccessory,
    renderClear: renderClearAccessory,
    caretUpIcon,
    caretDownIcon,
    clearIcon,
    leftIcon,
    leftIconStyle,
    hasError: !!error,
    style: triggerStyle,
    textStyle: triggerTextStyle,
    placeholderStyle,
    showChips,
    chips,
    onRemoveChip: handleRemoveChip,
    chipStyle,
    chipTextStyle,
    maxVisibleChips,
  } as const;

  // Form-field chrome (label / helper / error) wrapped around the trigger.
  const fieldProps = {
    label,
    required,
    helperText,
    error,
    labelStyle,
    helperTextStyle,
    testID,
  };

  // Custom trigger (non-editable only). Wraps the user's node in a measurable
  // View; opening is wired via the params (open/toggle).
  const onMainTriggerLayout = (layout: { width: number; height: number }) => {
    triggerLayoutRef.current = layout;
    setRect((prev) => {
      if (!prev) return prev;
      const width = prev.width || layout.width;
      const height = layout.height || prev.height;
      if (prev.width === width && prev.height === height) return prev;
      return { ...prev, width, height };
    });
  };
  const useCustomTrigger = !!renderTrigger && !editableTrigger;
  const customTriggerNode = useCustomTrigger ? (
    <RNView
      ref={triggerRef as React.Ref<ViewInstance>}
      collapsable={false}
      onLayout={(e) => onMainTriggerLayout(e.nativeEvent.layout)}>
      {renderTrigger!({
        isOpen,
        disabled,
        hasValue,
        value,
        selectedValues,
        label: triggerLabel,
        placeholder,
        open: () => void open(),
        close,
        toggle,
        clear,
      })}
    </RNView>
  ) : null;

  // Inline mode renders the editable trigger as a real in-page input (no Modal
  // overlay), so the host ScrollView can scroll the whole UI above the keyboard.
  const mainTriggerEditable = inline && editableTrigger;

  // --- multi select-all / clear-all
  const selectableItems = useMemo(
    () => (isItemDisabled ? items.filter((it) => !isItemDisabled(it)) : items),
    [items, isItemDisabled],
  );
  const allSelected =
    !isSingle &&
    selectableItems.length > 0 &&
    selectableItems.every((it) =>
      selectedValues.some((v) => isSameValue(v, it, valueKey)),
    );
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      setMulti(
        maxSelections != null
          ? selectableItems.slice(0, maxSelections)
          : selectableItems,
      );
    }
  }, [allSelected, clearSelection, setMulti, selectableItems, maxSelections]);

  const selectAllHeader =
    !isSingle && showSelectAll ? (
      <SelectAllRow
        allSelected={allSelected}
        onToggle={toggleSelectAll}
        selectAllText={selectAllText}
        clearAllText={clearAllText}
        testID={testID ? `${testID}-select-all` : undefined}
      />
    ) : undefined;

  // --- create-new / taggable row
  const trimmedSearch = search.searchText.trim();
  const hasExactMatch =
    trimmedSearch.length > 0 &&
    items.some(
      (it) =>
        getLabel(it, labelKey).toLowerCase() === trimmedSearch.toLowerCase(),
    );
  const canCreate =
    !!allowCreate &&
    !!onCreateOption &&
    trimmedSearch.length > 0 &&
    !hasExactMatch;
  const createRow = canCreate ? (
    <CreateRow
      label={
        createOptionLabel
          ? createOptionLabel(trimmedSearch)
          : `Add "${trimmedSearch}"`
      }
      onPress={() => {
        handleSelect(onCreateOption!(trimmedSearch));
        search.resetSearch();
      }}
      testID={testID ? `${testID}-create` : undefined}
    />
  ) : null;

  const listHeader =
    selectAllHeader || createRow ? (
      <>
        {selectAllHeader}
        {createRow}
      </>
    ) : undefined;

  // Stable row accessors so the memoized panel/rows don't re-reconcile when an
  // unrelated parent render occurs.
  const labelOf = useCallback((it: T) => getLabel(it, labelKey), [labelKey]);
  const descOf = useMemo(
    () =>
      descriptionKey ? (it: T) => getLabel(it, descriptionKey) : undefined,
    [descriptionKey],
  );
  const imageOf = useMemo(
    () => (imageKey ? (it: T) => getLabel(it, imageKey) : undefined),
    [imageKey],
  );

  // Common DropdownPanel props shared by both render modes.
  const panelCommon = {
    status: search.status,
    isSearch,
    showSearchRow: !editableTrigger,
    searchText: search.searchText,
    onSearchTextChange: search.setSearchText,
    onSearchKeyPress: handleKeyPress,
    activeIndex,
    searchPlaceholder,
    // Inline panel-search has no editable trigger to focus, so nothing opens the
    // keyboard — and without the keyboard the host never scrolls, leaving the
    // in-flow list below the fold. Auto-focus the in-panel search row on open so
    // the keyboard fires and the reveal effect scrolls the list into view.
    autoFocusSearch:
      autoFocusSearch || (inline && isSearch && !editableTrigger),
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
    shrinkToContent,
    minListHeight,
    getLabel: labelOf,
    getDescription: descOf,
    getImageUri: imageOf,
    renderRowLeft,
    keyExtractor,
    isSelectedItem,
    onSelectItem: handleSelect,
    groupBy,
    renderSectionHeader,
    isItemDisabled,
    listHeader,
    highlightSelected,
    initialNumToRender,
    listProps,
    itemHeight,
    virtualizeInline,
    onLoadMore: search.loadMore,
    paginating: search.paginating,
    testID: testID ? `${testID}-panel` : undefined,
  } as const;

  const renderPanel = (
    pos: PositioningResult,
    panelStyle?: object,
    inlineMaxHeight?: number,
  ) => {
    const isCustomEmpty = !!customEmpty && displayItems.length === 0;
    return (
      <DropdownPanel<T>
        ref={panelRef}
        position={pos}
        inline={inline}
        inlineMaxHeight={inlineMaxHeight}
        style={panelStyle}
        items={isCustomEmpty ? [] : displayItems}
        renderItem={isCustomEmpty ? () => customEmpty : renderItem}
        renderLoading={renderLoading}
        {...panelCommon}
      />
    );
  };

  // ----- Inline mode: trigger + in-flow panel, no Modal -----
  if (inline) {
    const inlinePosition: PositioningResult = {
      direction: 'down',
      top: 0,
      left: 0,
      width: rect?.width ?? 0,
      height: listHeight,
      spaceAbove: 0,
      spaceBelow: 0,
    };
    // The list opens DOWNWARD (input on top, list below — natural reading order).
    // Visibility above the keyboard is handled by scrolling the HOST ScrollView
    // so the field sits high enough to leave room for the list (reveal effect
    // above). Cap the list to the space above the keyboard so it never exceeds
    // it; extra items scroll inside the bounded ScrollView.
    // Cap to the space above the keyboard. Must match the reveal effect's `listH`
    // so the host scroll leaves room for exactly this list height + a gap.
    const inlineMaxHeight = keyboard.visible
      ? Math.max(
          120,
          Math.min(listHeight, keyboard.screenY - INLINE_TRIGGER_RESERVE),
        )
      : listHeight;
    // onTouchStart fires here (child) BEFORE the host root's markUserTap, so a
    // tap inside the open dropdown is recognized as "inside" and won't close it.
    return (
      <ThemeProvider value={resolvedTheme}>
      <Field {...fieldProps}>
      <RNView onTouchStart={markInsideTap}>
        {useCustomTrigger ? (
          customTriggerNode
        ) : (
        <Trigger<T>
          ref={triggerRef as React.Ref<ViewInstance>}
          {...sharedTriggerProps}
          editable={mainTriggerEditable}
          inputValue={mainTriggerEditable ? search.searchText : undefined}
          onChangeText={
            mainTriggerEditable ? handleTriggerChangeText : undefined
          }
          inputRef={mainTriggerEditable ? triggerInputRef : undefined}
          onInputFocus={mainTriggerEditable ? () => void open() : undefined}
          onInputKeyPress={mainTriggerEditable ? handleKeyPress : undefined}
          onRightPress={mainTriggerEditable ? toggle : undefined}
          onPress={editableTrigger ? () => void open() : toggle}
          onClear={clear}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onLayout={(layout) => {
            triggerLayoutRef.current = layout;
          }}
        />
        )}
        {isOpen ? renderPanel(inlinePosition, undefined, inlineMaxHeight) : null}
      </RNView>
      </Field>
      </ThemeProvider>
    );
  }

  // ----- Modal mode (default): floating panel in a Modal overlay -----
  return (
    <ThemeProvider value={resolvedTheme}>
      <Field {...fieldProps}>
      {/* Main-app trigger: ALWAYS non-editable. Tapping opens the Modal. */}
      {useCustomTrigger ? (
        customTriggerNode
      ) : (
      <Trigger<T>
        ref={triggerRef as React.Ref<ViewInstance>}
        {...sharedTriggerProps}
        onPress={editableTrigger ? () => void open() : toggle}
        onClear={clear}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onLayout={(layout) => {
          triggerLayoutRef.current = layout;
          // Keep the rect height in sync with the trigger's CURRENT height so
          // that as multi-select chips wrap and the trigger grows taller, the
          // anchor re-lifts above the keyboard (and the panel re-anchors). Guard
          // against no-op updates to avoid a layout<->setState loop.
          setRect((prev) => {
            if (!prev) return prev;
            const width = prev.width || layout.width;
            const height = layout.height || prev.height;
            if (prev.width === width && prev.height === height) return prev;
            return { ...prev, width, height };
          });
        }}
      />
      )}
      </Field>

      <DropdownModal
        visible={isOpen}
        showOverlay={showOverlay}
        overlayColor={overlayColor ?? resolvedTheme.colors.overlay}
        closeOnOutsidePress={closeOnOutsidePress}
        onRequestClose={close}
        testID={testID ? `${testID}-modal` : undefined}
      >
        {/*
          In-modal editable trigger overlay. Lives INSIDE the Modal so it shares
          the Modal's window focus — on Android the keyboard would otherwise
          dismiss when the Modal opens because the main-app window loses focus.
        */}
        {editableTrigger && anchorRect ? (
          <RNView
            style={{
              position: 'absolute',
              top: anchorRect.y,
              left: anchorRect.x,
              width: anchorRect.width,
            }}
          >
            <Trigger<T>
              {...sharedTriggerProps}
              editable
              autoFocusInput
              inputValue={search.searchText}
              onChangeText={handleTriggerChangeText}
              onInputKeyPress={handleKeyPress}
              inputRef={triggerInputRef}
              onPress={() => {
                // overlay is already open; just refocus the input
                triggerInputRef.current?.focus();
              }}
              onClear={clear}
              testID={testID ? `${testID}-overlay` : undefined}
            />
          </RNView>
        ) : null}

        {position ? renderPanel(position) : null}
      </DropdownModal>
    </ThemeProvider>
  );
}

export const DropdownSelect = forwardRef(DropdownSelectInner) as <T>(
  props: DropdownSelectProps<T> & { ref?: React.Ref<DropdownRef> },
) => React.ReactElement;
