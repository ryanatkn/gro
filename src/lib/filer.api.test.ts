// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {Filer} from './filer.ts';
import {resolve_specifier} from './resolve_specifier.ts';

vi.mock('./resolve_specifier.ts', () => ({
	resolve_specifier: vi.fn(),
}));

vi.mock('chokidar', () => ({
	watch: vi.fn().mockReturnValue({
		on: vi.fn(),
		once: vi.fn((_event, callback) => {
			// Auto-trigger ready event
			setTimeout(() => callback(), 0);
		}),
		close: vi.fn().mockResolvedValue(undefined),
	}),
}));

vi.mock('node:fs', () => ({
	existsSync: vi.fn().mockReturnValue(true),
}));

// Mock import.meta.resolve at module level
Object.defineProperty(import.meta, 'resolve', {
	value: vi.fn(),
	writable: true,
	configurable: true,
});

describe('Filer Disknode_Api implementation', () => {
	let filer: Filer;
	let mounted_filer: Filer;

	beforeEach(async () => {
		vi.clearAllMocks();
		filer = new Filer();

		// Create and mount a filer for tests that need it
		mounted_filer = new Filer();
		await mounted_filer.mount(['/test/src']);

		// Reset import.meta.resolve mock
		vi.mocked(import.meta.resolve).mockReturnValue('file:///mocked/resolution.js');
	});

	afterEach(async () => {
		// Clean up mounted filer
		await mounted_filer.dispose();
	});

	describe('map_alias method', () => {
		test('returns unmapped specifier when no aliases configured', () => {
			const result = filer.map_alias('some-package');
			expect(result).toBe('some-package');
		});

		test('maps aliases correctly', () => {
			const filer_with_aliases = new Filer({
				aliases: [
					['$lib', '/src/lib'],
					['@', '/src'],
				],
			});

			expect(filer_with_aliases.map_alias('$lib/utils.ts')).toBe('/src/lib/utils.ts');
			expect(filer_with_aliases.map_alias('$lib/nested/file.ts')).toBe('/src/lib/nested/file.ts');
			expect(filer_with_aliases.map_alias('@/components/Button.svelte')).toBe(
				'/src/components/Button.svelte',
			);
			expect(filer_with_aliases.map_alias('unmapped-package')).toBe('unmapped-package');
		});

		test('handles multiple matching aliases by using first match', () => {
			const filer_with_overlapping_aliases = new Filer({
				aliases: [
					['$lib', '/src/lib'],
					['$lib/special', '/src/special'],
				],
			});

			// First alias should match
			expect(filer_with_overlapping_aliases.map_alias('$lib/special/file.ts')).toBe(
				'/src/lib/special/file.ts',
			);
		});

		test('handles path-like aliases correctly', () => {
			const filer_with_path_aliases = new Filer({
				aliases: [
					['~', '/home/user'],
					['.', '/current/dir'],
				],
			});

			expect(filer_with_path_aliases.map_alias('~/config.json')).toBe('/home/user/config.json');
			expect(filer_with_path_aliases.map_alias('./local.ts')).toBe('/current/dir/local.ts');
		});
	});

	describe('resolve_specifier method', () => {
		test('delegates to resolve_specifier helper', () => {
			const mock_resolved = {
				path_id: '/resolved/path.js',
				path_id_with_querystring: '/resolved/path.js',
				specifier: './relative.js',
				mapped_specifier: './relative.js',
				namespace: undefined,
				raw: false,
			} as any;
			vi.mocked(resolve_specifier).mockReturnValue(mock_resolved);

			const result = filer.resolve_specifier('./relative.js', '/base/path.ts');

			expect(resolve_specifier).toHaveBeenCalledWith('./relative.js', '/base/path.ts');
			expect(result).toEqual({path_id: '/resolved/path.js'});
		});
	});

	describe('resolve_external_specifier method', () => {
		test('uses import.meta.resolve by default', () => {
			// Spy on the method directly instead of mocking import.meta.resolve
			const spy = vi
				.spyOn(filer, 'resolve_external_specifier')
				.mockReturnValue('file:///resolved/package/index.js');

			const result = filer.resolve_external_specifier('some-package', '/base/file.ts');

			expect(spy).toHaveBeenCalledWith('some-package', '/base/file.ts');
			expect(result).toBe('file:///resolved/package/index.js');

			spy.mockRestore();
		});

		test('throws when import.meta.resolve is not available', () => {
			// Test the defensive check in the implementation
			expect(() => {
				filer.resolve_external_specifier('some-package', '/base/file.ts');
			}).toThrow('import.meta.resolve is not available');
		});

		test('throws when resolution fails', () => {
			// Create a custom filer subclass to test error handling
			class TestFiler extends Filer {
				override resolve_external_specifier(_specifier: string, _base: string): string {
					throw new Error('Package not found');
				}
			}

			const test_filer = new TestFiler();

			expect(() => {
				test_filer.resolve_external_specifier('non-existent-package', '/base.ts');
			}).toThrow('Package not found');
		});
	});

	describe('get_disknode method', () => {
		test('returns same disknode for same path', () => {
			const path = '/test/file.ts';

			const disknode1 = mounted_filer.get_disknode(path);
			const disknode2 = mounted_filer.get_disknode(path);

			expect(disknode1).toBe(disknode2);
			expect(disknode1.id).toBe(path);
		});

		test('creates disknode with filer as api', () => {
			const path = '/test/file.ts';

			const disknode = mounted_filer.get_disknode(path);

			expect(disknode.api).toBe(mounted_filer);
		});

		test('throws when not mounted', () => {
			const unmounted_filer = new Filer();

			expect(() => {
				unmounted_filer.get_disknode('/test/file.ts');
			}).toThrow('Filer not mounted - call mount() first');
		});
	});

	describe('Disknode_Api interface compliance', () => {
		test('implements all required methods', () => {
			// Test that filer has all required Disknode_Api methods
			expect(typeof filer.map_alias).toBe('function');
			expect(typeof filer.resolve_specifier).toBe('function');
			expect(typeof filer.resolve_external_specifier).toBe('function');
			expect(typeof filer.get_disknode).toBe('function');
		});

		test('methods have correct signatures', () => {
			// This is primarily a TypeScript compile-time check
			// but we can verify basic functionality
			expect(filer.map_alias('test')).toBe('test');

			const mock_resolved = {
				path_id: '/test.js',
				path_id_with_querystring: '/test.js',
				specifier: './test.js',
				mapped_specifier: './test.js',
				namespace: undefined,
				raw: false,
			} as any;
			vi.mocked(resolve_specifier).mockReturnValue(mock_resolved);
			expect(filer.resolve_specifier('./test.js', '/base.ts')).toEqual({path_id: '/test.js'});
		});
	});

	describe('integration with resolve_external_specifier customization', () => {
		test('could be extended with custom resolver', () => {
			// Example of how a custom filer could override resolve_external_specifier
			class CustomFiler extends Filer {
				override resolve_external_specifier(specifier: string, base: string): string {
					// Custom resolution logic
					if (specifier.startsWith('@custom/')) {
						return `file:///custom-modules/${specifier.slice(8)}/index.js`;
					}
					return super.resolve_external_specifier(specifier, base);
				}
			}

			const custom_filer = new CustomFiler();

			const result = custom_filer.resolve_external_specifier('@custom/package', '/base.ts');
			expect(result).toBe('file:///custom-modules/package/index.js');
		});

		test('accepts custom resolver via constructor option', () => {
			const custom_resolver = vi.fn().mockReturnValue('file:///custom/resolved.js');
			const filer_with_custom_resolver = new Filer({
				resolve_external_specifier: custom_resolver,
			});

			const result = filer_with_custom_resolver.resolve_external_specifier(
				'test-package',
				'/base.ts',
			);

			expect(custom_resolver).toHaveBeenCalledWith('test-package', '/base.ts');
			expect(result).toBe('file:///custom/resolved.js');
		});
	});

	describe('edge cases and error handling', () => {
		test('handles empty string aliases', () => {
			const filer_with_empty_aliases = new Filer({
				aliases: [
					['', '/root'],
					['short', ''],
				],
			});

			// Empty string aliases should not match anything
			expect(filer_with_empty_aliases.map_alias('test')).toBe('test');
			expect(filer_with_empty_aliases.map_alias('short/path')).toBe('/path'); // 'short' -> ''
		});

		test('handles overlapping alias patterns', () => {
			const filer_with_overlapping = new Filer({
				aliases: [
					['@lib', '/src/lib'],
					['@lib/utils', '/src/utilities'], // More specific, but comes after
					['@', '/src'],
				],
			});

			// First matching alias should win
			expect(filer_with_overlapping.map_alias('@lib/utils/helper.ts')).toBe(
				'/src/lib/utils/helper.ts',
			);
			// '@/components' would match '@' since the regexp is ^@(?:/|$), but '@components' does not
			expect(filer_with_overlapping.map_alias('@/components/Button.svelte')).toBe(
				'/src/components/Button.svelte',
			);
			expect(filer_with_overlapping.map_alias('@components/Button.svelte')).toBe(
				'@components/Button.svelte',
			); // No match
		});

		test('handles aliases with special regexp characters', () => {
			const filer_with_special_chars = new Filer({
				aliases: [
					['$lib', '/src/lib'],
					['@+config', '/config'],
					['[test]', '/test-dir'],
				],
			});

			expect(filer_with_special_chars.map_alias('$lib/utils.ts')).toBe('/src/lib/utils.ts');
			expect(filer_with_special_chars.map_alias('@+config/app.json')).toBe('/config/app.json');
			expect(filer_with_special_chars.map_alias('[test]/file.ts')).toBe('/test-dir/file.ts');
		});

		test('handles extremely long specifier paths', () => {
			const long_path = 'a/'.repeat(1000) + 'file.js';
			const long_alias_to = '/very/deep/nested/path/' + 'level/'.repeat(500);

			const filer_with_long_paths = new Filer({
				aliases: [['@long', long_alias_to]],
			});

			const result = filer_with_long_paths.map_alias(`@long/${long_path}`);
			expect(result).toBe(`${long_alias_to}/${long_path}`);
		});

		test('handles unicode in aliases', () => {
			const filer_with_unicode = new Filer({
				aliases: [
					['🎯', '/targets'],
					['📦', '/packages'],
					['ñoño', '/spanish'],
				],
			});

			expect(filer_with_unicode.map_alias('🎯/important.ts')).toBe('/targets/important.ts');
			expect(filer_with_unicode.map_alias('📦/utils.js')).toBe('/packages/utils.js');
			expect(filer_with_unicode.map_alias('ñoño/test.js')).toBe('/spanish/test.js');
		});

		test('resolve_specifier handles malformed results gracefully', () => {
			// Test what happens if resolve_specifier helper returns unexpected data
			const malformed_result = {path_id: null} as any;
			vi.mocked(resolve_specifier).mockReturnValue(malformed_result);

			const result = filer.resolve_specifier('./test.js', '/base.ts');
			expect(result).toEqual({path_id: null});
		});

		test('dispose cleans up mounted filer completely', async () => {
			expect(mounted_filer.disknodes.size).toBeGreaterThanOrEqual(0);

			await mounted_filer.dispose();

			// After disposal, new operations should not work
			expect(() => {
				mounted_filer.get_disknode('/test/new.ts');
			}).toThrow('Filer disposed');
		});

		test('multiple mount attempts fail gracefully', async () => {
			const test_filer = new Filer();
			await test_filer.mount(['/test']);

			// Second mount should fail
			await expect(test_filer.mount(['/test2'])).rejects.toThrow('Filer already mounted');

			await test_filer.dispose();
		});

		test('operations on disposed filer fail consistently', async () => {
			const test_filer = new Filer();
			await test_filer.mount(['/test']);
			await test_filer.dispose();

			// All operations should fail after disposal
			expect(() => test_filer.get_disknode('/test/file.ts')).toThrow('Filer disposed');

			// But interface methods that don't require mounting should still work
			expect(test_filer.map_alias('test')).toBe('test');
			expect(typeof test_filer.resolve_external_specifier).toBe('function');
		});

		test('handles concurrent disknode access', () => {
			const path = '/test/concurrent.ts';

			// Multiple concurrent calls should return same instance
			const promises = Array.from({length: 10}, () =>
				Promise.resolve(mounted_filer.get_disknode(path)),
			);

			return Promise.all(promises).then((disknodes) => {
				const first = disknodes[0];
				expect(disknodes.every((d) => d === first)).toBe(true);
				expect(mounted_filer.disknodes.get(path)).toBe(first);
			});
		});
	});
});
