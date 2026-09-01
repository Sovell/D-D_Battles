export interface RandomSource { state: number; next(): number; int(min: number, max: number): number }

export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0 || 0x6d2b79f5;
  return {
    get state() { return state; },
    next() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
  };
}

export function rollDice(random: RandomSource, count: number, sides: number): { rolls: number[]; total: number } {
  const rolls = Array.from({ length: count }, () => random.int(1, sides));
  return { rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) };
}

