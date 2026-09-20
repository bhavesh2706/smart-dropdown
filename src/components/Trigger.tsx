import React, {forwardRef, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type TextInputInstance,
  type TextInputKeyPressEvent,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import type {AccessoryParams} from '../types';
import {useTheme, fontFor, textDir, rowDir, type DropdownTheme} from '../theme';
import {EditableInput} from './EditableInput';

type Styles = ReturnType<typeof makeStyles>;

export interface TriggerProps<T> {
  label: string;
  placeholder: string;
  isOpen: boolean;
  disabled: boolean;
  hasValue: boolean;
  value: T | null;
  selectedValues: T[];

  onPress: () => void;
  onClear?: () => void;
  /** Press handler for the right accessory (caret). Overrides default. */
  onRightPress?: () => void;

  showRight: boolean;
  showClear: boolean;

  renderLeft?: (params: AccessoryParams<T>) => React.ReactNode;
  renderRight?: (params: AccessoryParams<T>) => React.ReactNode;
  renderClear?: (params: AccessoryParams<T>) => React.ReactNode;

  // icons (any node). Default = ▲ ▼ ✕. render-props above take precedence.
  caretUpIcon?: React.ReactNode;
  caretDownIcon?: React.ReactNode;
  clearIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  leftIconStyle?: StyleProp<ViewStyle>;
  /** Red error border. */
  hasError?: boolean;

  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;

  // --- multi-select chips ---
  /** When true, render `chips` (removable pills) in place of the label text. */
  showChips?: boolean;
  /** Precomputed chip data (one per selected value). */
  chips?: { key: string; label: string }[];
  /** Remove the chip at `index` (i.e. deselect that value). */
  onRemoveChip?: (index: number) => void;
  chipStyle?: StyleProp<ViewStyle>;
  chipTextStyle?: StyleProp<TextStyle>;
  /** Cap visible chips; the rest collapse into a "+N more" pill. */
  maxVisibleChips?: number;

  accessibilityLabel?: string;
  testID?: string;

  // --- editable (autocomplete) mode ---
  /** When true, the trigger renders an editable TextInput in place of the label. */
  editable?: boolean;
  /** Current text shown in the editable TextInput. */
  inputValue?: string;
  /** Called when the user types in the editable TextInput. */
  onChangeText?: (text: string) => void;
  /** Called when the editable TextInput gains focus. */
  onInputFocus?: () => void;
  /** Called when the editable TextInput loses focus. */
  onInputBlur?: () => void;
  /** Key events from the editable input (keyboard navigation). */
  onInputKeyPress?: (e: TextInputKeyPressEvent) => void;
  /** Forward ref to the TextInput (so the parent can focus/blur it). */
  inputRef?: React.Ref<TextInputInstance>;
  /** When true (and editable=true), the TextInput auto-focuses on mount. */
  autoFocusInput?: boolean;

  /**
   * Called whenever the trigger's intrinsic layout changes. Used by the parent
   * as a reliable fallback for width/height when measureInWindow returns zeros
   * (a known Android quirk on the first measurement after mount).
   */
  onLayout?: (layout: {width: number; height: number}) => void;
}

function defaultCaret(isOpen: boolean, styles: Styles) {
  return <Text style={styles.caret}>{isOpen ? '▲' : '▼'}</Text>;
}

function defaultClear(styles: Styles) {
  return <Text style={styles.clear}>{'✕'}</Text>;
}

function TriggerInner<T>(props: TriggerProps<T>, ref: React.Ref<ViewInstance>) {
  const {
    label,
    placeholder,
    isOpen,
    disabled,
    hasValue,
    value,
    selectedValues,
    onPress,
    onClear,
    onRightPress,
    showRight,
    showClear,
    renderLeft,
    renderRight,
    renderClear,
    caretUpIcon,
    caretDownIcon,
    clearIcon,
    leftIcon,
    leftIconStyle,
    hasError = false,
    style,
    textStyle,
    placeholderStyle,
    showChips = false,
    chips = [],
    maxVisibleChips,
    onRemoveChip,
    chipStyle,
    chipTextStyle,
    accessibilityLabel,
    testID,
    editable = false,
    inputValue = '',
    onChangeText,
    onInputFocus,
    onInputBlur,
    onInputKeyPress,
    inputRef,
    autoFocusInput = false,
    onLayout,
  } = props;

  const handleLayout = (e: LayoutChangeEvent) => {
    if (!onLayout) return;
    const {width, height} = e.nativeEvent.layout;
    onLayout({width, height});
  };

  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const localInputRef = useRef<TextInputInstance | null>(null);
  const [focused, setFocused] = useState(false);

  const accessoryParams: AccessoryParams<T> = {
    hasValue,
    isOpen,
    disabled,
    value,
    selectedValues,
  };

  const handlePress = () => {
    if (disabled) return;
    if (editable) {
      // Defer to the TextInput: focusing it triggers onInputFocus -> open
      localInputRef.current?.focus();
    } else {
      onPress();
    }
  };

  const assignInputRef = (node: TextInputInstance | null) => {
    localInputRef.current = node;
    if (typeof inputRef === 'function') {
      inputRef(node);
    } else if (inputRef && 'current' in inputRef) {
      (inputRef as React.MutableRefObject<TextInputInstance | null>).current = node;
    }
  };

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={onLayout ? handleLayout : undefined}>
      <Pressable
        disabled={disabled}
        onPress={handlePress}
        accessibilityRole={editable ? 'search' : 'combobox'}
        accessibilityState={{expanded: isOpen, disabled}}
        accessibilityLabel={accessibilityLabel}
        testID={editable ? undefined : testID}
        style={({pressed}) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
          hasError && styles.triggerError,
          style,
        ]}>
        {renderLeft ? (
          <View style={styles.slot}>{renderLeft(accessoryParams)}</View>
        ) : leftIcon ? (
          <View style={[styles.slot, leftIconStyle]}>{leftIcon}</View>
        ) : null}

        {showChips ? (
          <View style={styles.chipsWrap}>
            {(maxVisibleChips != null && maxVisibleChips >= 0
              ? chips.slice(0, maxVisibleChips)
              : chips
            ).map((chip, i) => (
              <View key={chip.key} style={[styles.chip, chipStyle]}>
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, chipTextStyle]}>
                  {chip.label}
                </Text>
                <Pressable
                  onPress={() => onRemoveChip?.(i)}
                  disabled={disabled}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${chip.label}`}
                  testID={testID ? `${testID}-chip-${i}-remove` : undefined}
                  style={styles.chipRemove}>
                  <Text style={[styles.chipRemoveText, chipTextStyle]}>✕</Text>
                </Pressable>
              </View>
            ))}
            {maxVisibleChips != null &&
            maxVisibleChips >= 0 &&
            chips.length > maxVisibleChips ? (
              <Pressable
                onPress={onPress}
                disabled={disabled}
                accessibilityRole="button"
                testID={testID ? `${testID}-chip-more` : undefined}
                style={[styles.chip, styles.chipMore, chipStyle]}>
                <Text style={[styles.chipText, styles.chipMoreText, chipTextStyle]}>
                  +{chips.length - maxVisibleChips} more
                </Text>
              </Pressable>
            ) : null}
            {editable ? (
              <EditableInput
                inputRef={assignInputRef}
                value={inputValue}
                onChangeText={onChangeText}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                onKeyPress={onInputKeyPress}
                placeholder={chips.length === 0 ? placeholder : ''}
                editable={!disabled}
                autoFocus={autoFocusInput}
                style={[styles.text, styles.input, styles.chipInput, textStyle]}
                testID={testID}
              />
            ) : chips.length === 0 ? (
              <Text
                numberOfLines={1}
                style={[styles.text, styles.placeholder, placeholderStyle]}>
                {placeholder}
              </Text>
            ) : null}
          </View>
        ) : editable ? (
          <EditableInput
            inputRef={assignInputRef}
            // When focused, show the live search text. When NOT focused, show the
            // selected label as real value text (black via styles.text) instead of
            // gray placeholder text.
            value={focused ? inputValue : hasValue ? label : inputValue}
            onChangeText={onChangeText}
            onFocus={() => {
              setFocused(true);
              onInputFocus?.();
            }}
            onBlur={() => {
              setFocused(false);
              onInputBlur?.();
            }}
            onKeyPress={onInputKeyPress}
            placeholder={placeholder}
            editable={!disabled}
            autoFocus={autoFocusInput}
            style={[styles.text, styles.input, textStyle]}
            testID={testID}
          />
        ) : (
          <Text
            numberOfLines={1}
            style={[
              styles.text,
              hasValue ? textStyle : [styles.placeholder, placeholderStyle],
            ]}>
            {hasValue ? label : placeholder}
          </Text>
        )}

        {showClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
            testID={testID ? `${testID}-clear` : undefined}
            style={styles.slot}>
            {renderClear
              ? renderClear(accessoryParams)
              : clearIcon ?? defaultClear(styles)}
          </Pressable>
        ) : null}

        {showRight ? (
          <Pressable
            onPress={
              onRightPress ?? (editable && !disabled ? handlePress : undefined)
            }
            disabled={(!editable && !onRightPress) || disabled}
            hitSlop={6}
            style={styles.slot}>
            {renderRight
              ? renderRight(accessoryParams)
              : (isOpen ? caretUpIcon : caretDownIcon) ??
                defaultCaret(isOpen, styles)}
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

// Allow generic forwardRef
export const Trigger = forwardRef(TriggerInner) as <T>(
  props: TriggerProps<T> & {ref?: React.Ref<ViewInstance>},
) => React.ReactElement;

const makeStyles = (t: DropdownTheme) =>
  StyleSheet.create({
    trigger: {
      flexDirection: rowDir(t),
      alignItems: 'center',
      minHeight: t.sizes.control,
      paddingHorizontal: t.spacing.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radii.md,
      backgroundColor: t.colors.surface,
    },
    triggerPressed: {
      backgroundColor: t.colors.triggerPressed,
    },
    triggerDisabled: {
      opacity: 0.5,
    },
    triggerError: {
      borderColor: t.colors.error,
    },
    slot: {
      marginHorizontal: t.spacing.xs,
    },
    text: {
      flex: 1,
      fontSize: t.fontSizes.input,
      ...fontFor(t),
      ...textDir(t),
      color: t.colors.text,
    },
    input: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      backgroundColor: 'transparent',
    },
    chipsWrap: {
      flex: 1,
      flexDirection: rowDir(t),
      flexWrap: 'wrap',
      alignItems: 'center',
      paddingVertical: t.spacing.xs,
      gap: t.spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.chipBg,
      borderRadius: t.radii.sm,
      paddingLeft: 10,
      paddingRight: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      maxWidth: '100%',
    },
    chipText: {
      color: t.colors.onChip,
      fontSize: t.fontSizes.chip,
      ...fontFor(t, 'medium'),
      flexShrink: 1,
    },
    chipMore: {
      backgroundColor: t.colors.divider,
      paddingRight: 10,
    },
    chipMoreText: {
      color: t.colors.text,
    },
    chipRemove: {
      marginLeft: t.spacing.sm,
      width: 16,
      height: 16,
      borderRadius: t.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipRemoveText: {
      color: t.colors.onChip,
      fontSize: t.fontSizes.xs,
      lineHeight: 13,
    },
    chipInput: {
      flexGrow: 1,
      flexBasis: 60,
      minWidth: 60,
    },
    placeholder: {
      color: t.colors.placeholder,
    },
    caret: {
      color: t.colors.textMuted,
      fontSize: t.fontSizes.sm,
    },
    clear: {
      color: t.colors.textMuted,
      fontSize: t.fontSizes.body,
    },
  });
