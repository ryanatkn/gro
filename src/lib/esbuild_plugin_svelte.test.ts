import {test} from 'uvu';
import * as assert from 'uvu/assert';
import * as esbuild from 'esbuild';
import {readFile, rm} from 'node:fs/promises';

import {esbuild_plugin_svelte} from './esbuild_plugin_svelte.js';
import {default_svelte_config} from './svelte_config.js';

// TODO improve these tests to have automatic caching

test('build for the client', async () => {
	const outfile = './src/fixtures/modules/some_test_server_bundle_DELETEME.js';
	const built = await esbuild.build({
		entryPoints: ['./src/fixtures/modules/some_test_server.ts'],
		plugins: [
			esbuild_plugin_svelte({
				dev: true,
				base_url: default_svelte_config.base_url,
				svelte_compile_options: {generate: 'client'},
			}),
		],
		outfile,
		format: 'esm',
		platform: 'node',
		packages: 'external',
		bundle: true,
		target: 'esnext',
	});
	assert.is(built.errors.length, 0);
	assert.is(built.warnings.length, 0);

	const built_output = await readFile(outfile, 'utf8');
	await rm(outfile); // TODO could be cleaner
	assert.is(
		built_output,
		`// src/fixtures/modules/some_test_svelte_ts.svelte.ts
import * as $ from "svelte/internal/client";
var Some_Test_Svelte_Ts = class {
  #a = $.state("ok");
  get a() {
    return $.get(this.#a);
  }
  set a(value) {
    $.set(this.#a, value, true);
  }
};

// src/fixtures/modules/some_test_svelte_js.svelte.js
import * as $2 from "svelte/internal/client";
var Some_Test_Svelte_Js = class {
  #a = $2.state("ok");
  get a() {
    return $2.get(this.#a);
  }
  set a(value) {
    $2.set(this.#a, value, true);
  }
};

// src/fixtures/modules/some_test_ts.ts
var some_test_ts = ".ts";

// src/fixtures/modules/some_test_js.js
var some_test_js = ".js";

// src/fixtures/modules/some_test_server.ts
var some_test_server = "some_test_server";
export {
  Some_Test_Svelte_Js,
  Some_Test_Svelte_Ts,
  some_test_js,
  some_test_server,
  some_test_ts
};
`,
	);
});

test('build for the server', async () => {
	const outfile = './src/fixtures/modules/some_test_client_bundle_DELETEME.js';
	const built = await esbuild.build({
		entryPoints: ['./src/fixtures/modules/some_test_server.ts'],
		plugins: [
			esbuild_plugin_svelte({
				dev: true,
				base_url: default_svelte_config.base_url,
			}),
		],
		outfile,
		format: 'esm',
		platform: 'node',
		packages: 'external',
		bundle: true,
		target: 'esnext',
	});
	assert.is(built.errors.length, 0);
	assert.is(built.warnings.length, 0);

	const built_output = await readFile(outfile, 'utf8');
	await rm(outfile); // TODO could be cleaner
	assert.is(
		built_output,
		`// src/fixtures/modules/some_test_svelte_ts.svelte.ts
import * as $ from "svelte/internal/server";
var Some_Test_Svelte_Ts = class {
  a = "ok";
};

// src/fixtures/modules/some_test_svelte_js.svelte.js
import * as $2 from "svelte/internal/server";
var Some_Test_Svelte_Js = class {
  a = "ok";
};

// src/fixtures/modules/some_test_ts.ts
var some_test_ts = ".ts";

// src/fixtures/modules/some_test_js.js
var some_test_js = ".js";

// src/fixtures/modules/some_test_server.ts
var some_test_server = "some_test_server";
export {
  Some_Test_Svelte_Js,
  Some_Test_Svelte_Ts,
  some_test_js,
  some_test_server,
  some_test_ts
};
`,
	);
});

test.run();
