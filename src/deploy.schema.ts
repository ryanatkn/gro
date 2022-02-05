import type {ArgsSchema} from './task/task.js';
import {GIT_DEPLOY_SOURCE_BRANCH, GIT_DEPLOY_TARGET_BRANCH} from './build/buildConfigDefaults.js';

export const DeployTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/DeployTaskArgs.json',
	type: 'object',
	properties: {
		dirname: {
			type: 'string',
			default: undefined,
			description: "output directory in dist/ - defaults to detecting 'svelte-kit' | 'browser'",
		},
		source: {
			type: 'string',
			default: GIT_DEPLOY_SOURCE_BRANCH,
			description: 'source branch to build and deploy from',
		},
		target: {
			type: 'string',
			default: GIT_DEPLOY_TARGET_BRANCH,
			description: 'target branch to deploy to',
		},
		dry: {
			type: 'boolean',
			default: false,
			description:
				'build and prepare to deploy without actually deploying, for diagnostic and testing purposes',
		},
		clean: {
			type: 'boolean',
			default: false,
			description: 'instead of building and deploying, just clean the git worktree and Gro cache',
		},
		force: {
			type: 'boolean',
			default: false,
			description: 'caution!! enable deploying and force pushing to branches like main and master',
		},
	},
	additionalProperties: false,
};
