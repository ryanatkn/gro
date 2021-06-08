export const TEST_FILE_SUFFIX = '.test.ts';

export const is_test_path = (path: string): boolean => path.endsWith(TEST_FILE_SUFFIX);
