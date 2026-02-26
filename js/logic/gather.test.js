import { describe, it, expect } from 'vitest';
import { normalizeGatherValue, normalizeGatherArray, computeIngredientHours } from './gather.js';

describe('Gather Logic', () => {
    describe('normalizeGatherValue', () => {
        it('should return 0 for negative values or invalid inputs', () => {
            expect(normalizeGatherValue(-5)).toBe(0);
            expect(normalizeGatherValue('abc')).toBe(0);
            expect(normalizeGatherValue(null)).toBe(0);
        });

        it('should parse and return valid positive numbers', () => {
            expect(normalizeGatherValue(10)).toBe(10);
            expect(normalizeGatherValue('15.5')).toBe(15.5);
        });
    });

    describe('normalizeGatherArray', () => {
        it('should return an array of zeros if input is invalid', () => {
            expect(normalizeGatherArray(null)).toEqual([0, 0, 0]);
            expect(normalizeGatherArray('string')).toEqual([0, 0, 0]);
        });

        it('should normalize and pad an array up to the specified columns', () => {
            expect(normalizeGatherArray([10, '20'], 3)).toEqual([10, 20, 0]);
            expect(normalizeGatherArray([1, 2, 3, 4], 2)).toEqual([1, 2]);
        });
    });

    describe('computeIngredientHours', () => {
        it('should return 0s if needQty is 0', () => {
            const result = computeIngredientHours({ needQty: 0, rates: [10, 5, 5] });
            expect(result.totalHours).toBe(0);
            expect(result.ingredientHours).toBe(0);
        });

        it('should compute exact 24h rates when needQty equals daily rate', () => {
            // 10 ingredients/day, we need 10.
            const result = computeIngredientHours({
                needQty: 10,
                rates: [10, 0, 0], // slot1 only
                usePokemonCount: false,
            });
            expect(result.totalDailyRate).toBe(10);
            expect(result.ingredientHours).toBe(24);
            expect(result.totalHours).toBe(24);
        });

        it('should factor in pokemon count when enabled', () => {
            // 10 ingredients/day, we need 20. But we use 2 pokemon.
            const result = computeIngredientHours({
                needQty: 20,
                rates: [10, 0, 0],
                usePokemonCount: true,
                pokemonCount: 2,
            });
            // 2 pokemon * 10 = 20 daily rate. Need 20, so 24 hours.
            expect(result.ingredientDailyRate).toBe(20);
            expect(result.totalHours).toBe(24);
        });
    });
});
