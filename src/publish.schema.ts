import type {ArgsSchema} from './task/task.js';
import {GIT_DEPLOY_SOURCE_BRANCH} from './build/buildConfigDefaults.js';

export const PublishTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/PublishTaskArgs.json',
	type: 'object',
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: [],
			description: 'npm version increment, like major|minor|patch',
		},
		branch: {
			type: 'string',
			default: GIT_DEPLOY_SOURCE_BRANCH,
			description: 'branch to publish from',
		},
		dry: {
			type: 'boolean',
			default: false,
			description:
				'build and prepare to publish without actually publishing, for diagnostic and testing purposes',
		},
		restricted: {
			type: 'boolean',
			default: false,
			description:
				'if true, the package is published privately instead of the public default, using `npm publish --access restricted`',
		},
	},
	required: ['_'],
	additionalProperties: false,
};
