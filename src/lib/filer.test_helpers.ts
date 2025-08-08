// @slop Claude Opus 4.1

import {beforeEach, afterEach, vi} from 'vitest';
import {existsSync, type Stats} from 'node:fs';
import {stat, lstat, readFile} from 'node:fs/promises';
import {watch, type ChokidarOptions, type FSWatcher} from 'chokidar';

import {Filer, type Filer_Options} from './filer.ts';
import type {Filer_Observer} from './filer_helpers.ts';

/**
 * Mock FSWatcher implementation for testing.
 */
export class Mock_Watcher implements Partial<FSWatcher> {
	// @ts-expect-error - intentionally partial implementation
	listeners: Map<string, Array<(...args: Array<any>) => void>> = new Map();

	// @ts-expect-error - intentionally partial implementation
	on(event: string, handler: (...args: Array<any>) => void): this {
		const handlers = this.listeners.get(event) || [];
		handlers.push(handler);
		this.listeners.set(event, handlers);
		return this;
	}

	// @ts-expect-error - intentionally partial implementation
	once(event: string, handler: (...args: Array<any>) => void): this {
		return this.on(event, handler);
	}

	// @ts-expect-error - intentionally partial implementation
	emit(event: string, ...args: Array<any>): void {
		const handlers = this.listeners.get(event) || [];
		handlers.forEach((h) => h(...args));
	}

	close(): Promise<void> {
		this.listeners.clear();
		return Promise.resolve();
	}
}

/**
 * Mock stats factory for creating test Stats objects.
 */
export const create_mock_stats = (options: Partial<Stats> = {}): Stats =>
	({
		isFile: () => !options.isDirectory?.(),
		isDirectory: () => false,
		isSymbolicLink: () => false,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		dev: 1,
		ino: 1,
		mode: 33188,
		nlink: 1,
		uid: 1000,
		gid: 1000,
		rdev: 0,
		size: 100,
		blksize: 4096,
		blocks: 8,
		atimeMs: Date.now(),
		mtimeMs: Date.now(),
		ctimeMs: Date.now(),
		birthtimeMs: Date.now(),
		atime: new Date(),
		mtime: new Date(),
		ctime: new Date(),
		birthtime: new Date(),
		...options,
	}) as Stats;

/**
 * Automatic filer disposal context that tracks created filers
 * and disposes them automatically.
 */
export class Filer_Test_Context {
	#filers: Set<Filer> = new Set();
	#mock_watcher: Mock_Watcher = new Mock_Watcher();

	get mock_watcher(): Mock_Watcher {
		return this.#mock_watcher;
	}

	/**
	 * Create an unmounted Filer instance that will be automatically disposed.
	 * Use this when you need to test behavior before mounting or need manual mount control.
	 */
	create_unmounted_filer(options?: Filer_Options): Filer {
		// Disable workers by default in tests to prevent module resolution issues
		const filer = new Filer({worker_enabled: false, ...options});
		this.#filers.add(filer);
		return filer;
	}

	/**
	 * Create a mounted Filer instance that is ready to use.
	 * This is the preferred method unless you specifically need unmounted behavior.
	 */
	async create_mounted_filer(
		options?: Filer_Options & {paths?: Array<string>; chokidar_options?: ChokidarOptions},
	): Promise<Filer> {
		const {paths, chokidar_options, ...filer_options} = options ?? {};
		const filer = this.create_unmounted_filer(filer_options);
		await filer.mount(paths, chokidar_options);
		return filer;
	}

	/**
	 * Helper to set up test filer with observers properly.
	 */
	async setup_test_filer(options: {
		intent_observer: Filer_Observer;
		tracking_observer: Filer_Observer;
		other_observers?: Array<Filer_Observer>;
	}): Promise<Filer> {
		const {intent_observer, tracking_observer, other_observers = []} = options;

		const filer = this.create_unmounted_filer({
			batch_delay: 0,
			observers: [intent_observer, tracking_observer, ...other_observers],
		});
		await filer.mount(['/test/project/src']);

		return filer;
	}

	/**
	 * Set up mocks for the current test context.
	 * Can optionally provide file contents for specific paths.
	 */
	setup_mocks(file_contents?: Map<string, string>): void {
		// Reset the mock watcher for each test to ensure clean state
		this.#mock_watcher = new Mock_Watcher();

		vi.mocked(watch).mockImplementation(() => {
			// Always return the current mock watcher instance so tests can emit events on it
			// Auto-emit ready after a short delay to prevent hanging
			setTimeout(() => this.#mock_watcher.emit('ready'), 0);
			return this.#mock_watcher as unknown as FSWatcher;
		});
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(stat).mockResolvedValue(create_mock_stats());
		vi.mocked(lstat).mockResolvedValue(create_mock_stats());

		// Set up readFile mock with specific contents or default to empty
		vi.mocked(readFile).mockImplementation(async (path) => {
			if (file_contents?.has(path.toString())) {
				return file_contents.get(path.toString())!;
			}
			return ''; // Default empty file contents
		});
	}

	/**
	 * Set up file contents for specific paths.
	 * Must be called after setup_mocks but before file operations.
	 */
	set_file_contents(file_contents: Map<string, string>): void {
		vi.mocked(readFile).mockImplementation(async (path) => {
			return file_contents.get(path.toString()) ?? '';
		});
	}

	/**
	 * Dispose all tracked filers and reset the context.
	 */
	async dispose_all(): Promise<void> {
		await Promise.all(Array.from(this.#filers).map((filer) => filer.dispose()));
		this.#filers.clear();
		// Close the current mock watcher to clean up any lingering event handlers
		await this.#mock_watcher.close();
		this.#mock_watcher = new Mock_Watcher();
	}
}

/**
 * Hook to set up automatic filer disposal for tests.
 * Call this once per test suite to get automatic cleanup.
 * Each call creates a fresh, isolated test context.
 *
 * @returns The test context for creating filers
 */
export const use_filer_test_context = (): Filer_Test_Context => {
	const context = new Filer_Test_Context();

	beforeEach(() => {
		// Create fresh mock implementations for each test
		context.setup_mocks();
	});

	afterEach(async () => {
		await context.dispose_all();
		// Don't restore all mocks - this can interfere with test-specific mocks
		// Only restore the specific mocks we manage
		vi.mocked(watch).mockRestore();
		vi.mocked(existsSync).mockRestore();
		vi.mocked(stat).mockRestore();
		vi.mocked(lstat).mockRestore();
		vi.mocked(readFile).mockRestore();
	});

	return context;
};

/**
 * Helper to wait for batch processing.
 */
export const wait_for_batch = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to create realistic file contents with import statements.
 */
export const create_file_with_imports = (imports: Array<string>): string => {
	const import_statements = imports.map((imp, i) => `import {value${i}} from '${imp}';`).join('\n');
	return `${import_statements}\n\n// Mock file content\nexport const value = 42;\n`;
};

/**
 * Helper to set up a dependency chain using import-based relationships.
 * Sets up file contents with actual import statements instead of manual relationships.
 */
export const setup_import_chain = (file_chain: Array<{path: string; imports: Array<string>}>) => {
	const file_contents = new Map<string, string>();

	for (const {path, imports} of file_chain) {
		file_contents.set(path, create_file_with_imports(imports));
	}

	return file_contents;
};

/**
 * Common test constants.
 */
export const TEST_PATHS = {
	ROOT: '/test/project',
	SOURCE: '/test/project/src',
	FILE_A: '/test/project/src/a.ts',
	FILE_B: '/test/project/src/b.ts',
	FILE_C: '/test/project/src/c.ts',
	FILE_D: '/test/project/src/d.ts',
	FILE_E: '/test/project/src/e.ts',
	FILE_JS: '/test/project/src/app.js',
	DIR_LIB: '/test/project/src/lib',
	FILE_LIB_D: '/test/project/src/lib/d.ts',
	FILE_LIB_E: '/test/project/src/lib/e.ts',
	FILE_LIB_F: '/test/project/src/lib/f.ts',
	EXTERNAL_FILE: '/external/file.ts',
	CONFIG_FILE: '/test/project/package.json',
	JSON_FILE: '/test/project/src/data.json',
} as const;
