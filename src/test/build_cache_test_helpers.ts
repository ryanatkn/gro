import type {Build_Cache_Metadata} from '../lib/build_cache.ts';

export {create_mock_logger, create_mock_config} from './test_helpers.ts';

/**
 * Creates mock build cache metadata for testing.
 */
export const create_mock_build_cache_metadata = (
	overrides: Partial<Build_Cache_Metadata> = {},
): Build_Cache_Metadata => ({
	version: '1',
	git_commit: 'abc123',
	build_cache_config_hash: 'jkl012',
	timestamp: '2025-10-21T10:00:00.000Z',
	outputs: [],
	...overrides,
});
