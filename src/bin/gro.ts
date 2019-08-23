#!/usr/bin/env node

// install source maps
import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install({
	handleUncaughtExceptions: false,
});

// set up the env
import * as dotenv from 'dotenv';
dotenv.config();
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
const {env, argv} = process;

import * as sade from 'sade';
import {readJsonSync} from 'fs-extra';
import {join} from 'path';

import {handleError, handleUnhandledRejection} from '../utils/node';
import {InitialOptions as InitialDevActionOptions} from './actions/dev';
import {InitialOptions as InitialBuildActionOptions} from './actions/build';
import {InitialOptions as InitialServeActionOptions} from './actions/serve';
import {omitUndefined} from '../utils/obj';

// handle uncaught errors
process
	.on('uncaughtException', handleError)
	.on('unhandledRejection', handleUnhandledRejection);

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
	.action(async (opts: any) => {
		const action = await import('./actions/dev');
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
	.describe('Builds the code')
	.option('-d, --dir', 'Directory for the app source')
	.option('-o, --outputDir', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.action(async (opts: any) => {
		const action = await import('./actions/build');
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
		const action = await import('./actions/serve');
		const options: InitialServeActionOptions = {
			...omitUndefined({
				host: env.HOST,
				port: env.PORT,
			}),
			...opts,
		};
		await action.run(options);
	})

	// gro!
	.parse(argv);
