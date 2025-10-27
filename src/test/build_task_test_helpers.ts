import {vi} from 'vitest';

import type {Task_Context} from '../lib/task.ts';
import type {Args} from '../lib/build.task.ts';
import type {Gro_Config} from '../lib/gro_config.ts';
import {create_mock_task_context} from './test_helpers.ts';

/**
 * Creates a mock task context with build task Args defaults.
 */
export const create_mock_build_task_context = (
	args: Partial<Args> = {},
	config: Partial<Gro_Config> = {},
): Task_Context<Args> =>
	create_mock_task_context(
		args,
		config,
		{
			sync: true,
			'no-sync': false,
			install: true,
			'no-install': false,
			force_build: false,
		} as Args,
	);

/**
 * Mock plugins interface for testing plugin lifecycle.
 */
export interface Mock_Plugins {
	setup: ReturnType<typeof vi.fn>;
	adapt: ReturnType<typeof vi.fn>;
	teardown: ReturnType<typeof vi.fn>;
}

/**
 * Creates mock plugins with spies for testing lifecycle.
 */
export const create_mock_plugins = (): Mock_Plugins => ({
	setup: vi.fn(),
	adapt: vi.fn(),
	teardown: vi.fn(),
});
