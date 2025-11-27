import {test, assert, vi} from 'vitest';

import type {WatchNodeFs} from '../lib/watch_dir.ts';
import {Filer, filter_dependents} from '../lib/filer.ts';
import type {Disknode} from '../lib/disknode.ts';

/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-empty-function */

// filter_dependents tests
test('filter_dependents finds direct dependents', () => {
	// Create a simple dependency graph: A <- B <- C
	const fileA: Disknode = {
		id: '/test/a.ts',
		contents: 'export const a = 1',
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileB: Disknode = {
		id: '/test/b.ts',
		contents: "import {a} from './a'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileC: Disknode = {
		id: '/test/c.ts',
		contents: "import {b} from './b'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	// Set up dependencies: A <- B <- C
	fileB.dependencies.set(fileA.id, fileA);
	fileA.dependents.set(fileB.id, fileB);

	fileC.dependencies.set(fileB.id, fileB);
	fileB.dependents.set(fileC.id, fileC);

	const get_by_id = (id: string) => {
		if (id === fileA.id) return fileA;
		if (id === fileB.id) return fileB;
		if (id === fileC.id) return fileC;
		return undefined;
	};

	// Find all dependents of A
	const results = filter_dependents(fileA, get_by_id);

	assert.equal(results.size, 2);
	assert.ok(results.has(fileB.id));
	assert.ok(results.has(fileC.id));
});

test('filter_dependents with filter predicate', () => {
	// Create dependency graph: A <- B <- C
	const fileA: Disknode = {
		id: '/test/a.ts',
		contents: 'export const a = 1',
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileB: Disknode = {
		id: '/test/b.js',
		contents: "import {a} from './a'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileC: Disknode = {
		id: '/test/c.ts',
		contents: "import {b} from './b'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	// Set up dependencies
	fileB.dependencies.set(fileA.id, fileA);
	fileA.dependents.set(fileB.id, fileB);

	fileC.dependencies.set(fileB.id, fileB);
	fileB.dependents.set(fileC.id, fileC);

	const get_by_id = (id: string) => {
		if (id === fileA.id) return fileA;
		if (id === fileB.id) return fileB;
		if (id === fileC.id) return fileC;
		return undefined;
	};

	// Find only .ts dependents of A
	const results = filter_dependents(fileA, get_by_id, (id) => id.endsWith('.ts'));

	// Should only include C (not B which is .js)
	assert.equal(results.size, 1);
	assert.ok(results.has(fileC.id));
	assert.ok(!results.has(fileB.id));
});

test('filter_dependents handles circular dependencies', () => {
	// Create circular dependency: A <- B <- C <- A
	const fileA: Disknode = {
		id: '/test/a.ts',
		contents: "import {c} from './c'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileB: Disknode = {
		id: '/test/b.ts',
		contents: "import {a} from './a'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileC: Disknode = {
		id: '/test/c.ts',
		contents: "import {b} from './b'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	// Set up circular dependencies
	fileB.dependencies.set(fileA.id, fileA);
	fileA.dependents.set(fileB.id, fileB);

	fileC.dependencies.set(fileB.id, fileB);
	fileB.dependents.set(fileC.id, fileC);

	fileA.dependencies.set(fileC.id, fileC);
	fileC.dependents.set(fileA.id, fileA);

	const get_by_id = (id: string) => {
		if (id === fileA.id) return fileA;
		if (id === fileB.id) return fileB;
		if (id === fileC.id) return fileC;
		return undefined;
	};

	// Should handle circular deps without infinite loop
	const results = filter_dependents(fileA, get_by_id);

	// Should include all files in the cycle
	assert.equal(results.size, 3);
	assert.ok(results.has(fileA.id));
	assert.ok(results.has(fileB.id));
	assert.ok(results.has(fileC.id));
});

test('filter_dependents returns empty set when no dependents', () => {
	const fileA: Disknode = {
		id: '/test/a.ts',
		contents: 'export const a = 1',
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const get_by_id = (id: string) => (id === fileA.id ? fileA : undefined);

	const results = filter_dependents(fileA, get_by_id);

	assert.equal(results.size, 0);
});

// Dependency graph building and updates tests
test('tracks dependencies when file imports are parsed', async () => {
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: WatchNodeFs = {
			init: vi.fn(async () => {
				options.on_change({type: 'add', path: '/test/a.ts', is_directory: false});
				options.on_change({type: 'add', path: '/test/b.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});
	await filer.init();

	const file_a = filer.get_by_id('/test/a.ts');
	const file_b = filer.get_by_id('/test/b.ts');

	assert.ok(file_a);
	assert.ok(file_b);

	// Both files should have dependency/dependent maps initialized
	assert.ok(file_a.dependencies instanceof Map);
	assert.ok(file_a.dependents instanceof Map);
	assert.ok(file_b.dependencies instanceof Map);
	assert.ok(file_b.dependents instanceof Map);
});

test('updates dependency graph when file contents change', async () => {
	let on_change_callback: ((change: any) => void) | null = null as any;

	const mock_watch_dir = vi.fn((options) => {
		on_change_callback = options.on_change;
		const mock_watcher: WatchNodeFs = {
			init: vi.fn(async () => {
				options.on_change({type: 'add', path: '/test/main.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});
	await filer.init();

	// Simulate an update to the file
	assert.ok(on_change_callback);
	on_change_callback({type: 'update', path: '/test/main.ts', is_directory: false});

	// Wait for queue processing
	await new Promise((resolve) => setTimeout(resolve, 10));

	const main = filer.get_by_id('/test/main.ts');
	assert.ok(main);
	// File should be tracked after update
	assert.equal(main.id, '/test/main.ts');
});

test('cascading invalidation through dependency chain', async () => {
	// Create dependency chain: a.ts <- b.ts <- c.ts
	const fileA: Disknode = {
		id: '/test/a.ts',
		contents: 'export const a = 1',
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileB: Disknode = {
		id: '/test/b.ts',
		contents: "import {a} from './a'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	const fileC: Disknode = {
		id: '/test/c.ts',
		contents: "import {b} from './b'",
		external: false,
		ctime: 1,
		mtime: 1,
		dependents: new Map(),
		dependencies: new Map(),
	};

	// Set up dependency chain
	fileB.dependencies.set(fileA.id, fileA);
	fileA.dependents.set(fileB.id, fileB);

	fileC.dependencies.set(fileB.id, fileB);
	fileB.dependents.set(fileC.id, fileC);

	const get_by_id = (id: string) => {
		if (id === fileA.id) return fileA;
		if (id === fileB.id) return fileB;
		if (id === fileC.id) return fileC;
		return undefined;
	};

	// When A changes, both B and C should be invalidated
	const dependents = filter_dependents(fileA, get_by_id);

	assert.equal(dependents.size, 2);
	assert.ok(dependents.has(fileB.id));
	assert.ok(dependents.has(fileC.id));
});

test('deleted file with dependents stays in memory', async () => {
	let on_change_callback: ((change: any) => void) | null = null as any;

	const mock_watch_dir = vi.fn((options) => {
		on_change_callback = options.on_change;
		const mock_watcher: WatchNodeFs = {
			init: vi.fn(async () => {
				options.on_change({type: 'add', path: '/test/a.ts', is_directory: false});
				options.on_change({type: 'add', path: '/test/b.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});
	await filer.init();

	const file_a = filer.get_by_id('/test/a.ts');
	const file_b = filer.get_by_id('/test/b.ts');

	assert.ok(file_a);
	assert.ok(file_b);

	// Manually set up dependency: B depends on A
	file_b.dependencies.set(file_a.id, file_a);
	file_a.dependents.set(file_b.id, file_b);

	const size_before = filer.files.size;

	// Delete A while B still depends on it
	assert.ok(on_change_callback);
	on_change_callback({type: 'delete', path: '/test/a.ts', is_directory: false});

	// Wait for queue processing
	await new Promise((resolve) => setTimeout(resolve, 10));

	// A should still be in memory since B depends on it
	const file_a_after = filer.get_by_id('/test/a.ts');
	assert.ok(file_a_after, 'File A should still exist since B depends on it');
	assert.equal(file_a_after.contents, null, 'Contents should be cleared');

	// File should still be in the map
	assert.ok(filer.files.has('/test/a.ts'));

	// File count should not change since A is kept in memory due to dependent
	assert.equal(filer.files.size, size_before, 'File count should remain the same');

	// B should still have A as a dependency (dependency tracking preserved)
	assert.ok(file_a_after.dependents.has('/test/b.ts'));
});
