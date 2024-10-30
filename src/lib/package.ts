// generated by src/lib/package.gen.ts

import type {Package_Json} from './package_json.js';
import type {Src_Json} from './src_json.js';

export const package_json = {
	name: '@ryanatkn/gro',
	version: '0.143.3',
	description: 'task runner and toolkit extending SvelteKit',
	motto: 'generate, run, optimize',
	glyph: '🌰',
	logo: 'logo.svg',
	logo_alt: 'a pixelated green oak acorn with a glint of sun',
	public: true,
	license: 'MIT',
	homepage: 'https://gro.ryanatkn.com/',
	author: {name: 'Ryan Atkinson', email: 'mail@ryanatkn.com', url: 'https://www.ryanatkn.com/'},
	repository: {type: 'git', url: 'git+https://github.com/ryanatkn/gro.git'},
	bugs: 'https://github.com/ryanatkn/gro/issues',
	funding: 'https://www.ryanatkn.com/funding',
	scripts: {
		bootstrap:
			'rm -rf .gro dist && svelte-kit sync && svelte-package && chmod +x ./dist/gro.js && npm link -f',
		start: 'gro dev',
		dev: 'gro dev',
		build: 'gro build',
		check: 'gro check',
		test: 'gro test',
		preview: 'vite preview',
		deploy: 'gro deploy',
	},
	type: 'module',
	engines: {node: '>=20.17'},
	bin: {gro: 'dist/gro.js'},
	keywords: [
		'web',
		'tools',
		'task runner',
		'tasks',
		'codegen',
		'svelte',
		'sveltekit',
		'vite',
		'typescript',
	],
	dependencies: {
		'@ryanatkn/belt': '^0.26.0',
		chokidar: '^4.0.1',
		dotenv: '^16.4.5',
		'es-module-lexer': '^1.5.4',
		'esm-env': '^1.1.4',
		mri: '^1.2.0',
		prettier: '^3.3.3',
		'prettier-plugin-svelte': '^3.2.7',
		'ts-morph': '^24.0.0',
		tslib: '^2.8.0',
		zod: '^3.23.8',
	},
	peerDependencies: {esbuild: '^0.21.0', svelte: '^5'},
	devDependencies: {
		'@changesets/changelog-git': '^0.2.0',
		'@changesets/types': '^6.0.0',
		'@ryanatkn/eslint-config': '^0.5.5',
		'@ryanatkn/fuz': '^0.130.3',
		'@ryanatkn/moss': '^0.18.2',
		'@sveltejs/adapter-static': '^3.0.6',
		'@sveltejs/kit': '^2.7.3',
		'@sveltejs/package': '^2.3.7',
		'@sveltejs/vite-plugin-svelte': '^4.0.0',
		'@types/fs-extra': '^11.0.4',
		'@types/node': '^22.8.4',
		esbuild: '^0.21.5',
		eslint: '^9.13.0',
		'eslint-plugin-svelte': '^2.46.0',
		svelte: '^5.1.5',
		'svelte-check': '^4.0.5',
		typescript: '^5.6.3',
		'typescript-eslint': '^8.12.1',
		uvu: '^0.5.6',
	},
	prettier: {
		plugins: ['prettier-plugin-svelte'],
		useTabs: true,
		printWidth: 100,
		singleQuote: true,
		bracketSpacing: false,
		overrides: [{files: 'package.json', options: {useTabs: false}}],
	},
	sideEffects: ['**/*.css'],
	files: ['dist', 'src/lib/**/*.ts', '!src/lib/**/*.test.*', '!dist/**/*.test.*'],
	exports: {
		'.': {types: './dist/index.d.ts', default: './dist/index.js'},
		'./package.json': './package.json',
		'./args.js': {types: './dist/args.d.ts', default: './dist/args.js'},
		'./build.task.js': {types: './dist/build.task.d.ts', default: './dist/build.task.js'},
		'./changelog.js': {types: './dist/changelog.d.ts', default: './dist/changelog.js'},
		'./changeset_helpers.js': {
			types: './dist/changeset_helpers.d.ts',
			default: './dist/changeset_helpers.js',
		},
		'./changeset.task.js': {
			types: './dist/changeset.task.d.ts',
			default: './dist/changeset.task.js',
		},
		'./check.task.js': {types: './dist/check.task.d.ts', default: './dist/check.task.js'},
		'./clean_fs.js': {types: './dist/clean_fs.d.ts', default: './dist/clean_fs.js'},
		'./clean.task.js': {types: './dist/clean.task.d.ts', default: './dist/clean.task.js'},
		'./cli.js': {types: './dist/cli.d.ts', default: './dist/cli.js'},
		'./commit.task.js': {types: './dist/commit.task.d.ts', default: './dist/commit.task.js'},
		'./constants.js': {types: './dist/constants.d.ts', default: './dist/constants.js'},
		'./deploy.task.js': {types: './dist/deploy.task.d.ts', default: './dist/deploy.task.js'},
		'./dev.task.js': {types: './dist/dev.task.d.ts', default: './dist/dev.task.js'},
		'./env.js': {types: './dist/env.d.ts', default: './dist/env.js'},
		'./esbuild_helpers.js': {
			types: './dist/esbuild_helpers.d.ts',
			default: './dist/esbuild_helpers.js',
		},
		'./esbuild_plugin_external_worker.js': {
			types: './dist/esbuild_plugin_external_worker.d.ts',
			default: './dist/esbuild_plugin_external_worker.js',
		},
		'./esbuild_plugin_svelte.js': {
			types: './dist/esbuild_plugin_svelte.d.ts',
			default: './dist/esbuild_plugin_svelte.js',
		},
		'./esbuild_plugin_sveltekit_local_imports.js': {
			types: './dist/esbuild_plugin_sveltekit_local_imports.d.ts',
			default: './dist/esbuild_plugin_sveltekit_local_imports.js',
		},
		'./esbuild_plugin_sveltekit_shim_alias.js': {
			types: './dist/esbuild_plugin_sveltekit_shim_alias.d.ts',
			default: './dist/esbuild_plugin_sveltekit_shim_alias.js',
		},
		'./esbuild_plugin_sveltekit_shim_app.js': {
			types: './dist/esbuild_plugin_sveltekit_shim_app.d.ts',
			default: './dist/esbuild_plugin_sveltekit_shim_app.js',
		},
		'./esbuild_plugin_sveltekit_shim_env.js': {
			types: './dist/esbuild_plugin_sveltekit_shim_env.d.ts',
			default: './dist/esbuild_plugin_sveltekit_shim_env.js',
		},
		'./filer.js': {types: './dist/filer.d.ts', default: './dist/filer.js'},
		'./format_directory.js': {
			types: './dist/format_directory.d.ts',
			default: './dist/format_directory.js',
		},
		'./format_file.js': {types: './dist/format_file.d.ts', default: './dist/format_file.js'},
		'./format.task.js': {types: './dist/format.task.d.ts', default: './dist/format.task.js'},
		'./fs.js': {types: './dist/fs.d.ts', default: './dist/fs.js'},
		'./gen.task.js': {types: './dist/gen.task.d.ts', default: './dist/gen.task.js'},
		'./gen.js': {types: './dist/gen.d.ts', default: './dist/gen.js'},
		'./git.js': {types: './dist/git.d.ts', default: './dist/git.js'},
		'./github.js': {types: './dist/github.d.ts', default: './dist/github.js'},
		'./gro_config.js': {types: './dist/gro_config.d.ts', default: './dist/gro_config.js'},
		'./gro_helpers.js': {types: './dist/gro_helpers.d.ts', default: './dist/gro_helpers.js'},
		'./gro_plugin_gen.js': {
			types: './dist/gro_plugin_gen.d.ts',
			default: './dist/gro_plugin_gen.js',
		},
		'./gro_plugin_moss.js': {
			types: './dist/gro_plugin_moss.d.ts',
			default: './dist/gro_plugin_moss.js',
		},
		'./gro_plugin_server.js': {
			types: './dist/gro_plugin_server.d.ts',
			default: './dist/gro_plugin_server.js',
		},
		'./gro_plugin_sveltekit_app.js': {
			types: './dist/gro_plugin_sveltekit_app.d.ts',
			default: './dist/gro_plugin_sveltekit_app.js',
		},
		'./gro_plugin_sveltekit_library.js': {
			types: './dist/gro_plugin_sveltekit_library.d.ts',
			default: './dist/gro_plugin_sveltekit_library.js',
		},
		'./gro.config.default.js': {
			types: './dist/gro.config.default.d.ts',
			default: './dist/gro.config.default.js',
		},
		'./gro.js': {types: './dist/gro.d.ts', default: './dist/gro.js'},
		'./hash.js': {types: './dist/hash.d.ts', default: './dist/hash.js'},
		'./input_path.js': {types: './dist/input_path.d.ts', default: './dist/input_path.js'},
		'./invoke_task.js': {types: './dist/invoke_task.d.ts', default: './dist/invoke_task.js'},
		'./invoke.js': {types: './dist/invoke.d.ts', default: './dist/invoke.js'},
		'./lint.task.js': {types: './dist/lint.task.d.ts', default: './dist/lint.task.js'},
		'./loader.js': {types: './dist/loader.d.ts', default: './dist/loader.js'},
		'./module.js': {types: './dist/module.d.ts', default: './dist/module.js'},
		'./modules.js': {types: './dist/modules.d.ts', default: './dist/modules.js'},
		'./moss_helpers.js': {types: './dist/moss_helpers.d.ts', default: './dist/moss_helpers.js'},
		'./package_json.js': {types: './dist/package_json.d.ts', default: './dist/package_json.js'},
		'./package_meta.js': {types: './dist/package_meta.d.ts', default: './dist/package_meta.js'},
		'./package.gen.js': {types: './dist/package.gen.d.ts', default: './dist/package.gen.js'},
		'./package.js': {types: './dist/package.d.ts', default: './dist/package.js'},
		'./parse_imports.js': {types: './dist/parse_imports.d.ts', default: './dist/parse_imports.js'},
		'./path.js': {types: './dist/path.d.ts', default: './dist/path.js'},
		'./paths.js': {types: './dist/paths.d.ts', default: './dist/paths.js'},
		'./plugin.js': {types: './dist/plugin.d.ts', default: './dist/plugin.js'},
		'./publish.task.js': {types: './dist/publish.task.d.ts', default: './dist/publish.task.js'},
		'./register.js': {types: './dist/register.d.ts', default: './dist/register.js'},
		'./reinstall.task.js': {
			types: './dist/reinstall.task.d.ts',
			default: './dist/reinstall.task.js',
		},
		'./release.task.js': {types: './dist/release.task.d.ts', default: './dist/release.task.js'},
		'./resolve_node_specifier.js': {
			types: './dist/resolve_node_specifier.d.ts',
			default: './dist/resolve_node_specifier.js',
		},
		'./resolve_specifier.js': {
			types: './dist/resolve_specifier.d.ts',
			default: './dist/resolve_specifier.js',
		},
		'./resolve.task.js': {types: './dist/resolve.task.d.ts', default: './dist/resolve.task.js'},
		'./run_gen.js': {types: './dist/run_gen.d.ts', default: './dist/run_gen.js'},
		'./run_task.js': {types: './dist/run_task.d.ts', default: './dist/run_task.js'},
		'./run.task.js': {types: './dist/run.task.d.ts', default: './dist/run.task.js'},
		'./search_fs.js': {types: './dist/search_fs.d.ts', default: './dist/search_fs.js'},
		'./src_json.js': {types: './dist/src_json.d.ts', default: './dist/src_json.js'},
		'./svelte_helpers.js': {
			types: './dist/svelte_helpers.d.ts',
			default: './dist/svelte_helpers.js',
		},
		'./sveltekit_config.js': {
			types: './dist/sveltekit_config.d.ts',
			default: './dist/sveltekit_config.js',
		},
		'./sveltekit_helpers.js': {
			types: './dist/sveltekit_helpers.d.ts',
			default: './dist/sveltekit_helpers.js',
		},
		'./sveltekit_shim_app_environment.js': {
			types: './dist/sveltekit_shim_app_environment.d.ts',
			default: './dist/sveltekit_shim_app_environment.js',
		},
		'./sveltekit_shim_app_forms.js': {
			types: './dist/sveltekit_shim_app_forms.d.ts',
			default: './dist/sveltekit_shim_app_forms.js',
		},
		'./sveltekit_shim_app_navigation.js': {
			types: './dist/sveltekit_shim_app_navigation.d.ts',
			default: './dist/sveltekit_shim_app_navigation.js',
		},
		'./sveltekit_shim_app_paths.js': {
			types: './dist/sveltekit_shim_app_paths.d.ts',
			default: './dist/sveltekit_shim_app_paths.js',
		},
		'./sveltekit_shim_app_stores.js': {
			types: './dist/sveltekit_shim_app_stores.d.ts',
			default: './dist/sveltekit_shim_app_stores.js',
		},
		'./sveltekit_shim_app.js': {
			types: './dist/sveltekit_shim_app.d.ts',
			default: './dist/sveltekit_shim_app.js',
		},
		'./sveltekit_shim_env.js': {
			types: './dist/sveltekit_shim_env.d.ts',
			default: './dist/sveltekit_shim_env.js',
		},
		'./sync.task.js': {types: './dist/sync.task.d.ts', default: './dist/sync.task.js'},
		'./task_logging.js': {types: './dist/task_logging.d.ts', default: './dist/task_logging.js'},
		'./task.js': {types: './dist/task.d.ts', default: './dist/task.js'},
		'./test.task.js': {types: './dist/test.task.d.ts', default: './dist/test.task.js'},
		'./typecheck.task.js': {
			types: './dist/typecheck.task.d.ts',
			default: './dist/typecheck.task.js',
		},
		'./upgrade.task.js': {types: './dist/upgrade.task.d.ts', default: './dist/upgrade.task.js'},
		'./watch_dir.js': {types: './dist/watch_dir.d.ts', default: './dist/watch_dir.js'},
	},
} satisfies Package_Json;

export const src_json = {
	name: '@ryanatkn/gro',
	version: '0.143.3',
	modules: {
		'.': {
			path: 'index.ts',
			declarations: [
				{name: 'Gro_Config', kind: 'type'},
				{name: 'Create_Gro_Config', kind: 'type'},
				{name: 'Raw_Gro_Config', kind: 'type'},
				{name: 'Plugin', kind: 'type'},
				{name: 'replace_plugin', kind: 'function'},
				{name: 'Gen', kind: 'type'},
				{name: 'Gen_Context', kind: 'type'},
				{name: 'Task', kind: 'type'},
				{name: 'Task_Context', kind: 'type'},
				{name: 'Task_Error', kind: 'class'},
			],
		},
		'./package.json': {path: 'package.json', declarations: []},
		'./args.js': {
			path: 'args.ts',
			declarations: [
				{name: 'Args', kind: 'type'},
				{name: 'Arg_Value', kind: 'type'},
				{name: 'Arg_Schema', kind: 'type'},
				{name: 'parse_args', kind: 'function'},
				{name: 'serialize_args', kind: 'function'},
				{name: 'to_task_args', kind: 'function'},
				{name: 'to_raw_rest_args', kind: 'function'},
				{name: 'to_forwarded_args', kind: 'function'},
				{name: 'to_forwarded_args_by_command', kind: 'function'},
				{name: 'print_command_args', kind: 'function'},
			],
		},
		'./build.task.js': {
			path: 'build.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./changelog.js': {
			path: 'changelog.ts',
			declarations: [{name: 'update_changelog', kind: 'function'}],
		},
		'./changeset_helpers.js': {
			path: 'changeset_helpers.ts',
			declarations: [
				{name: 'CHANGESET_RESTRICTED_ACCESS', kind: 'variable'},
				{name: 'CHANGESET_PUBLIC_ACCESS', kind: 'variable'},
				{name: 'Changeset_Access', kind: 'variable'},
				{name: 'CHANGESET_CLI', kind: 'variable'},
				{name: 'CHANGESET_DIR', kind: 'variable'},
				{name: 'Changeset_Bump', kind: 'variable'},
			],
		},
		'./changeset.task.js': {
			path: 'changeset.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./check.task.js': {
			path: 'check.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./clean_fs.js': {path: 'clean_fs.ts', declarations: [{name: 'clean_fs', kind: 'function'}]},
		'./clean.task.js': {
			path: 'clean.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./cli.js': {
			path: 'cli.ts',
			declarations: [
				{name: 'Cli', kind: 'type'},
				{name: 'find_cli', kind: 'function'},
				{name: 'spawn_cli', kind: 'function'},
				{name: 'spawn_cli_process', kind: 'function'},
				{name: 'resolve_cli', kind: 'function'},
				{name: 'to_cli_name', kind: 'function'},
			],
		},
		'./commit.task.js': {
			path: 'commit.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./constants.js': {
			path: 'constants.ts',
			declarations: [
				{name: 'SOURCE_DIRNAME', kind: 'variable'},
				{name: 'GRO_DIRNAME', kind: 'variable'},
				{name: 'GRO_DIST_PREFIX', kind: 'variable'},
				{name: 'SERVER_DIST_PATH', kind: 'variable'},
				{name: 'GRO_DEV_DIRNAME', kind: 'variable'},
				{name: 'SOURCE_DIR', kind: 'variable'},
				{name: 'GRO_DIR', kind: 'variable'},
				{name: 'GRO_DEV_DIR', kind: 'variable'},
				{name: 'GRO_CONFIG_PATH', kind: 'variable'},
				{name: 'README_FILENAME', kind: 'variable'},
				{name: 'SVELTEKIT_CONFIG_FILENAME', kind: 'variable'},
				{name: 'VITE_CONFIG_FILENAME', kind: 'variable'},
				{name: 'NODE_MODULES_DIRNAME', kind: 'variable'},
				{name: 'LOCKFILE_FILENAME', kind: 'variable'},
				{name: 'SVELTEKIT_DEV_DIRNAME', kind: 'variable'},
				{name: 'SVELTEKIT_BUILD_DIRNAME', kind: 'variable'},
				{name: 'SVELTEKIT_DIST_DIRNAME', kind: 'variable'},
				{name: 'SVELTEKIT_VITE_CACHE_PATH', kind: 'variable'},
				{name: 'GITHUB_DIRNAME', kind: 'variable'},
				{name: 'GIT_DIRNAME', kind: 'variable'},
				{name: 'TSCONFIG_FILENAME', kind: 'variable'},
				{name: 'TS_MATCHER', kind: 'variable'},
				{name: 'JS_MATCHER', kind: 'variable'},
				{name: 'JSON_MATCHER', kind: 'variable'},
				{name: 'EVERYTHING_MATCHER', kind: 'variable'},
				{name: 'JS_CLI_DEFAULT', kind: 'variable'},
				{name: 'PM_CLI_DEFAULT', kind: 'variable'},
				{name: 'PRETTIER_CLI_DEFAULT', kind: 'variable'},
			],
		},
		'./deploy.task.js': {
			path: 'deploy.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./dev.task.js': {
			path: 'dev.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'DevTask_Context', kind: 'type'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./env.js': {
			path: 'env.ts',
			declarations: [
				{name: 'load_env', kind: 'function'},
				{name: 'merge_envs', kind: 'function'},
				{name: 'is_private_env', kind: 'function'},
				{name: 'is_public_env', kind: 'function'},
				{name: 'load_from_env', kind: 'function'},
			],
		},
		'./esbuild_helpers.js': {
			path: 'esbuild_helpers.ts',
			declarations: [
				{name: 'print_build_result', kind: 'function'},
				{name: 'to_define_import_meta_env', kind: 'function'},
				{name: 'default_ts_transform_options', kind: 'variable'},
			],
		},
		'./esbuild_plugin_external_worker.js': {
			path: 'esbuild_plugin_external_worker.ts',
			declarations: [
				{name: 'Esbuild_Plugin_External_Worker_Options', kind: 'type'},
				{name: 'esbuild_plugin_external_worker', kind: 'function'},
			],
		},
		'./esbuild_plugin_svelte.js': {
			path: 'esbuild_plugin_svelte.ts',
			declarations: [
				{name: 'Esbuild_Plugin_Svelte_Options', kind: 'type'},
				{name: 'esbuild_plugin_svelte', kind: 'function'},
			],
		},
		'./esbuild_plugin_sveltekit_local_imports.js': {
			path: 'esbuild_plugin_sveltekit_local_imports.ts',
			declarations: [{name: 'esbuild_plugin_sveltekit_local_imports', kind: 'function'}],
		},
		'./esbuild_plugin_sveltekit_shim_alias.js': {
			path: 'esbuild_plugin_sveltekit_shim_alias.ts',
			declarations: [
				{name: 'Esbuild_Plugin_Sveltekit_Shim_Alias_Options', kind: 'type'},
				{name: 'esbuild_plugin_sveltekit_shim_alias', kind: 'function'},
			],
		},
		'./esbuild_plugin_sveltekit_shim_app.js': {
			path: 'esbuild_plugin_sveltekit_shim_app.ts',
			declarations: [
				{name: 'Esbuild_Plugin_Sveltekit_Shim_App_Options', kind: 'type'},
				{name: 'esbuild_plugin_sveltekit_shim_app', kind: 'function'},
			],
		},
		'./esbuild_plugin_sveltekit_shim_env.js': {
			path: 'esbuild_plugin_sveltekit_shim_env.ts',
			declarations: [
				{name: 'Esbuild_Plugin_Sveltekit_Shim_Env_Options', kind: 'type'},
				{name: 'esbuild_plugin_sveltekit_shim_env', kind: 'function'},
			],
		},
		'./filer.js': {
			path: 'filer.ts',
			declarations: [
				{name: 'Source_File', kind: 'type'},
				{name: 'Cleanup_Watch', kind: 'type'},
				{name: 'On_Filer_Change', kind: 'type'},
				{name: 'Filer_Options', kind: 'type'},
				{name: 'Filer', kind: 'class'},
			],
		},
		'./format_directory.js': {
			path: 'format_directory.ts',
			declarations: [{name: 'format_directory', kind: 'function'}],
		},
		'./format_file.js': {
			path: 'format_file.ts',
			declarations: [{name: 'format_file', kind: 'function'}],
		},
		'./format.task.js': {
			path: 'format.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./fs.js': {path: 'fs.ts', declarations: [{name: 'empty_dir', kind: 'function'}]},
		'./gen.task.js': {
			path: 'gen.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./gen.js': {
			path: 'gen.ts',
			declarations: [
				{name: 'GEN_FILE_PATTERN_TEXT', kind: 'variable'},
				{name: 'GEN_FILE_PATTERN', kind: 'variable'},
				{name: 'is_gen_path', kind: 'function'},
				{name: 'Gen_Result', kind: 'type'},
				{name: 'Gen_File', kind: 'type'},
				{name: 'Gen', kind: 'type'},
				{name: 'Gen_Context', kind: 'type'},
				{name: 'Raw_Gen_Result', kind: 'type'},
				{name: 'Raw_Gen_File', kind: 'type'},
				{name: 'Gen_Config', kind: 'variable'},
				{name: 'Gen_Results', kind: 'type'},
				{name: 'Genfile_Module_Result', kind: 'type'},
				{name: 'Genfile_Module_Result_Success', kind: 'type'},
				{name: 'Genfile_Module_Result_Failure', kind: 'type'},
				{name: 'to_gen_result', kind: 'function'},
				{name: 'to_output_file_name', kind: 'function'},
				{name: 'Analyzed_Gen_Result', kind: 'type'},
				{name: 'analyze_gen_results', kind: 'function'},
				{name: 'analyze_gen_result', kind: 'function'},
				{name: 'write_gen_results', kind: 'function'},
				{name: 'Found_Genfiles', kind: 'type'},
				{name: 'Find_Genfiles_Result', kind: 'type'},
				{name: 'Find_Genfiles_Failure', kind: 'type'},
				{name: 'find_genfiles', kind: 'function'},
				{name: 'Genfile_Module', kind: 'type'},
				{name: 'Genfile_Module_Meta', kind: 'type'},
				{name: 'Loaded_Genfiles', kind: 'type'},
				{name: 'Load_Genfiles_Result', kind: 'type'},
				{name: 'Load_Genfiles_Failure', kind: 'type'},
				{name: 'load_genfiles', kind: 'function'},
				{name: 'validate_gen_module', kind: 'function'},
			],
		},
		'./git.js': {
			path: 'git.ts',
			declarations: [
				{name: 'Git_Origin', kind: 'variable'},
				{name: 'Git_Branch', kind: 'variable'},
				{name: 'git_current_branch_name', kind: 'function'},
				{name: 'git_remote_branch_exists', kind: 'function'},
				{name: 'git_local_branch_exists', kind: 'function'},
				{name: 'git_check_clean_workspace', kind: 'function'},
				{name: 'git_check_fully_staged_workspace', kind: 'function'},
				{name: 'git_fetch', kind: 'function'},
				{name: 'git_checkout', kind: 'function'},
				{name: 'git_pull', kind: 'function'},
				{name: 'git_push', kind: 'function'},
				{name: 'git_push_to_create', kind: 'function'},
				{name: 'git_delete_local_branch', kind: 'function'},
				{name: 'git_delete_remote_branch', kind: 'function'},
				{name: 'git_reset_branch_to_first_commit', kind: 'function'},
				{name: 'git_current_commit_hash', kind: 'function'},
				{name: 'git_current_branch_first_commit_hash', kind: 'function'},
				{name: 'git_check_setting_pull_rebase', kind: 'function'},
				{name: 'git_clone_locally', kind: 'function'},
			],
		},
		'./github.js': {
			path: 'github.ts',
			declarations: [
				{name: 'GITHUB_REPO_MATCHER', kind: 'variable'},
				{name: 'Github_Pull_Request', kind: 'variable'},
				{name: 'github_fetch_commit_prs', kind: 'function'},
			],
		},
		'./gro_config.js': {
			path: 'gro_config.ts',
			declarations: [
				{name: 'Gro_Config', kind: 'type'},
				{name: 'Raw_Gro_Config', kind: 'type'},
				{name: 'Create_Gro_Config', kind: 'type'},
				{name: 'create_empty_gro_config', kind: 'function'},
				{name: 'SEARCH_EXCLUDER_DEFAULT', kind: 'variable'},
				{name: 'EXPORTS_EXCLUDER_DEFAULT', kind: 'variable'},
				{name: 'normalize_gro_config', kind: 'function'},
				{name: 'Gro_Config_Module', kind: 'type'},
				{name: 'load_gro_config', kind: 'function'},
				{name: 'validate_gro_config_module', kind: 'function'},
			],
		},
		'./gro_helpers.js': {
			path: 'gro_helpers.ts',
			declarations: [
				{name: 'resolve_gro_module_path', kind: 'function'},
				{name: 'spawn_with_loader', kind: 'function'},
			],
		},
		'./gro_plugin_gen.js': {
			path: 'gro_plugin_gen.ts',
			declarations: [
				{name: 'Task_Args', kind: 'type'},
				{name: 'Gro_Plugin_Gen_Options', kind: 'type'},
				{name: 'gro_plugin_gen', kind: 'function'},
				{name: 'filter_dependents', kind: 'function'},
			],
		},
		'./gro_plugin_moss.js': {
			path: 'gro_plugin_moss.ts',
			declarations: [
				{name: 'generate_classes_css', kind: 'function'},
				{name: 'Task_Args', kind: 'type'},
				{name: 'Options', kind: 'type'},
				{name: 'gro_plugin_moss', kind: 'function'},
			],
		},
		'./gro_plugin_server.js': {
			path: 'gro_plugin_server.ts',
			declarations: [
				{name: 'SERVER_SOURCE_ID', kind: 'variable'},
				{name: 'has_server', kind: 'function'},
				{name: 'Gro_Plugin_Server_Options', kind: 'type'},
				{name: 'Outpaths', kind: 'type'},
				{name: 'Create_Outpaths', kind: 'type'},
				{name: 'gro_plugin_server', kind: 'function'},
			],
		},
		'./gro_plugin_sveltekit_app.js': {
			path: 'gro_plugin_sveltekit_app.ts',
			declarations: [
				{name: 'Gro_Plugin_Sveltekit_App_Options', kind: 'type'},
				{name: 'Host_Target', kind: 'type'},
				{name: 'Copy_File_Filter', kind: 'type'},
				{name: 'gro_plugin_sveltekit_app', kind: 'function'},
			],
		},
		'./gro_plugin_sveltekit_library.js': {
			path: 'gro_plugin_sveltekit_library.ts',
			declarations: [
				{name: 'Gro_Plugin_Sveltekit_Library_Options', kind: 'type'},
				{name: 'gro_plugin_sveltekit_library', kind: 'function'},
			],
		},
		'./gro.config.default.js': {
			path: 'gro.config.default.ts',
			declarations: [{name: 'default', kind: 'function'}],
		},
		'./gro.js': {path: 'gro.ts', declarations: []},
		'./hash.js': {path: 'hash.ts', declarations: [{name: 'to_hash', kind: 'function'}]},
		'./input_path.js': {
			path: 'input_path.ts',
			declarations: [
				{name: 'Input_Path', kind: 'variable'},
				{name: 'Raw_Input_Path', kind: 'variable'},
				{name: 'to_input_path', kind: 'function'},
				{name: 'to_input_paths', kind: 'function'},
				{name: 'Possible_Path', kind: 'type'},
				{name: 'get_possible_paths', kind: 'function'},
				{name: 'Resolved_Input_Path', kind: 'type'},
				{name: 'Resolved_Input_File', kind: 'type'},
				{name: 'Resolved_Input_Paths', kind: 'type'},
				{name: 'resolve_input_paths', kind: 'function'},
				{name: 'Resolved_Input_Files', kind: 'type'},
				{name: 'resolve_input_files', kind: 'function'},
			],
		},
		'./invoke_task.js': {
			path: 'invoke_task.ts',
			declarations: [{name: 'invoke_task', kind: 'function'}],
		},
		'./invoke.js': {path: 'invoke.ts', declarations: []},
		'./lint.task.js': {
			path: 'lint.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./loader.js': {
			path: 'loader.ts',
			declarations: [
				{name: 'load', kind: 'function'},
				{name: 'resolve', kind: 'function'},
			],
		},
		'./module.js': {
			path: 'module.ts',
			declarations: [
				{name: 'MODULE_PATH_SRC_PREFIX', kind: 'variable'},
				{name: 'MODULE_PATH_LIB_PREFIX', kind: 'variable'},
				{name: 'is_external_module', kind: 'function'},
			],
		},
		'./modules.js': {
			path: 'modules.ts',
			declarations: [
				{name: 'Module_Meta', kind: 'type'},
				{name: 'Load_Module_Result', kind: 'type'},
				{name: 'Load_Module_Failure', kind: 'type'},
				{name: 'load_module', kind: 'function'},
				{name: 'Load_Modules_Failure', kind: 'type'},
				{name: 'Load_Modules_Result', kind: 'type'},
				{name: 'load_modules', kind: 'function'},
			],
		},
		'./moss_helpers.js': {
			path: 'moss_helpers.ts',
			declarations: [
				{name: 'MOSS_PACKAGE_DEP_NAME', kind: 'variable'},
				{name: 'load_moss_plugin', kind: 'function'},
			],
		},
		'./package_json.js': {
			path: 'package_json.ts',
			declarations: [
				{name: 'Url', kind: 'variable'},
				{name: 'Email', kind: 'variable'},
				{name: 'transform_empty_object_to_undefined', kind: 'function'},
				{name: 'Package_Json_Repository', kind: 'variable'},
				{name: 'Package_Json_Author', kind: 'variable'},
				{name: 'Package_Json_Funding', kind: 'variable'},
				{name: 'Export_Value', kind: 'variable'},
				{name: 'Export_Conditions', kind: 'variable'},
				{name: 'Package_Json_Exports', kind: 'variable'},
				{name: 'Package_Json', kind: 'variable'},
				{name: 'Map_Package_Json', kind: 'type'},
				{name: 'EMPTY_PACKAGE_JSON', kind: 'variable'},
				{name: 'load_package_json', kind: 'function'},
				{name: 'sync_package_json', kind: 'function'},
				{name: 'load_gro_package_json', kind: 'function'},
				{name: 'write_package_json', kind: 'function'},
				{name: 'serialize_package_json', kind: 'function'},
				{name: 'update_package_json', kind: 'function'},
				{name: 'to_package_exports', kind: 'function'},
				{name: 'parse_repo_url', kind: 'function'},
				{name: 'has_dep', kind: 'function'},
				{name: 'Package_Json_Dep', kind: 'type'},
				{name: 'extract_deps', kind: 'function'},
			],
		},
		'./package_meta.js': {
			path: 'package_meta.ts',
			declarations: [
				{name: 'Package_Meta', kind: 'type'},
				{name: 'parse_package_meta', kind: 'function'},
				{name: 'parse_repo_name', kind: 'function'},
				{name: 'parse_org_url', kind: 'function'},
			],
		},
		'./package.gen.js': {path: 'package.gen.ts', declarations: [{name: 'gen', kind: 'function'}]},
		'./package.js': {
			path: 'package.ts',
			declarations: [
				{name: 'package_json', kind: 'variable'},
				{name: 'src_json', kind: 'variable'},
			],
		},
		'./parse_imports.js': {
			path: 'parse_imports.ts',
			declarations: [
				{name: 'init_lexer', kind: 'function'},
				{name: 'Import_Specifier', kind: 'type'},
				{name: 'parse_imports', kind: 'function'},
			],
		},
		'./path.js': {
			path: 'path.ts',
			declarations: [
				{name: 'Path_Id', kind: 'type'},
				{name: 'Path_Info', kind: 'type'},
				{name: 'Resolved_Path', kind: 'type'},
				{name: 'Path_Filter', kind: 'type'},
				{name: 'File_Filter', kind: 'type'},
				{name: 'to_file_path', kind: 'function'},
			],
		},
		'./paths.js': {
			path: 'paths.ts',
			declarations: [
				{name: 'LIB_DIRNAME', kind: 'variable'},
				{name: 'LIB_PATH', kind: 'variable'},
				{name: 'LIB_DIR', kind: 'variable'},
				{name: 'ROUTES_DIRNAME', kind: 'variable'},
				{name: 'Paths', kind: 'type'},
				{name: 'create_paths', kind: 'function'},
				{name: 'infer_paths', kind: 'function'},
				{name: 'is_gro_id', kind: 'function'},
				{name: 'to_root_path', kind: 'function'},
				{name: 'path_id_to_base_path', kind: 'function'},
				{name: 'base_path_to_path_id', kind: 'function'},
				{name: 'print_path', kind: 'function'},
				{name: 'replace_extension', kind: 'function'},
				{name: 'paths', kind: 'variable'},
				{name: 'GRO_PACKAGE_DIR', kind: 'variable'},
				{name: 'IS_THIS_GRO', kind: 'variable'},
				{name: 'gro_paths', kind: 'variable'},
				{name: 'GRO_DIST_DIR', kind: 'variable'},
			],
		},
		'./plugin.js': {
			path: 'plugin.ts',
			declarations: [
				{name: 'Plugin', kind: 'type'},
				{name: 'Create_Config_Plugins', kind: 'type'},
				{name: 'Plugin_Context', kind: 'type'},
				{name: 'Plugins', kind: 'class'},
				{name: 'replace_plugin', kind: 'function'},
			],
		},
		'./publish.task.js': {
			path: 'publish.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./register.js': {path: 'register.ts', declarations: []},
		'./reinstall.task.js': {
			path: 'reinstall.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./release.task.js': {
			path: 'release.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./resolve_node_specifier.js': {
			path: 'resolve_node_specifier.ts',
			declarations: [
				{name: 'resolve_node_specifier', kind: 'function'},
				{name: 'resolve_exported_value', kind: 'function'},
			],
		},
		'./resolve_specifier.js': {
			path: 'resolve_specifier.ts',
			declarations: [
				{name: 'Resolved_Specifier', kind: 'type'},
				{name: 'resolve_specifier', kind: 'function'},
			],
		},
		'./resolve.task.js': {
			path: 'resolve.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./run_gen.js': {
			path: 'run_gen.ts',
			declarations: [
				{name: 'GEN_NO_PROD_MESSAGE', kind: 'variable'},
				{name: 'run_gen', kind: 'function'},
			],
		},
		'./run_task.js': {
			path: 'run_task.ts',
			declarations: [
				{name: 'Run_Task_Result', kind: 'type'},
				{name: 'run_task', kind: 'function'},
			],
		},
		'./run.task.js': {
			path: 'run.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./search_fs.js': {
			path: 'search_fs.ts',
			declarations: [
				{name: 'Search_Fs_Options', kind: 'type'},
				{name: 'search_fs', kind: 'function'},
			],
		},
		'./src_json.js': {
			path: 'src_json.ts',
			declarations: [
				{name: 'Src_Module_Declaration', kind: 'variable'},
				{name: 'Src_Module', kind: 'variable'},
				{name: 'Src_Modules', kind: 'variable'},
				{name: 'Src_Json', kind: 'variable'},
				{name: 'Map_Src_Json', kind: 'type'},
				{name: 'create_src_json', kind: 'function'},
				{name: 'serialize_src_json', kind: 'function'},
				{name: 'to_src_modules', kind: 'function'},
			],
		},
		'./svelte_helpers.js': {
			path: 'svelte_helpers.ts',
			declarations: [
				{name: 'SVELTE_MATCHER', kind: 'variable'},
				{name: 'SVELTE_RUNES_MATCHER', kind: 'variable'},
			],
		},
		'./sveltekit_config.js': {
			path: 'sveltekit_config.ts',
			declarations: [
				{name: 'load_sveltekit_config', kind: 'function'},
				{name: 'Parsed_Sveltekit_Config', kind: 'type'},
				{name: 'init_sveltekit_config', kind: 'function'},
				{name: 'to_default_compile_module_options', kind: 'function'},
				{name: 'default_sveltekit_config', kind: 'variable'},
			],
		},
		'./sveltekit_helpers.js': {
			path: 'sveltekit_helpers.ts',
			declarations: [
				{name: 'SVELTEKIT_CLI', kind: 'variable'},
				{name: 'SVELTE_CHECK_CLI', kind: 'variable'},
				{name: 'SVELTE_PACKAGE_CLI', kind: 'variable'},
				{name: 'SVELTE_PACKAGE_DEP_NAME', kind: 'variable'},
				{name: 'VITE_CLI', kind: 'variable'},
				{name: 'SVELTEKIT_ENV_MATCHER', kind: 'variable'},
				{name: 'has_sveltekit_app', kind: 'function'},
				{name: 'has_sveltekit_library', kind: 'function'},
				{name: 'sveltekit_sync', kind: 'function'},
				{name: 'sveltekit_sync_if_available', kind: 'function'},
				{name: 'sveltekit_sync_if_obviously_needed', kind: 'function'},
				{name: 'Svelte_Package_Options', kind: 'type'},
				{name: 'run_svelte_package', kind: 'function'},
				{name: 'map_sveltekit_aliases', kind: 'function'},
			],
		},
		'./sveltekit_shim_app_environment.js': {
			path: 'sveltekit_shim_app_environment.ts',
			declarations: [
				{name: 'browser', kind: 'variable'},
				{name: 'building', kind: 'variable'},
				{name: 'dev', kind: 'variable'},
				{name: 'version', kind: 'variable'},
			],
		},
		'./sveltekit_shim_app_forms.js': {
			path: 'sveltekit_shim_app_forms.ts',
			declarations: [
				{name: 'applyAction', kind: 'function'},
				{name: 'deserialize', kind: 'function'},
				{name: 'enhance', kind: 'function'},
			],
		},
		'./sveltekit_shim_app_navigation.js': {
			path: 'sveltekit_shim_app_navigation.ts',
			declarations: [
				{name: 'afterNavigate', kind: 'function'},
				{name: 'beforeNavigate', kind: 'function'},
				{name: 'disableScrollHandling', kind: 'function'},
				{name: 'goto', kind: 'function'},
				{name: 'invalidate', kind: 'function'},
				{name: 'invalidateAll', kind: 'function'},
				{name: 'preloadCode', kind: 'function'},
				{name: 'preloadData', kind: 'function'},
			],
		},
		'./sveltekit_shim_app_paths.js': {
			path: 'sveltekit_shim_app_paths.ts',
			declarations: [
				{name: 'assets', kind: 'variable'},
				{name: 'base', kind: 'variable'},
				{name: 'resolveRoute', kind: 'function'},
			],
		},
		'./sveltekit_shim_app_stores.js': {
			path: 'sveltekit_shim_app_stores.ts',
			declarations: [
				{name: 'getStores', kind: 'function'},
				{name: 'navigating', kind: 'variable'},
				{name: 'page', kind: 'variable'},
				{name: 'updated', kind: 'variable'},
			],
		},
		'./sveltekit_shim_app.js': {
			path: 'sveltekit_shim_app.ts',
			declarations: [
				{name: 'SVELTEKIT_SHIM_APP_PATHS_MATCHER', kind: 'variable'},
				{name: 'SVELTEKIT_SHIM_APP_ENVIRONMENT_MATCHER', kind: 'variable'},
				{name: 'sveltekit_shim_app_specifiers', kind: 'variable'},
				{name: 'render_sveltekit_shim_app_paths', kind: 'function'},
				{name: 'render_sveltekit_shim_app_environment', kind: 'function'},
			],
		},
		'./sveltekit_shim_env.js': {
			path: 'sveltekit_shim_env.ts',
			declarations: [{name: 'render_env_shim_module', kind: 'function'}],
		},
		'./sync.task.js': {
			path: 'sync.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./task_logging.js': {
			path: 'task_logging.ts',
			declarations: [
				{name: 'log_tasks', kind: 'function'},
				{name: 'log_error_reasons', kind: 'function'},
				{name: 'log_task_help', kind: 'function'},
			],
		},
		'./task.js': {
			path: 'task.ts',
			declarations: [
				{name: 'Task', kind: 'type'},
				{name: 'Task_Context', kind: 'type'},
				{name: 'TASK_FILE_SUFFIX_TS', kind: 'variable'},
				{name: 'TASK_FILE_SUFFIX_JS', kind: 'variable'},
				{name: 'TASK_FILE_SUFFIXES', kind: 'variable'},
				{name: 'is_task_path', kind: 'function'},
				{name: 'to_task_name', kind: 'function'},
				{name: 'Task_Error', kind: 'class'},
				{name: 'Silent_Error', kind: 'class'},
				{name: 'Found_Task', kind: 'type'},
				{name: 'Found_Tasks', kind: 'type'},
				{name: 'Find_Tasks_Result', kind: 'type'},
				{name: 'Find_Modules_Failure', kind: 'type'},
				{name: 'find_tasks', kind: 'function'},
				{name: 'Loaded_Tasks', kind: 'type'},
				{name: 'Task_Module', kind: 'type'},
				{name: 'Task_Module_Meta', kind: 'type'},
				{name: 'Load_Tasks_Result', kind: 'type'},
				{name: 'Load_Tasks_Failure', kind: 'type'},
				{name: 'load_tasks', kind: 'function'},
				{name: 'validate_task_module', kind: 'function'},
			],
		},
		'./test.task.js': {
			path: 'test.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./typecheck.task.js': {
			path: 'typecheck.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./upgrade.task.js': {
			path: 'upgrade.task.ts',
			declarations: [
				{name: 'Args', kind: 'variable'},
				{name: 'task', kind: 'variable'},
			],
		},
		'./watch_dir.js': {
			path: 'watch_dir.ts',
			declarations: [
				{name: 'Watch_Node_Fs', kind: 'type'},
				{name: 'Watcher_Change', kind: 'type'},
				{name: 'Watcher_Change_Type', kind: 'type'},
				{name: 'Watcher_Change_Callback', kind: 'type'},
				{name: 'Watch_Dir_Options', kind: 'type'},
				{name: 'watch_dir', kind: 'function'},
			],
		},
	},
} satisfies Src_Json;

// generated by src/lib/package.gen.ts
