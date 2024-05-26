import {test} from 'uvu';
import * as assert from 'uvu/assert';
import * as esbuild from 'esbuild';
import {readFile, rm} from 'node:fs/promises';

import {esbuild_plugin_svelte} from './esbuild_plugin_svelte.js';

test('build for the client', async () => {
	const outfile = './src/fixtures/modules/some_test_server_bundle_DELETEME.js';
	const built = await esbuild.build({
		entryPoints: ['./src/fixtures/modules/some_test_server.ts'],
		plugins: [esbuild_plugin_svelte()],
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
	assert.is(
		built_output,
		`// src/fixtures/modules/some_test_svelte_ts.svelte.ts
import * as $ from "svelte/internal/client";
var Some_Test_Svelte_Ts = class {
  #a = $.source("ok");
  get a() {
    return $.get(this.#a);
  }
  set a(value) {
    $.set(this.#a, $.proxy(value));
  }
};

// src/fixtures/modules/some_test_server.ts
var some_test_server = "some_test_server";
var Rexported_Some_Test_Svelte_Ts = Some_Test_Svelte_Ts;
export {
  Rexported_Some_Test_Svelte_Ts,
  some_test_server
};
`,
	);

	await rm(outfile); // TODO could be cleaner
});

test('build for the server', async () => {
	const outfile = './src/fixtures/modules/some_test_client_bundle_DELETEME.js';
	const built = await esbuild.build({
		entryPoints: ['./src/fixtures/modules/some_test_server.ts'],
		plugins: [esbuild_plugin_svelte({svelte_compile_module_options: {generate: 'server'}})],
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
	assert.is(
		built_output,
		`// src/fixtures/modules/some_test_svelte_ts.svelte.ts
import * as $ from "svelte/internal/server";
var Some_Test_Svelte_Ts = class {
  a = "ok";
};

// src/fixtures/modules/some_test_server.ts
var some_test_server = "some_test_server";
var Rexported_Some_Test_Svelte_Ts = Some_Test_Svelte_Ts;
export {
  Rexported_Some_Test_Svelte_Ts,
  some_test_server
};
`,
	);

	await rm(outfile); // TODO could be cleaner
});

test.run();
