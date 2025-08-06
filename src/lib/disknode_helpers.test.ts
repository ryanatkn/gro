// @slop Claude Sonnet 4

import {test, expect, describe} from 'vitest';

import {
	disknode_get_extension,
	disknode_is_svelte_module,
	disknode_is_typescript,
	disknode_is_svelte,
	disknode_is_importable,
} from './disknode_helpers.ts';

describe('disknode_get_extension', () => {
	test('returns extension for regular files', () => {
		expect(disknode_get_extension('/path/to/file.ts')).toBe('.ts');
		expect(disknode_get_extension('/path/to/file.js')).toBe('.js');
		expect(disknode_get_extension('/path/to/file.svelte')).toBe('.svelte');
		expect(disknode_get_extension('/path/to/file.json')).toBe('.json');
	});

	test('returns compound extension for nested extensions', () => {
		expect(disknode_get_extension('/path/to/file.d.ts')).toBe('.ts');
		expect(disknode_get_extension('/path/to/file.test.js')).toBe('.js');
		expect(disknode_get_extension('/path/to/file.spec.tsx')).toBe('.tsx');
		expect(disknode_get_extension('/path/to/config.development.json')).toBe('.json');
	});

	test('returns empty string for files without extension', () => {
		expect(disknode_get_extension('/path/to/README')).toBe('');
		expect(disknode_get_extension('/path/to/Dockerfile')).toBe('');
		expect(disknode_get_extension('/path/to/makefile')).toBe('');
	});

	test('returns empty string for hidden files without second dot', () => {
		expect(disknode_get_extension('/path/to/.gitignore')).toBe('');
		expect(disknode_get_extension('/path/to/.eslintrc')).toBe('');
		expect(disknode_get_extension('/path/to/.env')).toBe('');
		expect(disknode_get_extension('.bashrc')).toBe('');
	});

	test('returns extension for hidden files with second dot', () => {
		expect(disknode_get_extension('/path/to/.env.local')).toBe('.local');
		expect(disknode_get_extension('/path/to/.eslintrc.json')).toBe('.json');
		expect(disknode_get_extension('/path/to/.gitignore.backup')).toBe('.backup');
		expect(disknode_get_extension('.env.development')).toBe('.development');
	});

	test('handles edge cases correctly', () => {
		expect(disknode_get_extension('')).toBe('');
		expect(disknode_get_extension('.')).toBe('');
		expect(disknode_get_extension('..')).toBe('.'); // lastIndexOf('.') returns 1, so it's slice(1) = '.'
		expect(disknode_get_extension('...')).toBe('.'); // lastIndexOf('.') returns 2, so it's slice(2) = '.'
		expect(disknode_get_extension('.a.b')).toBe('.b');
		expect(disknode_get_extension('a.')).toBe('.');
	});

	test('optimized hidden file detection (regression test)', () => {
		// These should use the optimized indexOf('.', 1) instead of slice(1).includes('.')
		expect(disknode_get_extension('.hidden')).toBe('');
		expect(disknode_get_extension('.hidden.txt')).toBe('.txt');

		// Ensure it still works correctly for long hidden filenames
		expect(disknode_get_extension('.very.long.hidden.file.name.txt')).toBe('.txt');
		expect(disknode_get_extension('.single_name_no_extension')).toBe('');
	});
});

describe('disknode_is_svelte_module', () => {
	test('correctly identifies Svelte TS modules', () => {
		expect(disknode_is_svelte_module('/path/to/Component.svelte.ts')).toBe(true);
		expect(disknode_is_svelte_module('/path/Component.svelte.ts')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.ts')).toBe(true);
	});

	test('correctly identifies Svelte JS modules', () => {
		expect(disknode_is_svelte_module('/path/to/Component.svelte.js')).toBe(true);
		expect(disknode_is_svelte_module('/path/Component.svelte.js')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.js')).toBe(true);
	});

	test('correctly identifies Svelte TSX modules', () => {
		expect(disknode_is_svelte_module('/path/to/Component.svelte.tsx')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.tsx')).toBe(true);
	});

	test('correctly identifies Svelte JSX modules', () => {
		expect(disknode_is_svelte_module('/path/to/Component.svelte.jsx')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.jsx')).toBe(true);
	});

	test('correctly identifies CommonJS/ES6 variants', () => {
		expect(disknode_is_svelte_module('Component.svelte.mjs')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.cjs')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.mts')).toBe(true);
		expect(disknode_is_svelte_module('Component.svelte.cts')).toBe(true);
	});

	test('rejects regular Svelte files', () => {
		expect(disknode_is_svelte_module('/path/to/Component.svelte')).toBe(false);
		expect(disknode_is_svelte_module('Component.svelte')).toBe(false);
	});

	test('rejects non-Svelte files', () => {
		expect(disknode_is_svelte_module('/path/to/file.ts')).toBe(false);
		expect(disknode_is_svelte_module('/path/to/file.js')).toBe(false);
		expect(disknode_is_svelte_module('/path/to/svelte.config.js')).toBe(false);
		expect(disknode_is_svelte_module('/path/to/Component.vue')).toBe(false);
	});

	test('rejects non-JS/TS files with .svelte. substring', () => {
		expect(disknode_is_svelte_module('/path/to/Component.svelte.config')).toBe(false);
		expect(disknode_is_svelte_module('/path/to/Component.svelte.json')).toBe(false);
		expect(disknode_is_svelte_module('/path/to/Component.svelte.md')).toBe(false);
	});

	test('matches JS/TS files with .svelte. infix', () => {
		expect(disknode_is_svelte_module('/path/my.svelte.config.js')).toBe(true);
		expect(disknode_is_svelte_module('/project/.svelte.kit/types.d.ts')).toBe(true);
		expect(disknode_is_svelte_module('/docs/about.svelte.components.ts')).toBe(true);
	});

	test('handles edge cases', () => {
		expect(disknode_is_svelte_module('')).toBe(false);
		expect(disknode_is_svelte_module('.svelte.ts')).toBe(true);
		expect(disknode_is_svelte_module('a.svelte.ts')).toBe(true);
	});
});

describe('disknode type checking integration', () => {
	test('is_svelte_module should not overlap with other type checks', () => {
		const svelte_module = 'Component.svelte.ts';
		const svelte_file = 'Component.svelte';
		const ts_file = 'utils.ts';

		// Svelte modules should be detected as svelte modules
		expect(disknode_is_svelte_module(svelte_module)).toBe(true);
		expect(disknode_is_svelte(svelte_module)).toBe(false);
		// Note: svelte.ts files end in .ts, so they ARE detected as TypeScript by the base function
		expect(disknode_is_typescript(svelte_module)).toBe(true);

		// Regular svelte files should not be modules
		expect(disknode_is_svelte_module(svelte_file)).toBe(false);
		expect(disknode_is_svelte(svelte_file)).toBe(true);

		// TypeScript files should not be svelte modules
		expect(disknode_is_svelte_module(ts_file)).toBe(false);
		expect(disknode_is_typescript(ts_file)).toBe(true);
	});

	test('importable check includes svelte modules', () => {
		expect(disknode_is_importable('Component.svelte.ts')).toBe(true);
		expect(disknode_is_importable('Component.svelte.js')).toBe(true);
		expect(disknode_is_importable('Component.svelte')).toBe(true);
		expect(disknode_is_importable('utils.ts')).toBe(true);
		expect(disknode_is_importable('utils.js')).toBe(true);
		expect(disknode_is_importable('config.json')).toBe(false);
	});
});
