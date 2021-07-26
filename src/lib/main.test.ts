import sourcemap_support from 'source-map-support';

sourcemap_support.install({
	handleUncaughtExceptions: false,
});

// Gro creates this file to help you with sourcemaps and other global test setup and teardown.
// To customize the file's location,
// use the Gro config option `main_test: 'lib/main.test.ts'`,
// or turn it off with `null`.
