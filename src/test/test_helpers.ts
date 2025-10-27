import {vi} from 'vitest';
import type {Logger} from '@ryanatkn/belt/log.js';

import type {Gro_Config} from '../lib/gro_config.ts';

/**
 * Creates a mock logger for testing.
 */
export const create_mock_logger = (): Logger =>
	({
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		plain: vi.fn(),
		newline: vi.fn(),
	}) as unknown as Logger;

/**
 * Creates a mock Gro config for testing.
 */
export const create_mock_config = (overrides: Partial<Gro_Config> = {}): Gro_Config =>
	({
		plugins: () => [],
		map_package_json: null,
		task_root_dirs: [],
		search_filters: [],
		js_cli: 'node',
		pm_cli: 'npm',
		build_cache_config: undefined,
		...overrides,
	}) as Gro_Config;
