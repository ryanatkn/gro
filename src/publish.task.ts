import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';

import {rainbow} from './utils/colors.js';
import type {Task} from './task/task.js';
import {loadConfig} from './config/config.js';
import {cleanFs} from './fs/clean.js';
import {isThisProjectGro} from './paths.js';
import {toRawRestArgs} from './utils/args.js';
import {GIT_DEPLOY_SOURCE_BRANCH} from './build/buildConfigDefaults.js';

// publish.task.ts
// - usage: `gro publish patch`
// - forwards args to `npm version`: https://docs.npmjs.com/cli/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

const Args = z
	.object({
		branch: z.string({description: 'branch to publish from'}).default(GIT_DEPLOY_SOURCE_BRANCH),
		dry: z
			.boolean({
				description:
					'build and prepare to publish without actually publishing, for diagnostic and testing purposes',
			})
			.default(false),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'bump version, publish to npm, and git push',
	production: true,
	Args,
	run: async ({fs, args, log, dev}): Promise<void> => {
		const {branch, dry} = args;
		if (dry) {
			log.info(rainbow('dry run!'));
		}

		// Make sure we're on the right branch:
		await spawn('git', ['fetch', 'origin', branch]);
		await spawn('git', ['checkout', branch]);
		await spawn('git', ['pull', 'origin', branch]);

		// Rebuild everything -- TODO maybe optimize and only clean `buildProd`
		await cleanFs(fs, {build: true, dist: true}, log);
		if (isThisProjectGro) {
			const bootstrapResult = await spawn('npm', ['run', 'bootstrap']); // TODO serialize any/all args?
			if (!bootstrapResult.ok) throw Error('Failed to bootstrap Gro');
		}

		// Check in dev mode before proceeding.
		const checkResult = await spawn('npx', ['gro', 'check', ...toRawRestArgs()], {
			env: {...process.env, NODE_ENV: 'development'},
		});
		if (!checkResult.ok) throw Error('gro check failed');

		// Bump the version so the package.json is updated before building:
		if (dry) {
			log.info('dry run, skipping changeset version');
		} else {
			const npmVersionResult = await spawn('changeset', ['version']);
			if (!npmVersionResult.ok) {
				throw Error('npm version failed: no commits were made: see the error above');
			}
		}

		// Build to create the final artifacts:
		const buildResult = await spawn('npx', ['gro', 'build', ...toRawRestArgs()]);
		if (!buildResult.ok) throw Error('gro build failed');

		const config = await loadConfig(fs, dev);
		if (config.publish === null) {
			throw Error('config.publish is null, so this package cannot be published');
		}

		if (dry) {
			log.info({publish: config.publish, branch});
			log.info(rainbow('dry run complete!'));
			return;
		}

		await spawn('git', ['push']);
		await spawn('git', ['push', '--tags']);
		const npmPublishResult = await spawn('changeset', ['publish'], {cwd: config.publish});
		if (!npmPublishResult.ok) {
			throw Error('npm publish failed: revert the version commits or run "npm publish" manually');
		}
	},
};
