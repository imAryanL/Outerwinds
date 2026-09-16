// Editing the household after onboarding, opened from Settings. Asks the same questions as
// onboarding screens 2 and 3, answered again against what is already saved.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONCERNS } from '@/app/onboarding/household';
import { HOME_TYPES } from '@/app/onboarding/location';
import { LookupPanel } from '@/components/lookup-panel';
import { StepperRow } from '@/components/onboarding/stepper-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { addNewlyApplicableItems, updateTargets } from '@/db/checklist';
import { getHousehold, updateHousehold } from '@/db/household';
import { addSuppliesFor } from '@/db/inventory';
import { fetchPointData, formatPlace, type PointData } from '@/lib/nws';
import { lookupZip } from '@/lib/zip-lookup';
import { useTheme } from '@/hooks/use-theme';

// The concern chips are stored as JSON in medical_notes — the table never got a column of
// its own for them. Anything unreadable counts as none rather than crashing the screen.
function readConcerns(notes: string | null) {
  if (notes === null || notes === '') {
    return [];
  }

  try {
    return JSON.parse(notes) as string[];
  } catch {
    return [];
  }
}

// What the ZIP currently in the field resolves to. The zip is carried along so a slow
// answer can never be shown under a number the user has since retyped.
type Lookup = {
  zip: string;
  status: 'loading' | 'found' | 'unknown' | 'offline';
  place: string;
  point: PointData | null;
};

export default function EditHouseholdScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  // The saved answers are copied into state and edited there. Nothing reaches the database
  // until Save, so backing out leaves the household as it was.
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [pets, setPets] = useState(0);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [homeType, setHomeType] = useState<string | null>(null);
  const [zip, setZip] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);

  // The home type and concerns as they were when the screen opened. Saving compares against
  // these to work out which items start applying.
  const [before, setBefore] = useState({ homeType: null as string | null, concerns: [] as string[] });
  const [saving, setSaving] = useState(false);

  async function load() {
    const household = await getHousehold(db);

    if (household === null) {
      return;
    }

    setName(household.name ?? '');
    setAdults(household.adults);
    setKids(household.kids);
    setPets(household.pets);
    setConcerns(readConcerns(household.medical_notes));
    setHomeType(household.home_type);
    setBefore({ homeType: household.home_type, concerns: readConcerns(household.medical_notes) });
    setZip(household.zip_code ?? '');

    // The row stores the place joined, so it splits back apart here. Rebuilding it means an
    // untouched ZIP keeps the county it already had instead of saving as unknown.
    if (household.county !== null && household.nws_zone_id !== null) {
      const parts = (household.place ?? ', ').split(', ');
      setLookup({
        zip: household.zip_code ?? '',
        status: 'found',
        place: household.place ?? '',
        point: {
          county: household.county,
          zoneId: household.nws_zone_id,
          office: household.nws_office ?? '',
          city: parts[0],
          state: parts[1] ?? '',
        },
      });
    }

    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, [db]);

  // Same two steps as onboarding: the bundled table turns a ZIP into coordinates, and the
  // National Weather Service turns those into a county and alert zone.
  async function runLookup(zipCode: string) {
    const coords = lookupZip(zipCode);

    if (coords === null) {
      setLookup({ zip: zipCode, status: 'unknown', place: '', point: null });
      return;
    }

    setLookup({ zip: zipCode, status: 'loading', place: '', point: null });

    const point = await fetchPointData(coords.lat, coords.lon);

    if (point === null) {
      setLookup({ zip: zipCode, status: 'offline', place: '', point: null });
      return;
    }

    setLookup({ zip: zipCode, status: 'found', place: formatPlace(point), point: point });
  }

  function handleZipChange(text: string) {
    const digits = text.replace(/[^0-9]/g, '');
    setZip(digits);

    if (digits.length === 5) {
      // number-pad has no return key, so nothing else dismisses this.
      Keyboard.dismiss();
      runLookup(digits);
    }
  }

  // A new array each time — React only re-renders when it gets a different one.
  function toggleConcern(id: string) {
    if (concerns.includes(id)) {
      setConcerns(concerns.filter((concernId) => concernId !== id));
    } else {
      setConcerns([...concerns, id]);
    }
  }

  async function save() {
    setSaving(true);

    // A point only goes in when it belongs to the ZIP in the field. Otherwise a failed
    // lookup would pair a new ZIP with the old county, and alerts would be for the wrong
    // place — so it saves as unknown and fills in next time the app is online.
    let point = null;
    if (lookup !== null && lookup.zip === zip) {
      point = lookup.point;
    }

    const values = {
      name: name,
      adults: adults,
      kids: kids,
      pets: pets,
      concerns: concerns,
      zip: zip,
      homeType: homeType,
      point: point,
    };

    await updateHousehold(db, values);
    await updateTargets(db, adults, kids, pets);

    // Add-only: items that start applying are added, and nothing is ever taken away.
    const added = await addNewlyApplicableItems(db, before, values);
    await addSuppliesFor(db, added);

    leave();
  }

  // Falls back to Home when opened by a deep link with no history.
  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  const chips = [];
  for (const concern of CONCERNS) {
    const isOn = concerns.includes(concern.id);
    chips.push(
      <Pressable
        key={concern.id}
        onPress={() => toggleConcern(concern.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: isOn }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <MaterialCommunityIcons
          name={concern.icon}
          size={18}
          color={isOn ? theme.primaryDeep : theme.textSecondary}
        />

        <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.rowLabel}>
          {concern.label}
        </ThemedText>

        {isOn ? (
          <MaterialCommunityIcons name="check" size={18} color={theme.primaryDeep} />
        ) : null}
      </Pressable>
    );
  }

  const homeRows = [];
  for (const home of HOME_TYPES) {
    const isOn = homeType === home.id;
    homeRows.push(
      <Pressable
        key={home.id}
        onPress={() => setHomeType(home.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: isOn }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <MaterialCommunityIcons
          name={home.icon}
          size={18}
          color={isOn ? theme.primaryDeep : theme.textSecondary}
        />

        <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.rowLabel}>
          {home.label}
        </ThemedText>

        {isOn ? (
          <MaterialCommunityIcons name="check" size={18} color={theme.primaryDeep} />
        ) : null}
      </Pressable>
    );
  }

  // The same panel onboarding shows, so the two screens can't drift apart. Only built for
  // the ZIP currently in the field, so a late answer can't sit under a different number.
  let panel = null;
  if (lookup !== null && lookup.zip === zip) {
    panel = <LookupPanel status={lookup.status} place={lookup.place} />;
  }

  // The ZIP is the only answer that can block saving, same as onboarding. Offline still
  // saves, because the coordinates come from the bundled table before the network is used.
  const canSave =
    saving === false &&
    lookup !== null &&
    lookup.zip === zip &&
    (lookup.status === 'found' || lookup.status === 'offline');

  if (!loaded) {
    return <ThemedView style={{ flex: 1 }} />;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              onPress={leave}
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

          <ThemedText style={styles.title}>Your household</ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Changing who lives here updates the quantities on your checklist.
          </ThemedText>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Your name
            </ThemedText>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Leave blank to skip"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
          </View>

          <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <StepperRow
              label="Adults"
              hint="Including you"
              value={adults}
              onChange={setAdults}
              min={1}
            />

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <StepperRow label="Children" hint="Under 18" value={kids} onChange={setKids} min={0} />

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <StepperRow
              label="Pets"
              hint="Cats and dogs drink too"
              value={pets}
              onChange={setPets}
              min={0}
            />
          </View>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Anything else to plan for
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.fieldHelp}>
              Turning one on adds the items it needs. Turning it off leaves your list alone.
            </ThemedText>

            <View style={styles.rowList}>{chips}</View>
          </View>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Your ZIP code
            </ThemedText>

            <TextInput
              value={zip}
              onChangeText={handleZipChange}
              placeholder="33322"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={5}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />

            {panel}
          </View>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Type of home
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.fieldHelp}>
              Hurricane guidance differs for each, especially mobile homes.
            </ThemedText>

            <View style={styles.rowList}>{homeRows}</View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={save}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: canSave ? theme.primaryDeep : theme.border },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText style={[styles.buttonText, canSave ? null : { color: theme.textSecondary }]}>
              Save changes
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
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
    paddingTop: Spacing.one,
  },
  field: {
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  fieldHelp: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowList: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  card: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: 16,
  },
  divider: {
    height: 1,
  },
});
