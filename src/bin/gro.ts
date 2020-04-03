#!/bin/sh
':'; //# this is temporary code to use ESM in the CLI; exec /usr/bin/env node --experimental-modules "$0" "$@"

// handle uncaught errors
import {attachProcessErrorHandlers} from '../utils/process.js';
attachProcessErrorHandlers();

// install source maps
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install({
	handleUncaughtExceptions: false,
});

// set up the env
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
const {env, argv} = process;

import sade from 'sade';
import fs from 'fs-extra';
import * as fp from 'path';
import {fileURLToPath} from 'url';

import {InitialOptions as InitialRunTaskOptions} from '../commands/run.js';
import {InitialOptions as InitialDevTaskOptions} from '../commands/dev.js';
import {InitialOptions as InitialBuildTaskOptions} from '../commands/build.js';
import {InitialOptions as InitialServeTaskOptions} from '../commands/serve.js';
import {InitialOptions as InitialTestTaskOptions} from '../commands/test.js';
import {InitialOptions as InitialCleanTaskOptions} from '../commands/clean.js';
import {InitialOptions as InitialGenTaskOptions} from '../commands/gen.js';
import {InitialOptions as InitialAssetsTaskOptions} from '../commands/assets.js';
import {omitUndefined} from '../utils/object.js';

// This is weird, but it's needed because the TypeScript `rootDir` is `./src`,
// and `package.json` is above it at the repo root,
// so it can't be imported or required normally.
const __filename = fileURLToPath(import.meta.url);
const __dirname = fp.dirname(__filename);
const pkg = fs.readJsonSync(fp.join(__dirname, '../../package.json'));

/*

All commands are lazily required,
avoiding the typical loading/parsing/initializing of tons of unused JS.

*/

sade('gro')
	.version(pkg.version)

	// TODO probably want this
	//.option('-c, --config', 'Path to gro config', 'gro.config.js');

	.command('run')
	.describe('Run tasks')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const command = await import('../commands/run.js');
		const options: InitialRunTaskOptions = {
			...opts,
		};
		await command.run(options);
	})

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
		const command = await import('../commands/dev.js');
		const options: InitialDevTaskOptions = {
			...omitUndefined({
				host: env.HOST,
				port: env.PORT,
			}),
			...opts,
		};
		await command.run(options);
	})

	.command('build')
	.describe('Build the code')
	.option('-o, --outputDir', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const command = await import('../commands/build.js');
		const options: InitialBuildTaskOptions = {
			...opts,
		};
		await command.run(options);
	})

	.command('gen')
	.describe('Run code generation scripts')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const command = await import('../commands/gen.js');
		const options: InitialGenTaskOptions = {
			...opts,
		};
		await command.run(options);
	})

	.command('assets')
	.describe('Copy assets to dist')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const command = await import('../commands/assets.js');
		const options: InitialAssetsTaskOptions = {
			...opts,
		};
		await command.run(options);
	})

	.command('serve')
	.describe('Start development server')
	.option('-d, --dir', 'Directory for the app source') // TODO probably change this to be the `_` params
	.option('-H, --host', 'Hostname for the server')
	.option('-p, --port', 'Port number for the server')
	.action(async (opts: any) => {
		const command = await import('../commands/serve.js');
		const options: InitialServeTaskOptions = {
			...omitUndefined({
				host: env.HOST,
				port: env.PORT,
			}),
			...opts,
		};
		await command.run(options);
	})

	.command('test')
	.describe('Run tests')
	.option('-d, --dir', 'Directory for the app source')
	.option('-w, --watch', 'Watch for changes and re-run tests')
	.action(async (opts: any) => {
		const command = await import('../commands/test.js');
		const options: InitialTestTaskOptions = {
			...opts,
		};
		await command.run(options);
	})

	.command('clean')
	.describe('Remove build and temp files')
	.action(async (opts: any) => {
		const command = await import('../commands/clean.js');
		const options: InitialCleanTaskOptions = {
			...opts,
		};
		await command.run(options);
	})

	// gro!
	.parse(argv);
