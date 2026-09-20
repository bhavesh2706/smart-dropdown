import React, {useMemo, useRef, useState} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  LogBox,
  useColorScheme,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  DropdownSelect,
  type DropdownRef,
  markUserTap,
  closeOpenDropdowns,
} from '../../src';

// `virtualizeInline` deliberately nests a FlatList in the host ScrollView so the
// inline list can window large datasets AND paginate (onEndReached). RN logs the
// generic nesting warning for this; it's benign here (see PROJECT_STATE §7) and
// dev-only, so silence just that one message to keep the demo clean.
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

type Fruit = {id: number; label: string};

const FRUITS: Fruit[] = [
  {id: 1, label: 'Apple'},
  {id: 2, label: 'Banana'},
  {id: 3, label: 'Cherry'},
  {id: 4, label: 'Date'},
  {id: 5, label: 'Elderberry'},
  {id: 6, label: 'Fig'},
  {id: 7, label: 'Grape'},
  {id: 8, label: 'Honeydew'},
  {id: 9, label: 'Kiwi'},
  {id: 10, label: 'Lemon'},
  {id: 11, label: 'Mango'},
  {id: 12, label: 'Nectarine'},
  {id: 13, label: 'Orange'},
  {id: 14, label: 'Papaya'},
  {id: 15, label: 'Quince'},
  {id: 16, label: 'Raspberry'},
  {id: 17, label: 'Strawberry'},
  {id: 18, label: 'Tangerine'},
];

// Large dataset for remote pagination + virtualization demos.
const REMOTE_POOL: Fruit[] = Array.from({length: 87}, (_, i) => ({
  id: 1000 + i,
  label: `Result ${i + 1}`,
}));
const REMOTE_PAGE_SIZE = 15;
const BIG_LIST: Fruit[] = Array.from({length: 200}, (_, i) => ({
  id: 5000 + i,
  label: `Item ${i + 1}`,
}));

function fakeRemoteSearch(text: string, page = 1): Promise<Fruit[]> {
  return new Promise(resolve => {
    setTimeout(() => {
      const lower = text.toLowerCase();
      const matches = REMOTE_POOL.filter(f =>
        f.label.toLowerCase().includes(lower),
      );
      const start = (page - 1) * REMOTE_PAGE_SIZE;
      resolve(matches.slice(start, start + REMOTE_PAGE_SIZE));
    }, 600);
  });
}

/** One feature per card: title + short description of the props shown. */
function Demo({
  n,
  title,
  desc,
  children,
  dark,
}: {
  n: number;
  title: string;
  desc: string;
  children: React.ReactNode;
  /** Force a dark card (e.g. colorScheme="dark" demo). Also auto when OS is dark. */
  dark?: boolean;
}) {
  // Match card chrome to OS appearance. Default colorScheme="system" paints
  // label/helper with dark-theme text; a light card made those labels invisible.
  const systemDark = useColorScheme() === 'dark';
  const onDark = dark || systemDark;
  return (
    <View style={[styles.section, onDark && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, onDark && styles.textOnDark]}>
        {n}. {title}
      </Text>
      <Text style={[styles.sectionDesc, onDark && styles.descOnDark]}>{desc}</Text>
      {children}
    </View>
  );
}

function App(): React.JSX.Element {
  // Auto-incrementing demo number so cards can be reordered freely.
  let step = 0;
  const N = () => ++step;

  const isDark = useColorScheme() === 'dark';
  const chrome = useMemo(
    () => ({
      root: [styles.root, isDark && styles.rootDark],
      title: [styles.title, isDark && styles.textOnDark],
      subtitle: [styles.subtitle, isDark && styles.descOnDark],
      group: [styles.group, isDark && styles.groupDark],
      helper: [styles.helper, isDark && styles.descOnDark],
      customRowText: [styles.customRowText, isDark && styles.textOnDark],
      sectionHeader: [styles.sectionHeader, isDark && styles.sectionHeaderDark],
      sectionHeaderText: [
        styles.sectionHeaderText,
        isDark && styles.sectionHeaderTextDark,
      ],
    }),
    [isDark],
  );

  const scrollRef = useRef<ScrollView>(null);
  const imperativeRef = useRef<DropdownRef>(null);

  // Per-demo state
  const [single, setSingle] = useState<Fruit | null>(null);
  const [multiCount, setMultiCount] = useState<Fruit[]>([]);
  const [multiChips, setMultiChips] = useState<Fruit[]>([
    FRUITS[0],
    FRUITS[1],
    FRUITS[2],
    FRUITS[4],
  ]);
  const [selectAllSel, setSelectAllSel] = useState<Fruit[]>([]);
  const [overflowSel, setOverflowSel] = useState<Fruit[]>(FRUITS.slice(0, 6));
  const [minMax, setMinMax] = useState<Fruit[]>([FRUITS[0]]);
  const [reqFruit, setReqFruit] = useState<Fruit | null>(null);
  const [multiSearch, setMultiSearch] = useState<Fruit[]>([]);
  const [taggable, setTaggable] = useState<Fruit | null>(null);
  const [offList, setOffList] = useState<Fruit | null>({
    id: 999,
    label: 'Saved value (not in list)',
  });
  const [ctrlOpen, setCtrlOpen] = useState(false);

  return (
    <SafeAreaView style={chrome.root}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#000' : '#fff'}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        // Inline outside-tap close: a tap that reaches the host root WITHOUT
        // passing through the open dropdown closes it; a host scroll closes it too.
        onTouchStart={markUserTap}
        onScrollBeginDrag={closeOpenDropdowns}>
        <Text style={chrome.title}>react-native-smart-dropdown</Text>
        <Text style={chrome.subtitle}>
          One demo per feature · zero runtime deps
        </Text>

        {/* ───────── Selection ───────── */}
        <Text style={chrome.group}>SELECTION</Text>

        <Demo n={N()} title="Single select" desc="Basic controlled single select.">
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            value={single}
            onChange={setSingle}
            placeholder="Pick a fruit"
            testID="dd-single"
          />
          <Text style={chrome.helper}>
            Selected: {single ? single.label : '(none)'}
          </Text>
        </Demo>

        <Demo
          n={N()}
          title="Multi-select · count"
          desc='mode="multi" — trigger shows an "N selected" summary.'>
          <DropdownSelect<Fruit>
            mode="multi"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            selectedValues={multiCount}
            onChangeMulti={setMultiCount}
            placeholder="Pick several"
            testID="dd-multi-count"
          />
        </Demo>

        <Demo
          n={N()}
          title="Multi-select · chips (all visible)"
          desc='multiDisplay="chips", no cap — every selected item shows as a removable pill that wraps.'>
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            selectedValues={multiChips}
            onChangeMulti={setMultiChips}
            placeholder="Pick several"
            testID="dd-multi-chips"
          />
        </Demo>

        <Demo
          n={N()}
          title="Select-all / Unselect-all"
          desc="showSelectAll — header toggles between Select all and Clear all (unselect)."
          >
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            showSelectAll
            selectedValues={selectAllSel}
            onChangeMulti={setSelectAllSel}
            placeholder="Open → Select all"
            testID="dd-selectall"
          />
          <Text style={chrome.helper}>{selectAllSel.length} selected</Text>
        </Demo>

        <Demo
          n={N()}
          title="Min / max + validation"
          desc="minSelections={1} maxSelections={3} — blocks under-min, caps at max."
          >
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            selectedValues={minMax}
            onChangeMulti={setMinMax}
            minSelections={1}
            maxSelections={3}
            placeholder="1–3 fruits"
            testID="dd-minmax"
          />
        </Demo>

        <Demo
          n={N()}
          title="Chip overflow"
          desc='maxVisibleChips={3} — extras collapse into a "+N more" pill.'>
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            selectedValues={overflowSel}
            onChangeMulti={setOverflowSel}
            maxVisibleChips={3}
            placeholder="Pick several"
            testID="dd-overflow"
          />
        </Demo>

        <Demo
          n={N()}
          title="Off-list selected value"
          desc="includeSelectedInList (default) — a saved value not in items is injected + highlighted."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            value={offList}
            onChange={setOffList}
            placeholder="Has off-list value"
            testID="dd-offlist"
          />
        </Demo>

        {/* ───────── Search ───────── */}
        <Text style={chrome.group}>SEARCH</Text>

        <Demo
          n={N()}
          title="Local search (panel)"
          desc="isSearch + searchMode='local' — search row inside the panel; inline + scrollRef so the page scrolls above the keyboard."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchMode="local"
            searchPlaceholder="Type to filter"
            placeholder="Tap, then search"
            testID="dd-search-panel"
          />
        </Demo>

        <Demo
          n={N()}
          title="Trigger-as-search (autocomplete)"
          desc="searchInTrigger — the trigger itself is the search input; inline + scrollRef so the page scrolls above the keyboard."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchInTrigger
            searchMode="local"
            leftIcon={<Text style={{fontSize: 16}}>🔍</Text>}
            placeholder="Type to search fruits"
            testID="dd-autocomplete"
          />
        </Demo>

        <Demo
          n={N()}
          title="Hybrid search (local + remote)"
          desc="searchMode='hybrid' — local matches first, remote results merged in; inline + scrollRef so the page scrolls above the keyboard."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchInTrigger
            searchMode="hybrid"
            minSearchLength={1}
            fetchData={fakeRemoteSearch}
            placeholder="Local + remote"
            testID="dd-hybrid"
          />
        </Demo>

        <Demo
          n={N()}
          title="Remote search · pagination"
          desc="searchMode='remote' + enablePagination + loadOnOpen — inline + scrollRef so the whole page scrolls above the keyboard; virtualizeInline keeps infinite scroll."
          >
          <DropdownSelect<Fruit>
            items={[]}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            virtualizeInline
            itemHeight={48}
            isSearch
            searchInTrigger
            searchMode="remote"
            minSearchLength={0}
            loadOnOpen
            searchDebounceMs={300}
            fetchData={fakeRemoteSearch}
            enablePagination
            pageSize={REMOTE_PAGE_SIZE}
            listHeight={260}
            renderLoading={() => (
              <Text style={styles.loader}>⏳ Fetching results…</Text>
            )}
            placeholder="Opens with results"
            emptyText="Start typing to search"
            testID="dd-remote"
          />
        </Demo>

        <Demo
          n={N()}
          title="Create new / taggable"
          desc="allowCreate + onCreateOption — type a value not in the list to add it; inline + scrollRef so the page scrolls above the keyboard."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchInTrigger
            searchMode="local"
            allowCreate
            onCreateOption={text => ({id: Date.now(), label: text})}
            value={taggable}
            onChange={setTaggable}
            placeholder="Type to add a new fruit"
            testID="dd-taggable"
          />
        </Demo>

        <Demo
          n={N()}
          title="Multi-select · searchable"
          desc='mode="multi" + isSearch + searchInTrigger — chips with autocomplete; query clears after each pick (default).'
          >
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchInTrigger
            searchMode="local"
            selectedValues={multiSearch}
            onChangeMulti={setMultiSearch}
            placeholder="Type to search, pick several"
            testID="dd-multi-search"
          />
        </Demo>

        <Demo
          n={N()}
          title="Persist search on select"
          desc="persistSearchOnSelect (opt-in) — keeps the query after each pick; inline + scrollRef so the page scrolls above the keyboard."
          >
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchInTrigger
            searchMode="local"
            persistSearchOnSelect
            placeholder="Search keeps text after pick"
            testID="dd-persist"
          />
        </Demo>

        {/* ───────── List content ───────── */}
        <Text style={chrome.group}>LIST CONTENT</Text>

        <Demo
          n={N()}
          title="Grouped + custom header"
          desc="groupBy + renderSectionHeader — custom sticky section headers."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            groupBy={f => f.label[0]}
            renderSectionHeader={g => (
              <View style={chrome.sectionHeader}>
                <Text style={chrome.sectionHeaderText}>{g} —</Text>
              </View>
            )}
            placeholder="Grouped by letter"
            testID="dd-grouped"
          />
        </Demo>

        <Demo
          n={N()}
          title="Per-item disabled"
          desc="isItemDisabled — greyed, non-selectable ('Date' here)."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            isItemDisabled={f => f.label === 'Date'}
            placeholder="Date is disabled"
            testID="dd-disabled"
          />
        </Demo>

        <Demo
          n={N()}
          title="Subtitle + avatar"
          desc="descriptionKey (subtitle) + imageKey (left avatar URI)."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            descriptionKey={f => `Fruit #${f.id}`}
            imageKey={f => `https://i.pravatar.cc/64?img=${f.id}`}
            placeholder="Rich rows"
            testID="dd-rich"
          />
        </Demo>

        <Demo
          n={N()}
          title="Custom row (renderItem)"
          desc="renderItem — fully custom row markup."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            renderItem={({item, isSelected, onPress}) => (
              <TouchableOpacity onPress={onPress} style={styles.customRow}>
                <View
                  style={[
                    styles.dot,
                    {backgroundColor: isSelected ? '#0a7' : '#bbb'},
                  ]}
                />
                <Text style={chrome.customRowText}>{item.label}</Text>
                {isSelected ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            )}
            placeholder="Custom rows"
            testID="dd-renderitem"
          />
        </Demo>

        {/* ───────── Form ───────── */}
        <Text style={chrome.group}>FORM FIELD</Text>

        <Demo
          n={N()}
          title="Label · required · error"
          desc="label + required + error — error clears once a value is picked."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            label="Favorite fruit"
            required
            helperText="Choose your favorite"
            value={reqFruit}
            onChange={setReqFruit}
            error={reqFruit ? undefined : 'This field is required'}
            placeholder="Tap to open"
            testID="dd-form"
          />
        </Demo>

        {/* ───────── Theming ───────── */}
        <Text style={chrome.group}>THEMING & ICONS</Text>

        <Demo
          n={N()}
          title="Theme override (colors)"
          desc="theme={{colors:{...}}} — accent, chips, radii overridden.">
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            theme={{
              colors: {chipBg: '#0a7', accent: '#0a7', rowSelected: '#e6fff6'},
              radii: {sm: 14, md: 14},
            }}
            placeholder="Teal theme"
            testID="dd-theme"
          />
        </Demo>

        <Demo n={N()} title="Dark mode" desc='colorScheme="dark" — built-in dark palette.' dark>
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            colorScheme="dark"
            placeholder="Dark dropdown"
            testID="dd-dark"
          />
        </Demo>

        <Demo
          n={N()}
          title="Custom font"
          desc="theme={{fonts:{regular:'monospace'}}} — family-only (iOS-safe).">
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            theme={{fonts: {regular: 'monospace'}}}
            placeholder="Monospace font"
            testID="dd-font"
          />
        </Demo>

        <Demo
          n={N()}
          title="Custom icons"
          desc="caretDownIcon / caretUpIcon / clearIcon — any node (emoji here)."
          >
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            value={single}
            onChange={setSingle}
            caretDownIcon={<Text>🔽</Text>}
            caretUpIcon={<Text>🔼</Text>}
            clearIcon={<Text>❎</Text>}
            placeholder="Custom caret + clear"
            testID="dd-icons"
          />
        </Demo>

        <Demo
          n={N()}
          title="RTL"
          desc="rtl — mirrors layout + right-aligns text (Arabic/Hebrew).">
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            rtl
            placeholder="يبحث (RTL)"
            testID="dd-rtl"
          />
        </Demo>

        {/* ───────── Positioning & render ───────── */}
        <Text style={chrome.group}>POSITIONING & RENDER</Text>

        <Demo
          n={N()}
          title="Direction · forced up"
          desc='direction="up" — always opens above the trigger.'>
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            direction="up"
            placeholder="Opens upward"
            testID="dd-up"
          />
        </Demo>

        <Demo
          n={N()}
          title="Inline mode"
          desc="inline + scrollRef — panel renders in-flow (pushes content), keyboard-aware.">
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            isSearch
            searchInTrigger
            searchMode="local"
            listHeight={220}
            placeholder="Inline (in-flow) list"
            testID="dd-inline"
          />
        </Demo>

        <Demo
          n={N()}
          title="Virtualized + itemHeight"
          desc="virtualizeInline + itemHeight (200 items) — windowed list, smooth scroll.">
          <DropdownSelect<Fruit>
            items={BIG_LIST}
            labelKey="label"
            valueKey="id"
            inline
            scrollRef={scrollRef}
            virtualizeInline
            itemHeight={44}
            isSearch
            searchInTrigger
            searchMode="local"
            listHeight={220}
            placeholder="200 items, virtualized"
            testID="dd-virtual"
          />
        </Demo>

        <Demo
          n={N()}
          title="Animated"
          desc="animated — LayoutAnimation on open/close + chip changes.">
          <DropdownSelect<Fruit>
            mode="multi"
            multiDisplay="chips"
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            animated
            placeholder="Animated open/close"
            testID="dd-animated"
          />
        </Demo>

        <Demo
          n={N()}
          title="Custom trigger"
          desc="renderTrigger — fully custom trigger; wire open via params.">
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            placeholder="Custom trigger"
            renderTrigger={({toggle, label, placeholder, isOpen}) => (
              <TouchableOpacity onPress={toggle} style={styles.customTrigger}>
                <Text style={styles.customTriggerText}>
                  {label || placeholder}
                </Text>
                <Text style={styles.customTriggerText}>{isOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            )}
            testID="dd-render-trigger"
          />
        </Demo>

        <Demo
          n={N()}
          title="Controlled open"
          desc="open + onOpenChange — opened from external buttons.">
          <DropdownSelect<Fruit>
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            open={ctrlOpen}
            onOpenChange={setCtrlOpen}
            placeholder="Controlled by buttons"
            testID="dd-controlled"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => setCtrlOpen(true)} style={styles.button}>
              <Text style={styles.buttonText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCtrlOpen(false)} style={styles.button}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Demo>

        <Demo
          n={N()}
          title="Imperative ref"
          desc="ref.open() / close() / clear() — control via the DropdownRef.">
          <DropdownSelect<Fruit>
            ref={imperativeRef}
            items={FRUITS}
            labelKey="label"
            valueKey="id"
            placeholder="Open me from the buttons"
            testID="dd-imperative"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => imperativeRef.current?.open()} style={styles.button}>
              <Text style={styles.buttonText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => imperativeRef.current?.close()} style={styles.button}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => imperativeRef.current?.clear()} style={styles.button}>
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </Demo>

        {/* ───────── States ───────── */}
        <Text style={chrome.group}>STATES</Text>

        <Demo
          n={N()}
          title="Empty list + action"
          desc="emptyText + showEmptyAction — empty state with an action button.">
          <DropdownSelect<Fruit>
            items={[]}
            labelKey="label"
            valueKey="id"
            placeholder="No options"
            emptyText="No fruits yet"
            showEmptyAction
            emptyActionLabel="Add fruit"
            onEmptyActionPress={() => Alert.alert('Add-fruit action pressed!')}
            testID="dd-empty"
          />
        </Demo>

        <View style={{height: 48}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F4F6F8'},
  rootDark: {backgroundColor: '#000'},
  container: {padding: 16},
  title: {fontSize: 22, fontWeight: '700', color: '#111'},
  subtitle: {fontSize: 13, color: '#666', marginBottom: 8},
  group: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A8E',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  groupDark: {color: '#8E8E93'},
  section: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionDark: {backgroundColor: '#1C1C1E'},
  sectionTitle: {fontSize: 15, fontWeight: '600', color: '#222'},
  sectionDesc: {fontSize: 12, color: '#777', marginBottom: 10, marginTop: 2},
  textOnDark: {color: '#F2F2F7'},
  descOnDark: {color: '#AEAEB2'},
  helper: {marginTop: 8, fontSize: 12, color: '#666'},
  loader: {color: '#7C3AED', fontWeight: '600'},
  buttonRow: {flexDirection: 'row', marginTop: 10, gap: 8},
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  buttonText: {color: '#fff', fontWeight: '600'},
  customTrigger: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customTriggerText: {color: '#fff', fontWeight: '600'},
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: {width: 10, height: 10, borderRadius: 5, marginRight: 12},
  customRowText: {flex: 1, fontSize: 15, color: '#222'},
  check: {color: '#0a7', fontWeight: '700'},
  sectionHeader: {
    backgroundColor: '#EEF',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sectionHeaderDark: {backgroundColor: '#2C2C2E'},
  sectionHeaderText: {fontSize: 12, fontWeight: '700', color: '#55c'},
  sectionHeaderTextDark: {color: '#A5B4FC'},
});

export default App;
