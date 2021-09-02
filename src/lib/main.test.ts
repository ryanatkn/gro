// TODO how to properly set up sourcemaps? this file doesn't run when executing specific tests

import sourcemapSupport from 'source-map-support';

sourcemapSupport.install({
	handleUncaughtExceptions: false,
});
