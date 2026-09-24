// Storm Property Record — pick which areas of the property to photograph.
// Chips copy onboarding's supplies screen.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { addAreas } from '@/db/property';
import { useTheme } from '@/hooks/use-theme';
import { AREA_SECTIONS } from '@/lib/property-areas';

export default function PickAreasScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [picked, setPicked] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleArea(name: string) {
    if (picked.includes(name)) {
      setPicked(picked.filter((pickedName) => pickedName !== name));
    } else {
      setPicked([...picked, name]);
    }
  }

  // Typing a name means they want it, so it starts selected.
  function addCustomArea() {
    const name = customName.trim();
    if (name === '') {
      return;
    }

    // A typed suggestion just selects the chip that's already there.
    let isSuggestion = false;
    for (const section of AREA_SECTIONS) {
      if (section.areas.includes(name)) {
        isSuggestion = true;
      }
    }
    if (!isSuggestion && !customAreas.includes(name)) {
      setCustomAreas([...customAreas, name]);
    }

    if (!picked.includes(name)) {
      setPicked([...picked, name]);
    }
    setCustomName('');
  }

  async function handleSave() {
    // A fast double tap would otherwise save every area twice.
    if (picked.length === 0 || saving) {
      return;
    }
    setSaving(true);

    // Saved in screen order, not tap order, so the record lists them the way they appear here.
    const names = [];
    for (const section of AREA_SECTIONS) {
      for (const name of section.areas) {
        if (picked.includes(name)) {
          names.push(name);
        }
      }
    }
    for (const name of customAreas) {
      if (picked.includes(name)) {
        names.push(name);
      }
    }

    try {
      await addAreas(db, names);
      router.back();
    } catch {
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  let buttonLabel = 'Pick an area';
  if (picked.length === 1) {
    buttonLabel = 'Add 1 area';
  }
  if (picked.length > 1) {
    buttonLabel = `Add ${picked.length} areas`;
  }
  const canSave = picked.length > 0;

  // Shared by the suggestions and the typed-in areas.
  function renderChip(name: string) {
    const isOn = picked.includes(name);
    return (
      <Pressable
        key={name}
        onPress={() => toggleArea(name)}
        accessibilityState={{ selected: isOn }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.chipLabel}>
          {name}
        </ThemedText>
      </Pressable>
    );
  }

  // Two loops: one per section, one for its chips.
  const sectionBlocks = [];
  for (const section of AREA_SECTIONS) {
    const chips = [];
    for (const name of section.areas) {
      chips.push(renderChip(name));
    }

    sectionBlocks.push(
      <View key={section.title} style={styles.section}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          {section.title}
        </ThemedText>

        <View style={styles.chips}>{chips}</View>
      </View>
    );
  }

  const customChips = [];
  for (const name of customAreas) {
    customChips.push(renderChip(name));
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.backButton,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.intro}>
            <ThemedText style={styles.title}>What to photograph</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Pick the areas you want a record of. You can add more later.
            </ThemedText>
          </View>

          <View style={styles.sections}>
            {sectionBlocks}

            <View style={styles.section}>
              <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
                Add your own
              </ThemedText>

              {customChips.length > 0 && <View style={styles.chips}>{customChips}</View>}

              <View style={styles.customRow}>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  onSubmitEditing={addCustomArea}
                  placeholder="Shed, boat, dock"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                />
                <Pressable
                  onPress={addCustomArea}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: theme.primaryDeep },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={styles.addLabel}>Add</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: canSave ? theme.primaryDeep : theme.border },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText
              themeColor={canSave ? undefined : 'textSecondary'}
              style={[styles.buttonText, canSave && styles.buttonTextOn]}>
              {buttonLabel}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    paddingTop: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  sections: {
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  customRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  addButton: {
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  addLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  button: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  buttonTextOn: {
    color: '#FFFFFF',
  },
});
