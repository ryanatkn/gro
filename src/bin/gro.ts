#!/usr/bin/env node

// handle uncaught errors
import {attachProcessErrorHandlers} from '../utils/processUtils';
attachProcessErrorHandlers();

// install source maps
import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install({
	handleUncaughtExceptions: false,
});

// set up the env
import {setupEnv} from '../env/env';
setupEnv();
const {env, argv} = process;

import * as sade from 'sade';
import {readJsonSync} from 'fs-extra';
import {join} from 'path';

import {InitialOptions as InitialDevActionOptions} from '../tasks/dev';
import {InitialOptions as InitialBuildActionOptions} from '../tasks/build';
import {InitialOptions as InitialServeActionOptions} from '../tasks/serve';
import {omitUndefined} from '../utils/objectUtils';

// This is weird, but it's needed because the TypeScript `rootDir` is `./src`,
// and `package.json` is above it at the repo root,
// so it can't be imported or required normally.
const pkg = readJsonSync(join(__dirname, '../../package.json'));

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
	.option('-d, --dir', 'Directory for the app source')
	.option('-o, --outputDir', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const action = await import('../tasks/dev');
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
	.option('-d, --dir', 'Directory for the app source')
	.option('-o, --outputDir', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.option('-P, --production', 'Set NODE_ENV to production')
	.action(async (opts: any) => {
		if (opts.production) env.NODE_ENV = 'production';
		const action = await import('../tasks/build');
		const options: InitialBuildActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	.command('serve')
	.describe('Start development server')
	.option('-d, --dir', 'Directory for the app source')
	.option('-H, --host', 'Hostname for the server')
	.option('-p, --port', 'Port number for the server')
	.action(async (opts: any) => {
		const action = await import('../tasks/serve');
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
		const action = await import('../tasks/test');
		const options: InitialBuildActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	.command('clean')
	.describe('Remove build and temp files')
	.action(async (opts: any) => {
		const action = await import('../tasks/clean');
		const options: InitialBuildActionOptions = {
			...opts,
		};
		await action.run(options);
	})

	// gro!
	.parse(argv);
