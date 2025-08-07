// @slop Claude Sonnet 4

import {test, expect, describe} from 'vitest';

import {filer_test_regexp} from './filer_helpers.ts';

describe('filer_test_regexp', () => {
	describe('basic functionality', () => {
		test('matches simple patterns', () => {
			const pattern = /\.ts$/;
			expect(filer_test_regexp(pattern, 'file.ts')).toBe(true);
			expect(filer_test_regexp(pattern, 'file.js')).toBe(false);
		});

		test('handles case-insensitive patterns', () => {
			const pattern = /\.TS$/i;
			expect(filer_test_regexp(pattern, 'file.ts')).toBe(true);
			expect(filer_test_regexp(pattern, 'file.TS')).toBe(true);
		});
	});

	describe('global flag handling', () => {
		test('resets lastIndex for global patterns', () => {
			const pattern = /test/g;

			// First call should match
			expect(filer_test_regexp(pattern, 'test1')).toBe(true);

			// Without reset, global flag would cause lastIndex to be at end
			// But with reset, this should still match from beginning
			expect(filer_test_regexp(pattern, 'test2')).toBe(true);
		});

		test('global pattern works correctly multiple times', () => {
			const pattern = /\d+/g;

			// Should match consistently
			expect(filer_test_regexp(pattern, 'abc123def')).toBe(true);
			expect(filer_test_regexp(pattern, 'xyz456ghi')).toBe(true);
			expect(filer_test_regexp(pattern, 'nodigits')).toBe(false);
		});

		test('global pattern lastIndex behavior without helper', () => {
			// This test demonstrates the problem the helper solves
			const pattern = /test/g;

			// Direct use without reset
			expect(pattern.test('test1')).toBe(true);
			// This would fail without reset because lastIndex is now 4
			expect(pattern.test('test2')).toBe(false);

			// Reset manually
			pattern.lastIndex = 0;
			expect(pattern.test('test2')).toBe(true);
		});
	});

	describe('sticky flag handling', () => {
		test('resets lastIndex for sticky patterns', () => {
			// Sticky pattern that matches at beginning
			const pattern = /^test/y;

			expect(filer_test_regexp(pattern, 'test1')).toBe(true);
			expect(filer_test_regexp(pattern, 'test2')).toBe(true);
		});

		test('sticky pattern with position-sensitive matching', () => {
			const pattern = /test/y;

			// Should always test from position 0 due to reset
			expect(filer_test_regexp(pattern, 'test123')).toBe(true);
			expect(filer_test_regexp(pattern, 'test456')).toBe(true);
			expect(filer_test_regexp(pattern, 'notest')).toBe(false);
		});
	});

	describe('hasIndices flag handling', () => {
		test('handles hasIndices flag when available', () => {
			// Check if hasIndices is available in this environment
			if ('hasIndices' in RegExp.prototype) {
				const pattern = /^test/d; // Anchored to start to ensure predictable matching
				expect(filer_test_regexp(pattern, 'test123')).toBe(true);
				expect(filer_test_regexp(pattern, 'notest')).toBe(false);
			} else {
				// Skip test if hasIndices not available
				expect(true).toBe(true);
			}
		});

		test('hasIndices does not affect matching behavior', () => {
			if ('hasIndices' in RegExp.prototype) {
				const pattern_without = /test/;
				const pattern_with = /test/d;

				const test_string = 'test123';
				expect(filer_test_regexp(pattern_without, test_string)).toBe(
					filer_test_regexp(pattern_with, test_string),
				);
			} else {
				expect(true).toBe(true);
			}
		});
	});

	describe('unicode flag handling', () => {
		test('handles unicode flag correctly', () => {
			const pattern = /\u{1F600}/u; // 😀 emoji
			expect(filer_test_regexp(pattern, 'hello 😀 world')).toBe(true);
			expect(filer_test_regexp(pattern, 'hello world')).toBe(false);
		});

		test('unicode flag with repeated calls', () => {
			const pattern = /\p{Emoji}/u;
			expect(filer_test_regexp(pattern, '🎉')).toBe(true);
			expect(filer_test_regexp(pattern, '🚀')).toBe(true);
			expect(filer_test_regexp(pattern, 'abc')).toBe(false);
		});
	});

	describe('unicodeSets flag handling', () => {
		test('handles unicodeSets flag when available', () => {
			// Check if unicodeSets (v flag) is available
			try {
				const pattern = /[\p{Emoji}&&\q{🎉}]/v;
				expect(filer_test_regexp(pattern, '🎉')).toBe(true);
				expect(filer_test_regexp(pattern, 'abc')).toBe(false);
			} catch {
				// v flag not available in this environment
				expect(true).toBe(true);
			}
		});
	});

	describe('combined flags', () => {
		test('handles global + unicode flags', () => {
			const pattern = /\p{Emoji}/gu;
			expect(filer_test_regexp(pattern, '🎉 test')).toBe(true);
			expect(filer_test_regexp(pattern, '🚀 test')).toBe(true);
		});

		test('handles sticky + unicode flags', () => {
			const pattern = /^\p{Emoji}/uy;
			expect(filer_test_regexp(pattern, '🎉test')).toBe(true);
			expect(filer_test_regexp(pattern, '🚀test')).toBe(true);
			expect(filer_test_regexp(pattern, 'a🎉test')).toBe(false);
		});

		test('handles global + hasIndices when available', () => {
			if ('hasIndices' in RegExp.prototype) {
				const pattern = /test/dg;
				expect(filer_test_regexp(pattern, 'test123')).toBe(true);
				expect(filer_test_regexp(pattern, 'test456')).toBe(true);
			} else {
				expect(true).toBe(true);
			}
		});
	});

	describe('edge cases', () => {
		test('handles empty string', () => {
			const pattern = /^$/;
			expect(filer_test_regexp(pattern, '')).toBe(true);
			expect(filer_test_regexp(pattern, 'a')).toBe(false);
		});

		test('handles complex patterns', () => {
			const pattern = /(?=.*\.ts$)(?=.*\/src\/).*/g; // Positive lookaheads with global
			expect(filer_test_regexp(pattern, '/project/src/file.ts')).toBe(true);
			expect(filer_test_regexp(pattern, '/project/src/another.ts')).toBe(true);
			expect(filer_test_regexp(pattern, '/project/lib/file.ts')).toBe(false);
		});

		test('handles patterns with special characters', () => {
			const pattern = /\$\{\w+\}/g; // Template literal pattern
			expect(filer_test_regexp(pattern, 'hello ${name} world')).toBe(true);
			expect(filer_test_regexp(pattern, 'hello ${age} world')).toBe(true);
			expect(filer_test_regexp(pattern, 'hello world')).toBe(false);
		});
	});

	describe('performance and consistency', () => {
		test('consistent results across multiple calls', () => {
			const patterns = [/test/g, /test/y, /test/gi, /test/gy];

			patterns.forEach((pattern) => {
				const results = Array.from({length: 10}, () => filer_test_regexp(pattern, 'test123'));

				// All results should be the same
				expect(results.every((r) => r === results[0])).toBe(true);
				expect(results[0]).toBe(true);
			});
		});

		test('resets lastIndex for stateful patterns', () => {
			const pattern = /test/g;
			const original_flags = pattern.flags;
			const original_source = pattern.source;

			// Set lastIndex to non-zero to simulate prior usage
			pattern.lastIndex = 5;

			const result = filer_test_regexp(pattern, 'test123');

			expect(pattern.flags).toBe(original_flags);
			expect(pattern.source).toBe(original_source);
			expect(result).toBe(true);
			expect(pattern.lastIndex).toBe(4);
		});
	});
});
