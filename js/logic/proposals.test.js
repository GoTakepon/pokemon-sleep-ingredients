import { describe, it, expect } from 'vitest';
import { computeBestRecipeCombos } from './proposals.js';

describe('Proposals Logic', () => {
    describe('computeBestRecipeCombos', () => {
        it('should return an empty array if stats is empty or invalid', () => {
            expect(computeBestRecipeCombos([])).toEqual([]);
            expect(computeBestRecipeCombos([{ finalEnergy: 0, hoursRequired: 0 }])).toEqual([]);
        });

        it('should sort and return the best combo based on maxMeals and maxHours', () => {
            const mockStats = [
                {
                    id: 'recipe1',
                    finalEnergy: 1000,
                    hoursRequired: 2,
                    ingredientHoursRequired: 2,
                    ingredientShareHours: 1,
                    assistShareHours: 1,
                },
                {
                    id: 'recipe2',
                    finalEnergy: 5000,
                    hoursRequired: 10,
                    ingredientHoursRequired: 10,
                    ingredientShareHours: 5,
                    assistShareHours: 5,
                }
            ];

            // Request maxMeals = 1
            const combos1 = computeBestRecipeCombos(mockStats, { maxMeals: 1, maxResults: 1 });
            expect(combos1.length).toBe(1);
            expect(combos1[0].recipes[0].recipeId).toBe('recipe2'); // The higher energy one
            expect(combos1[0].totalEnergy).toBe(5000);

            // Request maxMeals = 2 (It should combine them or repeat recipe2 if allowed)
            const combos2 = computeBestRecipeCombos(mockStats, { maxMeals: 2, maxResults: 1, allowRepeats: true });
            expect(combos2.length).toBe(1);
            // Since recipe2 is better (500 energy/hr vs 500 energy/hr, same efficiency but higher total)
            // Combo of [recipe2, recipe2] = 10000 energy, 20 hours
            expect(combos2[0].totalEnergy).toBe(10000);
            expect(combos2[0].totalHours).toBe(20);
        });

        it('should skip combinations that exceed maxHours per pokemon', () => {
            const mockStats = [
                {
                    id: 'recipe1',
                    finalEnergy: 10000,
                    hoursRequired: 15, // 15 hours each
                    ingredientHoursRequired: 15,
                    ingredientShareHours: 10,
                    assistShareHours: 5,
                }
            ];

            // Using 2 recipes = 30 hours. Assuming 1 pokemon, this exceeds 24h.
            let combos = computeBestRecipeCombos(mockStats, { maxMeals: 2, maxHours: 24, pokemonCount: 1 });
            // The best valid combo should only contain 1 recipe (15h < 24h)
            expect(combos[0].recipes.length).toBe(1);
            expect(combos[0].totalHours).toBe(15);

            // But if we have 2 pokemon, 30h / 2 = 15h per pokemon, which is < 24h.
            combos = computeBestRecipeCombos(mockStats, { maxMeals: 2, maxHours: 24, pokemonCount: 2 });
            expect(combos[0].recipes.length).toBe(2);
            expect(combos[0].totalHours).toBe(30);
        });
    });
});
