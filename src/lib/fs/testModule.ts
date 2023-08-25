export const TEST_FILE_SUFFIX = '.test.ts';

export const isTestPath = (path: string): boolean => path.endsWith(TEST_FILE_SUFFIX);
