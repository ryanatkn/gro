#!/bin/sh
':'; //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

// handle uncaught errors
import {attachProcessErrorHandlers} from '../utils/process.js';
attachProcessErrorHandlers();

// install source maps
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install({
	handleUncaughtExceptions: false,
});

// set up the env
import {setupEnv} from '../env/env.js';
setupEnv();
const {env, argv} = process;

import sade from 'sade';
import fs from 'fs-extra';
import * as fp from 'path';
import {fileURLToPath} from 'url';

import {InitialOptions as InitialDevActionOptions} from '../tasks/dev.js';
import {InitialOptions as InitialBuildActionOptions} from '../tasks/build.js';
import {InitialOptions as InitialServeActionOptions} from '../tasks/serve.js';
import {InitialOptions as InitialTestActionOptions} from '../tasks/test.js';
import {InitialOptions as InitialCleanActionOptions} from '../tasks/clean.js';
import {InitialOptions as InitialGenActionOptions} from '../tasks/gen.js';
import {omitUndefined} from '../utils/object.js';

// This is weird, but it's needed because the TypeScript `rootDir` is `./src`,
// and `package.json` is above it at the repo root,
// so it can't be imported or required normally.
const __filename = fileURLToPath(import.meta.url);
const __dirname = fp.dirname(__filename);
const pkg = fs.readJsonSync(fp.join(__dirname, '../../package.json'));

/*

All actions are lazily required,
avoiding the typical loading/parsing/initializing of tons of unused JS.

*/

sade('gro')
	.version(pkg.version)

	// TODO probably want this
	//.option('-c, --config', 'Path to gro config', 'gro.config.js');

	.command('dev')
	.describe('Start development server')
	.option('-H, --host', 'Hostname for the server')
	.option('-p, --port', 'Port number for the server')
	.option('-d, --dir', 'Directory to serve')
	.option('-o, --outputDir', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const action = await import('../tasks/dev.js');
		const options: InitialDevActionOptions = {
			...omitUndefined({
				host: env.HOST,
				port: env.PORT,
			}),
			...opts,
		};
		await action.run(options);
	})

	.command('build')
	.describe('Build the code')
	.option('-o, --outputDir', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const action = await import('../tasks/build.js');
		const options: InitialBuildActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	.command('gen')
	.describe('Run code generation scripts')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const action = await import('../tasks/gen.js');
		const options: InitialGenActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	.command('serve')
	.describe('Start development server')
	.option('-d, --dir', 'Directory for the app source') // TODO probably change this to be the `_` params
	.option('-H, --host', 'Hostname for the server')
	.option('-p, --port', 'Port number for the server')
	.action(async (opts: any) => {
		const action = await import('../tasks/serve.js');
		const options: InitialServeActionOptions = {
			...omitUndefined({
				host: env.HOST,
				port: env.PORT,
			}),
			...opts,
		};
		await action.run(options);
	})

	.command('test')
	.describe('Run tests')
	.option('-d, --dir', 'Directory for the app source')
	.option('-w, --watch', 'Watch for changes and re-run tests')
	.action(async (opts: any) => {
		const action = await import('../tasks/test.js');
		const options: InitialTestActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	.command('clean')
	.describe('Remove build and temp files')
	.action(async (opts: any) => {
		const action = await import('../tasks/clean.js');
		const options: InitialCleanActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	// gro!
	.parse(argv);
