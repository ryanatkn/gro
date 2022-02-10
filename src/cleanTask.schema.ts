import {type ArgsSchema} from './task/task.js';

export const CleanTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/CleanTaskArgs.json',
	type: 'object',
	properties: {
		build: {type: 'boolean', default: true, description: ''},
		'no-build': {
			type: 'boolean',
			default: false,
			description: 'opt out of deleting the Gro build directory .gro/',
		},
		dist: {type: 'boolean', default: true, description: ''},
		'no-dist': {
			type: 'boolean',
			default: false,
			description: 'opt out of deleting the Gro dist directory dist/',
		},
		sveltekit: {
			type: 'boolean',
			default: false,
			description: 'delete the SvelteKit directory .svelte-kit/ and Vite cache',
		},
		nodemodules: {
			type: 'boolean',
			default: false,
			description: 'delete node_modules/',
		},
		git: {
			type: 'boolean',
			default: false,
			description:
				'run "git remote prune" to delete local branches referencing nonexistent remote branches',
		},
	},
	required: ['build', 'dist', 'sveltekit', 'nodemodules', 'git'],
	additionalProperties: false,
};
