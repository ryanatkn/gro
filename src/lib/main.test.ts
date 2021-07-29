// TODO how to properly set up sourcemaps? this file doesn't run when executing specific tests

import sourcemap_support from 'source-map-support';

sourcemap_support.install({
	handleUncaughtExceptions: false,
});
