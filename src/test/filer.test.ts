import {test, assert, vi} from 'vitest';

import type {Watch_Node_Fs} from '../lib/watch_dir.ts';
import {Filer} from '../lib/filer.ts';

/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-empty-function */

// Create a simple mock watch_dir that simulates file discovery
const create_mock_watch_dir = () => {
	return vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				// Simulate discovering files via on_change callbacks
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
				options.on_change({type: 'add', path: '/test/file2.ts', is_directory: false});
				options.on_change({type: 'add', path: '/test/lib/helper.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});
};

test('filer starts uninitialized', async () => {
	const filer = new Filer();
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);
});

test('filer initializes on first init() call', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	assert.equal(filer.inited, false);

	await filer.init();

	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 3);
	assert.equal(mock_watch_dir.mock.calls.length, 1);
});

test('init() is idempotent', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	await filer.init();
	const file_count_first = filer.files.size;

	await filer.init();
	const file_count_second = filer.files.size;

	assert.equal(file_count_first, file_count_second);
	// watch_dir should only be called once
	assert.equal(mock_watch_dir.mock.calls.length, 1);
});

test('concurrent init() calls are handled correctly', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	// Launch multiple init calls simultaneously
	const init_promises = [filer.init(), filer.init(), filer.init(), filer.init(), filer.init()];

	await Promise.all(init_promises);

	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 3);
	// watch_dir should only be called once despite concurrent calls
	assert.equal(mock_watch_dir.mock.calls.length, 1);

	// Call init again to ensure state is consistent
	await filer.init();
	assert.equal(filer.files.size, 3);
});

test('disknode structure is valid', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});
	await filer.init();

	// Check the structure of created disknodes
	const file1 = filer.get_by_id('/test/file1.ts');
	assert.ok(file1);
	assert.equal(file1.id, '/test/file1.ts');
	assert.equal(typeof file1.external, 'boolean');
	assert.ok(file1.dependencies instanceof Map);
	assert.ok(file1.dependents instanceof Map);
});

test('close() cleans up resources', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	await filer.init();

	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 3);

	await filer.close();

	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);
});

test('can reinitialize after close()', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	// First cycle
	await filer.init();
	assert.equal(filer.files.size, 3);
	await filer.close();

	// Second cycle
	await filer.init();
	assert.equal(filer.files.size, 3);

	// watch_dir should be called twice (once per init after close)
	assert.equal(mock_watch_dir.mock.calls.length, 2);
});

test('watch() initializes and notifies listeners', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	const changes: Array<{path: string}> = [];
	const cleanup = await filer.watch((change) => {
		changes.push({path: change.path});
	});

	assert.equal(filer.inited, true);
	// Listener should be notified of existing files
	assert.equal(changes.length, 3);
	assert.ok(changes.some((c) => c.path === '/test/file1.ts'));

	cleanup();
});

test('close() during init() handles gracefully', async () => {
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				// Simulate slow initialization
				await new Promise((resolve) => setTimeout(resolve, 50));
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Start initialization but don't await
	const init_promise = filer.init();

	// Close while initializing
	await filer.close();

	// Initialization should complete without errors
	await init_promise;

	// Filer should be closed
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);
});

test('multiple listeners receive notifications independently', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	const listener1_changes: Array<string> = [];
	const listener2_changes: Array<string> = [];

	const cleanup1 = await filer.watch((change) => {
		listener1_changes.push(change.path);
	});

	const cleanup2 = await filer.watch((change) => {
		listener2_changes.push(change.path);
	});

	// Both listeners should receive the same notifications
	assert.equal(listener1_changes.length, 3);
	assert.equal(listener2_changes.length, 3);
	assert.deepEqual(listener1_changes.sort(), listener2_changes.sort());

	// Remove first listener
	cleanup1();

	// Second listener should still be active
	// (would need to trigger a change to test, but structure is validated)

	cleanup2();
});

test('watch() after init() reuses existing file state', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	// Initialize first
	await filer.init();
	const files_after_init = filer.files.size;

	// Then add a watcher
	const changes: Array<string> = [];
	const cleanup = await filer.watch((change) => {
		changes.push(change.path);
	});

	// Should reuse existing state
	assert.equal(filer.files.size, files_after_init);
	// Listener should be notified of existing files
	assert.equal(changes.length, files_after_init);

	// watch_dir should only be called once
	assert.equal(mock_watch_dir.mock.calls.length, 1);

	cleanup();
});

test('listener can safely remove itself during callback', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	let cleanup_fn: (() => void) | null = null;
	let callback_count = 0;

	cleanup_fn = await filer.watch(async () => {
		callback_count++;
		// Remove self on second callback
		if (callback_count === 2 && cleanup_fn) {
			cleanup_fn();
		}
	});

	// Should have been called for initial files
	assert.ok(callback_count >= 2);
	// No errors should occur
});

test('error in watch_dir.init() is handled', async () => {
	const mock_watch_dir = vi.fn(() => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				throw new Error('Initialization failed');
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// init should propagate the error
	let error_thrown = false;
	try {
		await filer.init();
	} catch (error) {
		error_thrown = true;
		assert.ok(error instanceof Error);
		assert.match(error.message, /Initialization failed/);
	}

	assert.ok(error_thrown, 'Should have thrown an error');

	// Filer should not be marked as initialized
	assert.equal(filer.inited, false);
});

test('listener error does not affect other listeners', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	const good_listener_changes: Array<string> = [];
	let bad_listener_called = false;

	const cleanup1 = await filer.watch(() => {
		bad_listener_called = true;
		throw new Error('Listener error');
	});

	const cleanup2 = await filer.watch((change) => {
		good_listener_changes.push(change.path);
	});

	// Both listeners should have been called despite error
	assert.ok(bad_listener_called);
	assert.equal(good_listener_changes.length, 3);

	cleanup1();
	cleanup2();
});

test('file state remains consistent across operations', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	// First init
	await filer.init();
	const state1 = Array.from(filer.files.keys()).sort();

	// Add and remove listener
	const cleanup = await filer.watch(() => {});
	cleanup();

	// State should be unchanged
	const state2 = Array.from(filer.files.keys()).sort();
	assert.deepEqual(state1, state2);

	// Close and reinit
	await filer.close();
	await filer.init();

	// State should be restored
	const state3 = Array.from(filer.files.keys()).sort();
	assert.deepEqual(state1, state3);
});

test('init() after watch() is idempotent', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	// First add a watcher
	const cleanup = await filer.watch(() => {});
	const files_after_watch = filer.files.size;

	// Then call init - should be a no-op
	await filer.init();
	assert.equal(filer.files.size, files_after_watch);

	// watch_dir should only be called once
	assert.equal(mock_watch_dir.mock.calls.length, 1);

	cleanup();
});

test('multiple close() calls are safe', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	await filer.init();
	assert.equal(filer.inited, true);

	// First close
	await filer.close();
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);

	// Second close - should be safe
	await filer.close();
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);

	// Third close - still safe
	await filer.close();
	assert.equal(filer.inited, false);
});

test('concurrent init and close handle correctly', async () => {
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				// Simulate slower initialization
				await new Promise((resolve) => setTimeout(resolve, 10));
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
				await new Promise((resolve) => setTimeout(resolve, 10));
				options.on_change({type: 'add', path: '/test/file2.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Start multiple concurrent operations
	const operations = Promise.all([
		filer.init(),
		filer.init(),
		new Promise((resolve) => setTimeout(resolve, 5)).then(() => filer.close()),
		filer.init(),
	]);

	// Should complete without errors
	await operations;

	// Final state should be closed
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);
});

test('watcher is cleaned up when init fails after partial success', async () => {
	let mock_watcher: Watch_Node_Fs;
	const mock_watch_dir = vi.fn((options) => {
		mock_watcher = {
			init: vi.fn(async () => {
				// Add some files first
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
				// Then fail
				throw new Error('Init failed after partial success');
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Init should fail
	let error_thrown = false;
	try {
		await filer.init();
	} catch (error) {
		error_thrown = true;
		assert.ok(error instanceof Error);
		assert.match(error.message, /Init failed after partial success/);
	}
	assert.ok(error_thrown, 'Should have thrown an error');

	// Watcher should have been cleaned up
	assert.equal(
		(mock_watcher!.close as any).mock.calls.length,
		1,
		'watcher.close() should be called on error',
	);
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);
});

test('can reinitialize after init error', async () => {
	let should_fail = true;
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				if (should_fail) {
					throw new Error('First init fails');
				}
				// Second init succeeds
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// First init should fail
	let error_thrown = false;
	try {
		await filer.init();
	} catch (error) {
		error_thrown = true;
		assert.ok(error instanceof Error);
		assert.match(error.message, /First init fails/);
	}
	assert.ok(error_thrown, 'Should have thrown an error');

	assert.equal(filer.inited, false);

	// Second init should succeed
	should_fail = false;
	await filer.init();

	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 1);
});

test('listeners can be added/removed during notification', async () => {
	const mock_watch_dir = create_mock_watch_dir();
	const filer = new Filer({watch_dir: mock_watch_dir});

	const events: Array<string> = [];
	let cleanup2: (() => void) | null = null as any;

	// First listener adds a second listener on first event
	const cleanup1 = await filer.watch(async (_change) => {
		events.push('listener1');
		if (events.length === 1) {
			// Add second listener during notification
			await filer
				.watch((_change) => {
					events.push('listener2');
				})
				.then((c) => (cleanup2 = c));
		}
	});

	// Third listener removes itself on second event
	let cleanup3: (() => void) | null = null;
	cleanup3 = await filer.watch(async (_change) => {
		events.push('listener3');
		if (events.length >= 6 && cleanup3) {
			cleanup3();
		}
	});

	// All listeners should handle the initial files
	assert.ok(events.length >= 3);
	assert.ok(events.includes('listener1'));
	assert.ok(events.includes('listener3'));

	cleanup1();
	if (cleanup2) cleanup2();
});

test('closing flag is reset even if close throws', async () => {
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
			}),
			close: vi.fn(async () => {
				throw new Error('Close failed');
			}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});
	await filer.init();

	// Close should throw
	let error_thrown = false;
	try {
		await filer.close();
	} catch (error) {
		error_thrown = true;
		assert.ok(error instanceof Error);
		assert.match(error.message, /Close failed/);
	}
	assert.ok(error_thrown, 'Close should have thrown an error');

	// Should be able to init again (closing flag should be reset)
	// This will fail if #closing is still true
	await filer.init();
	assert.equal(filer.inited, true);
});

test('no partial file state after close during init', async () => {
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
				await new Promise((resolve) => setTimeout(resolve, 20));
				options.on_change({type: 'add', path: '/test/file2.ts', is_directory: false});
				await new Promise((resolve) => setTimeout(resolve, 20));
				options.on_change({type: 'add', path: '/test/file3.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Start init and close after first file
	const init_promise = filer.init();
	await new Promise((resolve) => setTimeout(resolve, 10));
	await filer.close();

	// Wait for init to complete
	await init_promise;

	// Should have no files
	assert.equal(filer.files.size, 0, 'Should have no partial file state');
	assert.equal(filer.inited, false);
});

test('watcher.close() is called on close during init', async () => {
	let mock_watcher: Watch_Node_Fs;
	const mock_watch_dir = vi.fn((options) => {
		mock_watcher = {
			init: vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Start init but don't await
	const init_promise = filer.init();

	// Close while initializing
	await filer.close();
	await init_promise;

	// Watcher should have been closed
	assert.equal(
		(mock_watcher!.close as any).mock.calls.length,
		1,
		'watcher.close() should be called',
	);
});

test('cleanup clears all state including dependencies', async () => {
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				// Add files that will have dependencies
				options.on_change({type: 'add', path: '/test/main.ts', is_directory: false});
				options.on_change({type: 'add', path: '/test/lib.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Add a listener to verify it gets cleared
	let listener_called = false;
	await filer.watch(() => {
		listener_called = true;
	});

	// Verify initial state
	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 2);
	assert.ok(listener_called); // Listener was called during init

	// Close should clear everything
	await filer.close();

	// Verify complete cleanup
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);

	// Try to init again to verify state is fully reset
	await filer.init();
	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 2);
});

test('handles error when watcher.close() fails during init error', async () => {
	let mock_watcher: Watch_Node_Fs;
	let close_error_thrown = false;

	const mock_watch_dir = vi.fn((options) => {
		mock_watcher = {
			init: vi.fn(async () => {
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
				throw new Error('Init failed');
			}),
			close: vi.fn(async () => {
				close_error_thrown = true;
				throw new Error('Close also failed');
			}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// Init should fail with the original error
	let error_thrown = false;
	try {
		await filer.init();
	} catch (error) {
		error_thrown = true;
		assert.ok(error instanceof Error);
		// Should get the init error, not the close error
		assert.match(error.message, /Init failed/);
	}

	assert.ok(error_thrown, 'Init should have thrown');
	assert.ok(close_error_thrown, 'Close should have been attempted');

	// Despite close error, state should still be cleaned up
	assert.equal(filer.inited, false);
	assert.equal(filer.files.size, 0);
});

test('can recover from multiple consecutive init errors', async () => {
	let attempt = 0;
	const mock_watch_dir = vi.fn((options) => {
		const mock_watcher: Watch_Node_Fs = {
			init: vi.fn(async () => {
				attempt++;
				if (attempt <= 2) {
					throw new Error(`Init failed attempt ${attempt}`);
				}
				// Third attempt succeeds
				options.on_change({type: 'add', path: '/test/file1.ts', is_directory: false});
			}),
			close: vi.fn(async () => {}),
		};
		return mock_watcher;
	});

	const filer = new Filer({watch_dir: mock_watch_dir});

	// First attempt fails
	try {
		await filer.init();
		assert.fail('Should have thrown');
	} catch (error) {
		assert.match((error as Error).message, /Init failed attempt 1/);
	}
	assert.equal(filer.inited, false);

	// Second attempt fails
	try {
		await filer.init();
		assert.fail('Should have thrown');
	} catch (error) {
		assert.match((error as Error).message, /Init failed attempt 2/);
	}
	assert.equal(filer.inited, false);

	// Third attempt succeeds
	await filer.init();
	assert.equal(filer.inited, true);
	assert.equal(filer.files.size, 1);
});

test('concurrent close() calls share same promise', async () => {
	let close_call_count = 0;
	let close_resolve: () => void;
	const close_promise: Promise<void> = new Promise((resolve) => {
		close_resolve = resolve;
	});

	const mock_watcher = {
		init: vi.fn(),
		close: vi.fn(async () => {
			close_call_count++;
			// Wait for our signal to complete
			await close_promise;
		}),
	};

	const mock_watch_dir = vi.fn(() => mock_watcher);
	const filer = new Filer({watch_dir: mock_watch_dir});

	// Initialize first
	await filer.init();
	assert.equal(filer.inited, true);

	// Call close multiple times concurrently while close is still pending
	const close1 = filer.close();
	const close2 = filer.close();
	const close3 = filer.close();

	// All should be the same promise instance since close hasn't completed yet
	assert.equal(close1, close2, 'close1 and close2 should be the same promise');
	assert.equal(close2, close3, 'close2 and close3 should be the same promise');

	// Now let the close complete
	close_resolve!();

	// Wait for all to complete
	await Promise.all([close1, close2, close3]);

	// close() should only be called once on the watcher
	assert.equal(close_call_count, 1, 'watcher.close() should only be called once');
	assert.equal(filer.inited, false);

	// After close completes, subsequent calls should return immediately
	const close4 = filer.close();
	const close5 = filer.close();
	await Promise.all([close4, close5]);

	// Still only one close call
	assert.equal(close_call_count, 1, 'watcher.close() should still only be called once');
});
