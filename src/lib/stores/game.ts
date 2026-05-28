import { writable, get } from 'svelte/store';

export type GameStatus = 'ready' | 'playing' | 'gameover';

export const bloodSugar = writable<number>(100);
export const score = writable<number>(0);
export const insulinLevel = writable<number>(0);
export const glucagonLevel = writable<number>(0);
export const gameStatus = writable<GameStatus>('ready');
export const gameTime = writable<number>(0);
export const comboStreak = writable<number>(0);
export const comboMultiplier = writable<number>(1);
export const lastMilestone = writable<{ streak: number; bonus: number; at: number } | null>(null);
export const bloodSugarHistory = writable<{ time: number; value: number }[]>([]);

let gameInterval: ReturnType<typeof setInterval> | null = null;
let activeFoodEffects: {amountPerTick: number, remainingTicks: number}[] = [];

export function startGameLoop() {
  if (get(gameStatus) === 'playing') return;

  bloodSugar.set(100);
  score.set(0);
  insulinLevel.set(0);
  glucagonLevel.set(0);
  gameTime.set(540); // 09:00 AM
  gameStatus.set('playing');
  activeFoodEffects = [];
  comboStreak.set(0);
  comboMultiplier.set(1);
  lastMilestone.set(null);
  bloodSugarHistory.set([{ time: 540, value: 100 }]);

  if (gameInterval) clearInterval(gameInterval);

  gameInterval = setInterval(() => {
    const status = get(gameStatus);
    if (status !== 'playing') {
      if (gameInterval) clearInterval(gameInterval);
      gameInterval = null;
      return;
    }

    let bs = get(bloodSugar);
    let insulin = get(insulinLevel);
    let glucagon = get(glucagonLevel);
    let currentTime = get(gameTime);

    const nextTime = currentTime + 12;
    gameTime.set(nextTime);

    if (bs > 350 || bs < 40 || nextTime >= 1980) {
      gameStatus.set('gameover');
      return;
    }

    if (bs >= 80 && bs <= 140) {
      const streak = get(comboStreak) + 1;
      comboStreak.set(streak);
      let mult = 1;
      if (streak >= 60) mult = 4;
      else if (streak >= 40) mult = 3;
      else if (streak >= 20) mult = 2;
      else if (streak >= 10) mult = 1.5;
      comboMultiplier.set(mult);
      score.update(s => s + Math.round(100 * mult));
      if (streak === 10 || streak === 20 || streak === 40 || streak === 60 || streak === 100) {
        const milestoneBonus = streak * 50;
        score.update(s => s + milestoneBonus);
        lastMilestone.set({ streak, bonus: milestoneBonus, at: Date.now() });
      }
    } else if (bs < 80) {
      comboStreak.set(0);
      comboMultiplier.set(1);
      const penalty = Math.round((80 - bs) * 3);
      score.update(s => s - penalty);
    } else if (bs > 140) {
      comboStreak.set(0);
      comboMultiplier.set(1);
      const penalty = Math.round((bs - 140) * 3);
      score.update(s => s - penalty);
    }

    let delta = -1.5; // Metabolism
    insulinLevel.update(i => Math.max(0, i - 1));
    glucagonLevel.update(g => Math.max(0, g - 1));

    if (insulin > 0) delta -= (insulin * 0.4);
    if (glucagon > 0) delta += (glucagon * 0.5);

    if (activeFoodEffects.length > 0) {
      activeFoodEffects.forEach(effect => {
        if (effect.remainingTicks > 0) {
          delta += effect.amountPerTick;
          effect.remainingTicks--;
        }
      });
      activeFoodEffects = activeFoodEffects.filter(e => e.remainingTicks > 0);
    }

    const newBs = Math.max(0, bs + delta);
    bloodSugar.set(newBs);
    bloodSugarHistory.update(h => [...h, { time: nextTime, value: newBs }]);
  }, 500);
}

export function stopGameLoop() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = null;
  gameStatus.set('ready');
}

export function eatFood(glucoseAmount: number, durationSeconds: number): number {
  if (get(gameStatus) !== 'playing') return 0;
  const totalTicks = Math.max(1, Math.round(durationSeconds * 2));
  activeFoodEffects.push({ amountPerTick: glucoseAmount / totalTicks, remainingTicks: totalTicks });
  const bonus = glucoseAmount * 5;
  score.update(s => s + bonus);
  return bonus;
}

export function exercise(amount: number): number {
  if (get(gameStatus) !== 'playing') return 0;
  activeFoodEffects.push({ amountPerTick: -amount / 20, remainingTicks: 20 });
  const bonus = amount * 5;
  score.update(s => s + bonus);
  return bonus;
}

export function secreteInsulin(): number {
  if (get(gameStatus) !== 'playing') return 0;
  insulinLevel.update(i => Math.min(20, i + 5));
  const bonus = 150;
  score.update(s => s + bonus);
  return bonus;
}

export function secreteGlucagon(): number {
  if (get(gameStatus) !== 'playing') return 0;
  glucagonLevel.update(g => Math.min(15, g + 4));
  const bonus = 150;
  score.update(s => s + bonus);
  return bonus;
}
