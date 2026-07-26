import {
  defaultDiscoveryFilters,
  type DiscoveryFilters,
  type DiscoveryMood,
} from "@/lib/discovery/types";

type ManualFlags = {
  highRating: boolean;
  popular: boolean;
  onlyNew: boolean;
  randomGood: boolean;
};

export type TodayPickerState = DiscoveryFilters & {
  manuallyChanged: ManualFlags;
};

const defaultManualFlags: ManualFlags = {
  highRating: false,
  popular: false,
  onlyNew: false,
  randomGood: false,
};

export function createTodayPickerState(initialMood: DiscoveryMood = "evening"): TodayPickerState {
  return {
    ...defaultDiscoveryFilters,
    mood: initialMood,
    manuallyChanged: { ...defaultManualFlags },
  };
}

export function applyTodayPreset(state: TodayPickerState, mood: DiscoveryMood): TodayPickerState {
  const isNewPreset = mood === "new";
  return {
    ...state,
    mood,
    onlyNew: state.manuallyChanged.onlyNew ? Boolean(state.onlyNew) : isNewPreset,
  };
}

export function updateTodayPickerFilter<Key extends keyof DiscoveryFilters>(
  state: TodayPickerState,
  key: Key,
  value: DiscoveryFilters[Key],
  manual = true,
): TodayPickerState {
  const next = { ...state, [key]: value };
  if (manual && ["highRating", "popular", "onlyNew", "randomGood"].includes(key)) {
    next.manuallyChanged = { ...state.manuallyChanged, [key]: true };
  }
  return next;
}

export function resetTodayPickerState() {
  return createTodayPickerState();
}

export function toDiscoveryFilters(state: TodayPickerState): DiscoveryFilters {
  return {
    type: state.type,
    mood: state.mood,
    runtime: state.runtime,
    period: state.period,
    highRating: Boolean(state.highRating),
    popular: Boolean(state.popular),
    onlyNew: Boolean(state.onlyNew),
    randomGood: Boolean(state.randomGood),
  };
}

export function activeTodayFilterLabels(state: TodayPickerState) {
  const labels: string[] = [];
  if (state.type !== "ANY") labels.push(`Тип: ${state.type}`);
  if (state.runtime !== "ANY") labels.push(`Длительность: ${state.runtime}`);
  if (state.period !== "ANY") labels.push(`Период: ${state.period}`);
  if (state.highRating) labels.push("Высокий рейтинг");
  if (state.popular) labels.push("Популярное");
  if (state.onlyNew) labels.push("Только новинки");
  if (state.randomGood) labels.push("Случайный хороший");
  return labels;
}
