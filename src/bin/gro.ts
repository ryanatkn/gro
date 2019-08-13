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
import {readFileSync} from 'fs';
import {join} from 'path';

import {DevActionOpts} from './actions/dev';

// This is gross, but it's needed because the TypeScript `rootDir` is `./src`,
// and `package.json` is above it at the repo root,
// so it can't be imported or required normally.
const pkg = JSON.parse(
	readFileSync(join(__dirname, '../../package.json'), 'utf8'),
);

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
	.option('-o, --out', 'Directory for the build output')
	.option('-w, --watch', 'Watch for changes and rebuild')
	.action(async (opts: any) => {
		const dev = await import('./actions/dev');
		const options: DevActionOpts = {
			host: env.HOST,
			port: env.PORT,
			...opts,
		};
		await dev.run(options);
	})

	// gro!
	.parse(argv);
