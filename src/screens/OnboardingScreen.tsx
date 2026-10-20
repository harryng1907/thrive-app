import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { Me } from '../types';
import { saveProfile } from '../lib/api';
import { ALL_COURSES, DEGREES, FACULTIES, GROUP_PREFS, INTEREST_GROUPS, INTERESTS, TIME_BLOCKS, WEEK } from '../lib/catalog';

type IconName = keyof typeof Ionicons.glyphMap;

interface OnboardingScreenProps {
  me: Me;
  editing?: boolean;
  onDone: (me: Me) => void;
  onCancel?: () => void;
}

const STEPS: { icon: IconName; title: string; hint: string }[] = [
  { icon: 'person', title: "Hi! Who's this?", hint: 'Only your squad sees this, after you match.' },
  { icon: 'heart', title: "What's your vibe?", hint: 'Pick 3 or more.' },
  { icon: 'school', title: 'Your courses', hint: 'Tap the ones you take this term.' },
  { icon: 'calendar', title: 'When are you free?', hint: 'Tap the blocks that usually work.' },
  { icon: 'people', title: 'Squad size', hint: 'You can change this any time.' },
];

const cellKey = (dow: number, block: string) => `${dow}-${block}`;

// Turn the picked blocks into availability windows, merging touching blocks on the same day.
function toAvailability(cells: Set<string>) {
  const out: { dow: number; start: number; end: number }[] = [];
  for (const { dow } of WEEK) {
    let current: { start: number; end: number } | null = null;
    for (const b of TIME_BLOCKS) {
      if (cells.has(cellKey(dow, b.key))) {
        if (current && current.end === b.start) current.end = b.end;
        else {
          if (current) out.push({ dow, ...current });
          current = { start: b.start, end: b.end };
        }
      }
    }
    if (current) out.push({ dow, ...current });
  }
  return out;
}

function fromAvailability(me: Me) {
  const cells = new Set<string>();
  for (const a of me.availability) {
    for (const b of TIME_BLOCKS) {
      // Show a block as picked when at least half of it is free.
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlap >= (b.end - b.start) / 2) cells.add(cellKey(a.dow, b.key));
    }
  }
  return cells;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ me, editing, onDone, onCancel }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me.full_name ?? (me.onboarded ? me.name : ''));
  const [degree, setDegree] = useState(DEGREES.find((d) => d.label === me.degree) ?? null);
  const [year, setYear] = useState<number>(me.year || 1);
  const [interests, setInterests] = useState<Set<string>>(new Set(me.interests));
  const [courses, setCourses] = useState<Set<string>>(new Set(me.courses));
  const [customCourse, setCustomCourse] = useState('');
  // Start on the faculty that matches their degree, if we can guess it.
  const [faculty, setFaculty] = useState(() => {
    const d = me.degree_short;
    if (['CS', 'SENG', 'ENG', 'MECH', 'MTRN', 'CVEN', 'DS'].includes(d)) return 'eng';
    if (['COMM', 'ACCT'].includes(d)) return 'bus';
    if (['LAW'].includes(d)) return 'law';
    if (['MED', 'EXSC'].includes(d)) return 'med';
    if (['DESN', 'ARTS', 'MDIA'].includes(d)) return 'ada';
    if (['SCI', 'PSYC', 'PHYS'].includes(d)) return 'sci';
    return 'eng';
  });
  const [cells, setCells] = useState<Set<string>>(() => fromAvailability(me));
  const [groupPref, setGroupPref] = useState(me.group_pref);
  const [vibe, setVibe] = useState(me.vibe ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing in the box searches every faculty; otherwise show the selected faculty.
  const query = customCourse.trim().toUpperCase().replace(/\s+/g, '');
  const searchHits = useMemo(
    () => (query.length >= 2 ? ALL_COURSES.filter((c) => c.includes(query)) : []),
    [query],
  );
  const canAddTyped = /^[A-Z]{4}\d{4}$/.test(query) && !courses.has(query);

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const valid = [
    name.trim().length >= 2 && !!degree,
    interests.size >= 3,
    courses.size >= 1,
    cells.size >= 1,
    true,
  ][step];

  const addCustomCourse = () => {
    const code = customCourse.trim().toUpperCase().replace(/\s+/g, '');
    if (/^[A-Z]{4}\d{4}$/.test(code)) {
      setCourses((c) => new Set(c).add(code));
      setCustomCourse('');
    }
  };

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveProfile({
        full_name: name.trim(),
        degree: degree!.label,
        degree_short: degree!.short,
        year,
        interests: [...interests],
        courses: [...courses],
        availability: toAvailability(cells),
        group_pref: groupPref,
        vibe: vibe.trim(),
      });
      onDone(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());
  const back = () => (step > 0 ? setStep(step - 1) : onCancel?.());
  const s = STEPS[step];

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.topBar}>
        {step > 0 || onCancel ? (
          <TouchableOpacity onPress={back} style={styles.roundBtn} accessibilityLabel="Back">
            <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={20} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.roundBtnPlaceholder} />
        )}
        <View style={styles.progressRow}>
          {STEPS.map((st, i) => (
            <View key={st.title} style={[styles.progressSeg, i <= step && styles.progressSegOn]} />
          ))}
        </View>
        <Text style={styles.stepCount}>
          {step + 1}/{STEPS.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.stepIcon}>
          <Ionicons name={s.icon} size={28} color={THEME.colors.primaryOrange} />
        </View>
        <Text style={styles.title}>{editing && step === 0 ? 'Edit your profile' : s.title}</Text>
        <Text style={styles.hint}>{s.hint}</Text>

        {step === 0 && (
          <>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={THEME.colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.label}>DEGREE</Text>
            <View style={styles.grid}>
              {DEGREES.map((d) => {
                const on = degree?.label === d.label;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.tile, styles.tile3, on && styles.tileOn]}
                    onPress={() => setDegree(d)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={d.icon} size={22} color={on ? '#FFFFFF' : THEME.colors.deepTeal} />
                    <Text style={[styles.tileText, on && styles.tileTextOn]} numberOfLines={1}>
                      {d.short === 'Uni' ? 'Other' : d.short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>YEAR</Text>
            <View style={styles.chipsRow}>
              {[1, 2, 3, 4].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, year === y && styles.chipOn]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearText, year === y && styles.chipTextOn]}>{y === 4 ? '4+' : y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            {INTEREST_GROUPS.map((group) => (
              <View key={group.label} style={styles.group}>
                <View style={styles.groupHead}>
                  <Ionicons name={group.icon} size={15} color={THEME.colors.deepTeal} />
                  <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
                </View>
                <View style={styles.grid}>
                  {group.tags.map((tag) => {
                    const it = INTERESTS.find((i) => i.tag === tag)!;
                    const on = interests.has(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tile, styles.tile4, on && styles.tileOn]}
                        onPress={() => setInterests((x) => toggle(x, tag))}
                        activeOpacity={0.8}
                        accessibilityLabel={it.label}
                      >
                        <Ionicons name={it.icon} size={24} color={on ? '#FFFFFF' : THEME.colors.primaryOrange} />
                        <Text style={[styles.tileTextSmall, on && styles.tileTextOn]} numberOfLines={1}>
                          {it.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={styles.counter}>
              <Ionicons
                name={interests.size >= 3 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={interests.size >= 3 ? THEME.colors.successGreen : THEME.colors.textMuted}
              />
              <Text style={styles.counterText}>
                {interests.size} picked{interests.size < 3 ? ` · ${3 - interests.size} more to go` : ''}
              </Text>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            {courses.size > 0 && (
              <View style={styles.picked}>
                {[...courses].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.courseChip, styles.chipOn]}
                    onPress={() => setCourses((x) => toggle(x, c))}
                    accessibilityLabel={`Remove ${c}`}
                  >
                    <Text style={[styles.courseText, styles.chipTextOn]}>{c}</Text>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.inputRow}>
              <Ionicons name="search" size={18} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Search or add, e.g. COMP15"
                placeholderTextColor={THEME.colors.textMuted}
                value={customCourse}
                onChangeText={setCustomCourse}
                autoCapitalize="characters"
                onSubmitEditing={addCustomCourse}
                returnKeyType="done"
              />
              {canAddTyped && (
                <TouchableOpacity onPress={addCustomCourse} style={styles.addBtn} accessibilityLabel="Add course">
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {query.length >= 2 ? (
              <View style={[styles.chipsWrap, { marginTop: 14 }]}>
                {searchHits.map((c) => {
                  const on = courses.has(c);
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.courseChip, on && styles.chipOn]}
                      onPress={() => setCourses((x) => toggle(x, c))}
                    >
                      {on && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      <Text style={[styles.courseText, on && styles.chipTextOn]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
                {searchHits.length === 0 && !canAddTyped && (
                  <Text style={styles.hint}>No match yet — type the full code, e.g. PHYS1131</Text>
                )}
                {canAddTyped && !searchHits.includes(query) && (
                  <TouchableOpacity style={[styles.courseChip, styles.addChip]} onPress={addCustomCourse}>
                    <Ionicons name="add" size={14} color={THEME.colors.primaryOrange} />
                    <Text style={[styles.courseText, { color: THEME.colors.primaryOrange }]}>Add {query}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.facultyScroll}
                  contentContainerStyle={styles.facultyRow}
                >
                  {FACULTIES.map((f) => {
                    const on = faculty === f.key;
                    const count = f.subjects.reduce((n, s) => n + s.courses.filter((c) => courses.has(c)).length, 0);
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.facultyChip, on && styles.chipOn]}
                        onPress={() => setFaculty(f.key)}
                      >
                        <Ionicons name={f.icon} size={15} color={on ? '#FFFFFF' : THEME.colors.deepTeal} />
                        <Text style={[styles.facultyText, on && styles.chipTextOn]}>{f.label}</Text>
                        {count > 0 && (
                          <View style={[styles.countDot, on && { backgroundColor: '#FFFFFF' }]}>
                            <Text style={[styles.countDotText, on && { color: THEME.colors.deepTeal }]}>{count}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {FACULTIES.find((f) => f.key === faculty)!.subjects.map((subject) => (
                  <View key={subject.prefix} style={styles.group}>
                    <View style={styles.groupHead}>
                      <Text style={styles.prefix}>{subject.prefix}</Text>
                      <Text style={styles.groupLabel}>{subject.label.toUpperCase()}</Text>
                    </View>
                    <View style={styles.chipsWrap}>
                      {subject.courses.map((c) => {
                        const on = courses.has(c);
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[styles.courseChip, on && styles.chipOn]}
                            onPress={() => setCourses((x) => toggle(x, c))}
                          >
                            {on && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            <Text style={[styles.courseText, on && styles.chipTextOn]}>{c}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <View style={styles.timeGrid}>
            <View style={styles.bulkRow}>
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => setCells(new Set(WEEK.flatMap((d) => TIME_BLOCKS.map((b) => cellKey(d.dow, b.key)))))}
                accessibilityLabel="Select all times"
              >
                <Ionicons name="checkmark-done" size={16} color={THEME.colors.deepTeal} />
                <Text style={styles.bulkText}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => setCells(new Set())}
                accessibilityLabel="Clear all times"
              >
                <Ionicons name="close-circle-outline" size={16} color={THEME.colors.textSecondary} />
                <Text style={[styles.bulkText, { color: THEME.colors.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
              <Text style={styles.bulkHint}>Tip: tap a day or time to fill it</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.dayCell} />
              {TIME_BLOCKS.map((b) => (
                // Tap a column header → toggle that time on every day.
                <TouchableOpacity
                  key={b.key}
                  style={styles.blockHead}
                  onPress={() =>
                    setCells((x) => {
                      const keys = WEEK.map((d) => cellKey(d.dow, b.key));
                      const next = new Set(x);
                      const allOn = keys.every((k) => x.has(k));
                      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
                      return next;
                    })
                  }
                  accessibilityLabel={`Toggle every ${b.label}`}
                >
                  <Ionicons name={b.icon} size={20} color={THEME.colors.deepTeal} />
                  <Text style={styles.blockHeadText}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {WEEK.map((d) => (
              <View key={d.dow} style={styles.timeRow}>
                {/* Tap a day → toggle the whole day. */}
                <TouchableOpacity
                  style={styles.dayCell}
                  onPress={() =>
                    setCells((x) => {
                      const keys = TIME_BLOCKS.map((b) => cellKey(d.dow, b.key));
                      const next = new Set(x);
                      const allOn = keys.every((k) => x.has(k));
                      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
                      return next;
                    })
                  }
                  accessibilityLabel={`Toggle all of ${d.label}`}
                >
                  <Text style={styles.dayText}>{d.label}</Text>
                </TouchableOpacity>
                {TIME_BLOCKS.map((b) => {
                  const on = cells.has(cellKey(d.dow, b.key));
                  return (
                    <TouchableOpacity
                      key={b.key}
                      style={[styles.timeCell, on && styles.timeCellOn]}
                      onPress={() => setCells((x) => toggle(x, cellKey(d.dow, b.key)))}
                      accessibilityLabel={`${d.label} ${b.label}`}
                    >
                      {on && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {step === 4 && (
          <>
            {GROUP_PREFS.map((g) => {
              const on = groupPref === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.bigOption, on && styles.bigOptionOn]}
                  onPress={() => setGroupPref(g.key)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.bigIcon, on && { backgroundColor: '#FFFFFF33' }]}>
                    <Ionicons name={g.icon} size={26} color={on ? '#FFFFFF' : THEME.colors.deepTeal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bigLabel, on && styles.chipTextOn]}>{g.label}</Text>
                    <Text style={[styles.bigSub, on && { color: '#FFFFFFCC' }]}>{g.sub}</Text>
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}

            <Text style={styles.label}>IN YOUR WORDS (OPTIONAL)</Text>
            <View style={styles.inputRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="e.g. back corner of the library, headphones on"
                placeholderTextColor={THEME.colors.textMuted}
                value={vibe}
                onChangeText={setVibe}
                maxLength={120}
              />
            </View>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, (!valid || saving) && { opacity: 0.4 }]}
          disabled={!valid || saving}
          onPress={next}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.nextText}>{step === STEPS.length - 1 ? (editing ? 'Save' : "Let's go") : 'Next'}</Text>
              <Ionicons name={step === STEPS.length - 1 ? 'sparkles' : 'arrow-forward'} size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnPlaceholder: {
    width: 36,
    height: 36,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  progressSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  progressSegOn: {
    backgroundColor: THEME.colors.primaryOrange,
  },
  stepCount: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  stepIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: THEME.colors.primaryOrangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  hint: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.colors.textPrimary,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 12,
  },
  tile3: {
    width: '31.5%',
  },
  tile4: {
    width: '22.8%',
  },
  tileOn: {
    backgroundColor: THEME.colors.primaryOrange,
    borderColor: THEME.colors.primaryOrange,
  },
  tileText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  tileTextSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  tileTextOn: {
    color: '#FFFFFF',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  yearChip: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  chipOn: {
    backgroundColor: THEME.colors.deepTeal,
    borderColor: THEME.colors.deepTeal,
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  courseText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  timeGrid: {
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dayCell: {
    width: 44,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  blockHead: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  blockHeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  timeCell: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCellOn: {
    backgroundColor: THEME.colors.deepTeal,
    borderColor: THEME.colors.deepTeal,
  },
  bigOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.cardWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    marginBottom: 10,
  },
  bigOptionOn: {
    backgroundColor: THEME.colors.deepTeal,
    borderColor: THEME.colors.deepTeal,
  },
  bigIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.deepTealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  bigSub: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: 20,
    paddingTop: 8,
  },
  nextBtn: {
    height: 56,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.primaryOrange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...THEME.shadows.buttonOrange,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  error: {
    color: '#DC2626',
    marginTop: 12,
  },
  group: {
    marginBottom: 16,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  prefix: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: THEME.colors.deepTeal,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  picked: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  addChip: {
    borderColor: '#CFF2BD',
    backgroundColor: THEME.colors.primaryOrangeLight,
  },
  facultyScroll: {
    flexGrow: 0,
    marginTop: 14,
    marginBottom: 14,
  },
  facultyRow: {
    gap: 8,
  },
  facultyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  facultyText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  countDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME.colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countDotText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.cardWhite,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  bulkText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.deepTeal,
  },
  bulkHint: {
    flex: 1,
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'right',
  },
});
