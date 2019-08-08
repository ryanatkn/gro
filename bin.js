#!/usr/bin/env node
const sade = require('sade');

const pkg = require('./package.json');

/*

All actions are lazily required,
avoiding the typical loading/parsing/initializing of tons of unused JS.

*/

sade('gro')
	.version(pkg.version)

	.command('dev')
	.describe('Start development server')
	.option('-H, --host', 'Hostname for the server')
	.option('-p, --port', 'Port number for the server')
	.option('-d, --dir', 'Directory for the app')
	.action((src, opts) => {
		require('./dist/actions/dev').run(src, opts);
	})

	// gro!
	.parse(process.argv);
