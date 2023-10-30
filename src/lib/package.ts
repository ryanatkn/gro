import type {PackageJson} from './package_json.js';

export const package_json = {
	name: '@grogarden/gro',
	description: 'task runner and toolkit extending SvelteKit',
	version: '0.96.4',
	bin: {gro: 'dist/gro.js'},
	license: 'MIT',
	homepage: 'https://www.grogarden.org/',
	author: {name: 'Ryan Atkinson', email: 'mail@ryanatkn.com', url: 'https://www.ryanatkn.com/'},
	repository: {type: 'git', url: 'git+https://github.com/grogarden/gro.git'},
	bugs: {url: 'https://github.com/grogarden/gro/issues', email: 'mail@ryanatkn.com'},
	type: 'module',
	engines: {node: '>=20.7'},
	scripts: {
		build: 'rm -rf .gro dist && svelte-package && chmod +x ./dist/gro.js && npm link -f',
		start: 'gro dev',
		test: 'gro test',
	},
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
	files: ['dist'],
	dependencies: {
		'@grogarden/util': '^0.15.2',
		'@ryanatkn/json-schema-to-typescript': '^11.1.5',
		chokidar: '^3.5.3',
		dotenv: '^16.3.1',
		'es-module-lexer': '^1.3.1',
		kleur: '^4.1.5',
		mri: '^1.2.0',
		prettier: '^3.0.3',
		'prettier-plugin-svelte': '^3.0.3',
		'tiny-glob': '^0.2.9',
		'ts-morph': '^20.0.0',
		tslib: '^2.6.2',
		zod: '^3.22.4',
	},
	peerDependencies: {esbuild: '^0.18', svelte: '*'},
	devDependencies: {
		'@changesets/changelog-git': '^0.1.14',
		'@changesets/types': '^5.2.1',
		'@feltjs/eslint-config': '^0.4.1',
		'@fuz.dev/fuz': '^0.75.2',
		'@fuz.dev/fuz_library': '^0.14.2',
		'@sveltejs/adapter-static': '^2.0.3',
		'@sveltejs/kit': '^1.27.1',
		'@sveltejs/package': '^2.2.2',
		'@types/fs-extra': '^11.0.3',
		'@types/node': '^20.8.9',
		'@typescript-eslint/eslint-plugin': '^6.9.0',
		'@typescript-eslint/parser': '^6.9.0',
		esbuild: '^0.18.0',
		eslint: '^8.52.0',
		'eslint-plugin-svelte': '^2.34.0',
		svelte: '^4.2.2',
		'svelte-check': '^3.5.2',
		typescript: '^5.2.2',
		uvu: '^0.5.6',
	},
	eslintConfig: {root: true, extends: '@feltjs', rules: {'no-console': 1}},
	prettier: {
		plugins: ['prettier-plugin-svelte'],
		useTabs: true,
		printWidth: 100,
		singleQuote: true,
		bracketSpacing: false,
		overrides: [{files: 'package.json', options: {useTabs: false}}],
	},
	exports: {
		'.': {default: './dist/index.js', types: './dist/index.d.ts'},
		'./args.js': {default: './dist/args.js', types: './dist/args.d.ts'},
		'./build.task.js': {default: './dist/build.task.js', types: './dist/build.task.d.ts'},
		'./changeset.task.js': {
			default: './dist/changeset.task.js',
			types: './dist/changeset.task.d.ts',
		},
		'./check.task.js': {default: './dist/check.task.js', types: './dist/check.task.d.ts'},
		'./clean_fs.js': {default: './dist/clean_fs.js', types: './dist/clean_fs.d.ts'},
		'./clean.task.js': {default: './dist/clean.task.js', types: './dist/clean.task.d.ts'},
		'./cli.js': {default: './dist/cli.js', types: './dist/cli.d.ts'},
		'./commit.task.js': {default: './dist/commit.task.js', types: './dist/commit.task.d.ts'},
		'./config.js': {default: './dist/config.js', types: './dist/config.d.ts'},
		'./deploy.task.js': {default: './dist/deploy.task.js', types: './dist/deploy.task.d.ts'},
		'./dev.task.js': {default: './dist/dev.task.js', types: './dist/dev.task.d.ts'},
		'./env.js': {default: './dist/env.js', types: './dist/env.d.ts'},
		'./esbuild_helpers.js': {
			default: './dist/esbuild_helpers.js',
			types: './dist/esbuild_helpers.d.ts',
		},
		'./esbuild_plugin_external_worker.js': {
			default: './dist/esbuild_plugin_external_worker.js',
			types: './dist/esbuild_plugin_external_worker.d.ts',
		},
		'./esbuild_plugin_svelte.js': {
			default: './dist/esbuild_plugin_svelte.js',
			types: './dist/esbuild_plugin_svelte.d.ts',
		},
		'./esbuild_plugin_sveltekit_local_imports.js': {
			default: './dist/esbuild_plugin_sveltekit_local_imports.js',
			types: './dist/esbuild_plugin_sveltekit_local_imports.d.ts',
		},
		'./esbuild_plugin_sveltekit_shim_alias.js': {
			default: './dist/esbuild_plugin_sveltekit_shim_alias.js',
			types: './dist/esbuild_plugin_sveltekit_shim_alias.d.ts',
		},
		'./esbuild_plugin_sveltekit_shim_app.js': {
			default: './dist/esbuild_plugin_sveltekit_shim_app.js',
			types: './dist/esbuild_plugin_sveltekit_shim_app.d.ts',
		},
		'./esbuild_plugin_sveltekit_shim_env.js': {
			default: './dist/esbuild_plugin_sveltekit_shim_env.js',
			types: './dist/esbuild_plugin_sveltekit_shim_env.d.ts',
		},
		'./exists.js': {default: './dist/exists.js', types: './dist/exists.d.ts'},
		'./format_directory.js': {
			default: './dist/format_directory.js',
			types: './dist/format_directory.d.ts',
		},
		'./format_file.js': {default: './dist/format_file.js', types: './dist/format_file.d.ts'},
		'./format.task.js': {default: './dist/format.task.js', types: './dist/format.task.d.ts'},
		'./gen_module.js': {default: './dist/gen_module.js', types: './dist/gen_module.d.ts'},
		'./gen_schemas.js': {default: './dist/gen_schemas.js', types: './dist/gen_schemas.d.ts'},
		'./gen.task.js': {default: './dist/gen.task.js', types: './dist/gen.task.d.ts'},
		'./gen.js': {default: './dist/gen.js', types: './dist/gen.d.ts'},
		'./git.js': {default: './dist/git.js', types: './dist/git.d.ts'},
		'./gro_plugin_gen.js': {
			default: './dist/gro_plugin_gen.js',
			types: './dist/gro_plugin_gen.d.ts',
		},
		'./gro_plugin_library.js': {
			default: './dist/gro_plugin_library.js',
			types: './dist/gro_plugin_library.d.ts',
		},
		'./gro_plugin_server.js': {
			default: './dist/gro_plugin_server.js',
			types: './dist/gro_plugin_server.d.ts',
		},
		'./gro_plugin_sveltekit_frontend.js': {
			default: './dist/gro_plugin_sveltekit_frontend.js',
			types: './dist/gro_plugin_sveltekit_frontend.d.ts',
		},
		'./gro.config.default.js': {
			default: './dist/gro.config.default.js',
			types: './dist/gro.config.default.d.ts',
		},
		'./gro.js': {default: './dist/gro.js', types: './dist/gro.d.ts'},
		'./hash.js': {default: './dist/hash.js', types: './dist/hash.d.ts'},
		'./input_path.js': {default: './dist/input_path.js', types: './dist/input_path.d.ts'},
		'./invoke_task.js': {default: './dist/invoke_task.js', types: './dist/invoke_task.d.ts'},
		'./invoke.js': {default: './dist/invoke.js', types: './dist/invoke.d.ts'},
		'./lint.task.js': {default: './dist/lint.task.js', types: './dist/lint.task.d.ts'},
		'./loader.js': {default: './dist/loader.js', types: './dist/loader.d.ts'},
		'./module.js': {default: './dist/module.js', types: './dist/module.d.ts'},
		'./modules.js': {default: './dist/modules.js', types: './dist/modules.d.ts'},
		'./package_json.js': {default: './dist/package_json.js', types: './dist/package_json.d.ts'},
		'./package.gen.js': {default: './dist/package.gen.js', types: './dist/package.gen.d.ts'},
		'./package.js': {default: './dist/package.js', types: './dist/package.d.ts'},
		'./path.js': {default: './dist/path.js', types: './dist/path.d.ts'},
		'./paths.js': {default: './dist/paths.js', types: './dist/paths.d.ts'},
		'./plugin.js': {default: './dist/plugin.js', types: './dist/plugin.d.ts'},
		'./print_task.js': {default: './dist/print_task.js', types: './dist/print_task.d.ts'},
		'./publish.task.js': {default: './dist/publish.task.js', types: './dist/publish.task.d.ts'},
		'./release.task.js': {default: './dist/release.task.js', types: './dist/release.task.d.ts'},
		'./resolve_node_specifier.js': {
			default: './dist/resolve_node_specifier.js',
			types: './dist/resolve_node_specifier.d.ts',
		},
		'./resolve_specifier.js': {
			default: './dist/resolve_specifier.js',
			types: './dist/resolve_specifier.d.ts',
		},
		'./run_gen.js': {default: './dist/run_gen.js', types: './dist/run_gen.d.ts'},
		'./run_task.js': {default: './dist/run_task.js', types: './dist/run_task.d.ts'},
		'./schema.js': {default: './dist/schema.js', types: './dist/schema.d.ts'},
		'./search_fs.js': {default: './dist/search_fs.js', types: './dist/search_fs.d.ts'},
		'./sveltekit_config.js': {
			default: './dist/sveltekit_config.js',
			types: './dist/sveltekit_config.d.ts',
		},
		'./sveltekit_shim_app_environment.js': {
			default: './dist/sveltekit_shim_app_environment.js',
			types: './dist/sveltekit_shim_app_environment.d.ts',
		},
		'./sveltekit_shim_app_forms.js': {
			default: './dist/sveltekit_shim_app_forms.js',
			types: './dist/sveltekit_shim_app_forms.d.ts',
		},
		'./sveltekit_shim_app_navigation.js': {
			default: './dist/sveltekit_shim_app_navigation.js',
			types: './dist/sveltekit_shim_app_navigation.d.ts',
		},
		'./sveltekit_shim_app_paths.js': {
			default: './dist/sveltekit_shim_app_paths.js',
			types: './dist/sveltekit_shim_app_paths.d.ts',
		},
		'./sveltekit_shim_app_stores.js': {
			default: './dist/sveltekit_shim_app_stores.js',
			types: './dist/sveltekit_shim_app_stores.d.ts',
		},
		'./sveltekit_shim_app.js': {
			default: './dist/sveltekit_shim_app.js',
			types: './dist/sveltekit_shim_app.d.ts',
		},
		'./sveltekit_shim_env.js': {
			default: './dist/sveltekit_shim_env.js',
			types: './dist/sveltekit_shim_env.d.ts',
		},
		'./sync.task.js': {default: './dist/sync.task.js', types: './dist/sync.task.d.ts'},
		'./task_module.js': {default: './dist/task_module.js', types: './dist/task_module.d.ts'},
		'./task.js': {default: './dist/task.js', types: './dist/task.d.ts'},
		'./test.task.js': {default: './dist/test.task.js', types: './dist/test.task.d.ts'},
		'./throttle.js': {default: './dist/throttle.js', types: './dist/throttle.d.ts'},
		'./type_imports.js': {default: './dist/type_imports.js', types: './dist/type_imports.d.ts'},
		'./typecheck.task.js': {
			default: './dist/typecheck.task.js',
			types: './dist/typecheck.task.d.ts',
		},
		'./upgrade.task.js': {default: './dist/upgrade.task.js', types: './dist/upgrade.task.d.ts'},
		'./watch_dir.js': {default: './dist/watch_dir.js', types: './dist/watch_dir.d.ts'},
	},
	modules: {
		'.': {
			path: 'index.ts',
			declarations: [
				{name: 'GroConfig', kind: 'InterfaceDeclaration'},
				{name: 'CreateGroConfig', kind: 'InterfaceDeclaration'},
				{name: 'Plugin', kind: 'InterfaceDeclaration'},
				{name: 'replace_plugin', kind: 'VariableDeclaration'},
				{name: 'Gen', kind: 'InterfaceDeclaration'},
				{name: 'GenContext', kind: 'InterfaceDeclaration'},
				{name: 'Task', kind: 'InterfaceDeclaration'},
				{name: 'TaskContext', kind: 'InterfaceDeclaration'},
				{name: 'TaskError', kind: 'ClassDeclaration'},
			],
		},
		'./args.js': {
			path: 'args.ts',
			declarations: [
				{name: 'Args', kind: 'InterfaceDeclaration'},
				{name: 'ArgValue', kind: 'TypeAliasDeclaration'},
				{name: 'ArgSchema', kind: 'InterfaceDeclaration'},
				{name: 'parse_args', kind: 'VariableDeclaration'},
				{name: 'serialize_args', kind: 'VariableDeclaration'},
				{name: 'to_task_args', kind: 'VariableDeclaration'},
				{name: 'to_raw_rest_args', kind: 'VariableDeclaration'},
				{name: 'to_forwarded_args', kind: 'VariableDeclaration'},
				{name: 'to_forwarded_args_by_command', kind: 'VariableDeclaration'},
				{name: 'print_command_args', kind: 'VariableDeclaration'},
			],
		},
		'./build.task.js': {
			path: 'build.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./changeset.task.js': {
			path: 'changeset.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
				{name: 'ChangesetCallback', kind: 'InterfaceDeclaration'},
				{name: 'UpdateWrittenConfig', kind: 'InterfaceDeclaration'},
				{name: 'update_changeset_config', kind: 'VariableDeclaration'},
				{name: 'load_changeset_config', kind: 'VariableDeclaration'},
				{name: 'load_changeset_config_contents', kind: 'VariableDeclaration'},
				{name: 'write_changeset_config', kind: 'VariableDeclaration'},
				{name: 'serialize_changeset_config', kind: 'VariableDeclaration'},
				{name: 'parse_changeset_config', kind: 'VariableDeclaration'},
			],
		},
		'./check.task.js': {
			path: 'check.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./clean_fs.js': {
			path: 'clean_fs.ts',
			declarations: [{name: 'clean_fs', kind: 'VariableDeclaration'}],
		},
		'./clean.task.js': {
			path: 'clean.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./cli.js': {
			path: 'cli.ts',
			declarations: [
				{name: 'find_cli', kind: 'VariableDeclaration'},
				{name: 'spawn_cli', kind: 'VariableDeclaration'},
			],
		},
		'./commit.task.js': {
			path: 'commit.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./config.js': {
			path: 'config.ts',
			declarations: [
				{name: 'GroConfig', kind: 'InterfaceDeclaration'},
				{name: 'CreateGroConfig', kind: 'InterfaceDeclaration'},
				{name: 'create_empty_config', kind: 'VariableDeclaration'},
				{name: 'GroConfigModule', kind: 'InterfaceDeclaration'},
				{name: 'load_config', kind: 'VariableDeclaration'},
				{name: 'validate_config_module', kind: 'VariableDeclaration'},
			],
		},
		'./deploy.task.js': {
			path: 'deploy.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./dev.task.js': {
			path: 'dev.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'DevTaskContext', kind: 'TypeAliasDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./env.js': {
			path: 'env.ts',
			declarations: [
				{name: 'load_env', kind: 'VariableDeclaration'},
				{name: 'merge_envs', kind: 'VariableDeclaration'},
				{name: 'is_private_env', kind: 'VariableDeclaration'},
				{name: 'is_public_env', kind: 'VariableDeclaration'},
			],
		},
		'./esbuild_helpers.js': {
			path: 'esbuild_helpers.ts',
			declarations: [
				{name: 'print_build_result', kind: 'VariableDeclaration'},
				{name: 'to_define_import_meta_env', kind: 'VariableDeclaration'},
				{name: 'ts_transform_options', kind: 'VariableDeclaration'},
			],
		},
		'./esbuild_plugin_external_worker.js': {
			path: 'esbuild_plugin_external_worker.ts',
			declarations: [
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'esbuild_plugin_external_worker', kind: 'VariableDeclaration'},
			],
		},
		'./esbuild_plugin_svelte.js': {
			path: 'esbuild_plugin_svelte.ts',
			declarations: [
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'esbuild_plugin_svelte', kind: 'VariableDeclaration'},
			],
		},
		'./esbuild_plugin_sveltekit_local_imports.js': {
			path: 'esbuild_plugin_sveltekit_local_imports.ts',
			declarations: [{name: 'esbuild_plugin_sveltekit_local_imports', kind: 'VariableDeclaration'}],
		},
		'./esbuild_plugin_sveltekit_shim_alias.js': {
			path: 'esbuild_plugin_sveltekit_shim_alias.ts',
			declarations: [
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'esbuild_plugin_sveltekit_shim_alias', kind: 'VariableDeclaration'},
			],
		},
		'./esbuild_plugin_sveltekit_shim_app.js': {
			path: 'esbuild_plugin_sveltekit_shim_app.ts',
			declarations: [
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'esbuild_plugin_sveltekit_shim_app', kind: 'VariableDeclaration'},
			],
		},
		'./esbuild_plugin_sveltekit_shim_env.js': {
			path: 'esbuild_plugin_sveltekit_shim_env.ts',
			declarations: [
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'esbuild_plugin_sveltekit_shim_env', kind: 'VariableDeclaration'},
			],
		},
		'./exists.js': {
			path: 'exists.ts',
			declarations: [{name: 'exists', kind: 'VariableDeclaration'}],
		},
		'./format_directory.js': {
			path: 'format_directory.ts',
			declarations: [{name: 'format_directory', kind: 'VariableDeclaration'}],
		},
		'./format_file.js': {
			path: 'format_file.ts',
			declarations: [{name: 'format_file', kind: 'VariableDeclaration'}],
		},
		'./format.task.js': {
			path: 'format.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./gen_module.js': {
			path: 'gen_module.ts',
			declarations: [
				{name: 'GEN_FILE_PATTERN_TEXT', kind: 'VariableDeclaration'},
				{name: 'GEN_FILE_PATTERN', kind: 'VariableDeclaration'},
				{name: 'is_gen_path', kind: 'VariableDeclaration'},
				{name: 'GEN_SCHEMA_FILE_PATTERN_TEXT', kind: 'VariableDeclaration'},
				{name: 'GEN_SCHEMA_FILE_PATTERN', kind: 'VariableDeclaration'},
				{name: 'GEN_SCHEMA_PATH_SUFFIX', kind: 'VariableDeclaration'},
				{name: 'GEN_SCHEMA_IDENTIFIER_SUFFIX', kind: 'VariableDeclaration'},
				{name: 'GenModuleType', kind: 'TypeAliasDeclaration'},
				{name: 'GenModule', kind: 'TypeAliasDeclaration'},
				{name: 'BasicGenModule', kind: 'InterfaceDeclaration'},
				{name: 'SchemaGenModule', kind: 'InterfaceDeclaration'},
				{name: 'to_gen_module_type', kind: 'VariableDeclaration'},
				{name: 'gen_module_meta', kind: 'VariableDeclaration'},
				{name: 'validate_gen_module', kind: 'VariableDeclaration'},
				{name: 'GenModuleMeta', kind: 'TypeAliasDeclaration'},
				{name: 'BasicGenModuleMeta', kind: 'InterfaceDeclaration'},
				{name: 'SchemaGenModuleMeta', kind: 'InterfaceDeclaration'},
				{name: 'load_gen_module', kind: 'VariableDeclaration'},
				{name: 'CheckGenModuleResult', kind: 'TypeAliasDeclaration'},
				{name: 'check_gen_modules', kind: 'VariableDeclaration'},
				{name: 'check_gen_module', kind: 'VariableDeclaration'},
				{name: 'find_gen_modules', kind: 'VariableDeclaration'},
			],
		},
		'./gen_schemas.js': {
			path: 'gen_schemas.ts',
			declarations: [
				{name: 'gen_schemas', kind: 'VariableDeclaration'},
				{name: 'to_schemas_from_modules', kind: 'VariableDeclaration'},
			],
		},
		'./gen.task.js': {
			path: 'gen.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./gen.js': {
			path: 'gen.ts',
			declarations: [
				{name: 'GenResult', kind: 'TypeAliasDeclaration'},
				{name: 'GenFile', kind: 'InterfaceDeclaration'},
				{name: 'Gen', kind: 'InterfaceDeclaration'},
				{name: 'GenContext', kind: 'InterfaceDeclaration'},
				{name: 'RawGenResult', kind: 'TypeAliasDeclaration'},
				{name: 'RawGenFile', kind: 'InterfaceDeclaration'},
				{name: 'GenConfig', kind: 'VariableDeclaration'},
				{name: 'GenResults', kind: 'TypeAliasDeclaration'},
				{name: 'GenModuleResult', kind: 'TypeAliasDeclaration'},
				{name: 'GenModuleResultSuccess', kind: 'TypeAliasDeclaration'},
				{name: 'GenModuleResultFailure', kind: 'TypeAliasDeclaration'},
				{name: 'to_gen_result', kind: 'VariableDeclaration'},
				{name: 'to_output_file_name', kind: 'VariableDeclaration'},
			],
		},
		'./git.js': {
			path: 'git.ts',
			declarations: [
				{name: 'GitOrigin', kind: 'VariableDeclaration'},
				{name: 'GitBranch', kind: 'VariableDeclaration'},
				{name: 'git_current_branch_name', kind: 'VariableDeclaration'},
				{name: 'git_remote_branch_exists', kind: 'VariableDeclaration'},
				{name: 'git_local_branch_exists', kind: 'VariableDeclaration'},
				{name: 'git_check_clean_workspace', kind: 'VariableDeclaration'},
				{name: 'git_fetch', kind: 'VariableDeclaration'},
				{name: 'git_checkout', kind: 'VariableDeclaration'},
				{name: 'git_pull', kind: 'VariableDeclaration'},
				{name: 'git_push', kind: 'VariableDeclaration'},
				{name: 'git_push_to_create', kind: 'VariableDeclaration'},
				{name: 'git_delete_local_branch', kind: 'VariableDeclaration'},
				{name: 'git_delete_remote_branch', kind: 'VariableDeclaration'},
				{name: 'WORKTREE_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'to_worktree_dir', kind: 'VariableDeclaration'},
				{name: 'git_clean_worktree', kind: 'VariableDeclaration'},
				{name: 'git_reset_branch_to_first_commit', kind: 'VariableDeclaration'},
				{name: 'git_current_commit_hash', kind: 'VariableDeclaration'},
				{name: 'git_current_branch_first_commit_hash', kind: 'VariableDeclaration'},
			],
		},
		'./gro_plugin_gen.js': {
			path: 'gro_plugin_gen.ts',
			declarations: [
				{name: 'TaskArgs', kind: 'InterfaceDeclaration'},
				{name: 'plugin', kind: 'VariableDeclaration'},
			],
		},
		'./gro_plugin_library.js': {
			path: 'gro_plugin_library.ts',
			declarations: [
				{name: 'plugin', kind: 'VariableDeclaration'},
				{name: 'has_library', kind: 'VariableDeclaration'},
			],
		},
		'./gro_plugin_server.js': {
			path: 'gro_plugin_server.ts',
			declarations: [
				{name: 'SERVER_SOURCE_ID', kind: 'VariableDeclaration'},
				{name: 'has_server', kind: 'VariableDeclaration'},
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'Outpaths', kind: 'InterfaceDeclaration'},
				{name: 'CreateOutpaths', kind: 'InterfaceDeclaration'},
				{name: 'plugin', kind: 'VariableDeclaration'},
			],
		},
		'./gro_plugin_sveltekit_frontend.js': {
			path: 'gro_plugin_sveltekit_frontend.ts',
			declarations: [
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'HostTarget', kind: 'TypeAliasDeclaration'},
				{name: 'plugin', kind: 'VariableDeclaration'},
			],
		},
		'./gro.config.default.js': {
			path: 'gro.config.default.ts',
			declarations: [
				{name: 'default', kind: 'VariableDeclaration'},
				{name: 'has_sveltekit_frontend', kind: 'VariableDeclaration'},
			],
		},
		'./gro.js': {path: 'gro.ts', declarations: []},
		'./hash.js': {path: 'hash.ts', declarations: [{name: 'to_hash', kind: 'VariableDeclaration'}]},
		'./input_path.js': {
			path: 'input_path.ts',
			declarations: [
				{name: 'resolve_input_path', kind: 'VariableDeclaration'},
				{name: 'resolve_input_paths', kind: 'VariableDeclaration'},
				{name: 'get_possible_source_ids', kind: 'VariableDeclaration'},
				{name: 'load_source_path_data_by_input_path', kind: 'VariableDeclaration'},
				{name: 'load_source_ids_by_input_path', kind: 'VariableDeclaration'},
			],
		},
		'./invoke_task.js': {
			path: 'invoke_task.ts',
			declarations: [{name: 'invoke_task', kind: 'VariableDeclaration'}],
		},
		'./invoke.js': {path: 'invoke.ts', declarations: []},
		'./lint.task.js': {
			path: 'lint.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./loader.js': {
			path: 'loader.ts',
			declarations: [
				{name: 'load', kind: 'VariableDeclaration'},
				{name: 'resolve', kind: 'VariableDeclaration'},
			],
		},
		'./module.js': {
			path: 'module.ts',
			declarations: [
				{name: 'MODULE_PATH_SRC_PREFIX', kind: 'VariableDeclaration'},
				{name: 'MODULE_PATH_LIB_PREFIX', kind: 'VariableDeclaration'},
				{name: 'is_external_module', kind: 'VariableDeclaration'},
			],
		},
		'./modules.js': {
			path: 'modules.ts',
			declarations: [
				{name: 'ModuleMeta', kind: 'InterfaceDeclaration'},
				{name: 'LoadModuleResult', kind: 'TypeAliasDeclaration'},
				{name: 'LoadModuleFailure', kind: 'TypeAliasDeclaration'},
				{name: 'load_module', kind: 'VariableDeclaration'},
				{name: 'FindModulesResult', kind: 'TypeAliasDeclaration'},
				{name: 'FindModulesFailure', kind: 'TypeAliasDeclaration'},
				{name: 'LoadModulesResult', kind: 'TypeAliasDeclaration'},
				{name: 'find_modules', kind: 'VariableDeclaration'},
				{name: 'load_modules', kind: 'VariableDeclaration'},
			],
		},
		'./package_json.js': {
			path: 'package_json.ts',
			declarations: [
				{name: 'PackageJsonRepository', kind: 'VariableDeclaration'},
				{name: 'PackageJsonAuthor', kind: 'VariableDeclaration'},
				{name: 'PackageJsonFunding', kind: 'VariableDeclaration'},
				{name: 'PackageJsonExports', kind: 'VariableDeclaration'},
				{name: 'PackageJson', kind: 'VariableDeclaration'},
				{name: 'MapPackageJson', kind: 'InterfaceDeclaration'},
				{name: 'EMPTY_PACKAGE_JSON', kind: 'VariableDeclaration'},
				{name: 'load_package_json', kind: 'VariableDeclaration'},
				{name: 'sync_package_json', kind: 'VariableDeclaration'},
				{name: 'load_gro_package_json', kind: 'VariableDeclaration'},
				{name: 'write_package_json', kind: 'VariableDeclaration'},
				{name: 'serialize_package_json', kind: 'VariableDeclaration'},
				{name: 'update_package_json', kind: 'VariableDeclaration'},
				{name: 'normalize_package_json', kind: 'VariableDeclaration'},
				{name: 'to_package_exports', kind: 'VariableDeclaration'},
				{name: 'Package_Module_Declaration', kind: 'InterfaceDeclaration'},
				{name: 'Package_Module', kind: 'InterfaceDeclaration'},
				{name: 'Package_Modules', kind: 'TypeAliasDeclaration'},
				{name: 'to_package_modules', kind: 'VariableDeclaration'},
			],
		},
		'./package.gen.js': {
			path: 'package.gen.ts',
			declarations: [{name: 'gen', kind: 'VariableDeclaration'}],
		},
		'./package.js': {
			path: 'package.ts',
			declarations: [{name: 'package_json', kind: 'VariableDeclaration'}],
		},
		'./path.js': {
			path: 'path.ts',
			declarations: [
				{name: 'PathData', kind: 'InterfaceDeclaration'},
				{name: 'to_path_data', kind: 'VariableDeclaration'},
				{name: 'PathStats', kind: 'InterfaceDeclaration'},
				{name: 'PathFilter', kind: 'InterfaceDeclaration'},
			],
		},
		'./paths.js': {
			path: 'paths.ts',
			declarations: [
				{name: 'SOURCE_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'GRO_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'GRO_DIST_PREFIX', kind: 'VariableDeclaration'},
				{name: 'SERVER_DIST_PATH', kind: 'VariableDeclaration'},
				{name: 'LIB_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'ROUTES_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'GRO_DEV_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'SOURCE_DIR', kind: 'VariableDeclaration'},
				{name: 'GRO_DIR', kind: 'VariableDeclaration'},
				{name: 'GRO_DEV_DIR', kind: 'VariableDeclaration'},
				{name: 'LIB_PATH', kind: 'VariableDeclaration'},
				{name: 'LIB_DIR', kind: 'VariableDeclaration'},
				{name: 'CONFIG_PATH', kind: 'VariableDeclaration'},
				{name: 'README_FILENAME', kind: 'VariableDeclaration'},
				{name: 'SVELTEKIT_CONFIG_FILENAME', kind: 'VariableDeclaration'},
				{name: 'VITE_CONFIG_FILENAME', kind: 'VariableDeclaration'},
				{name: 'SVELTEKIT_DEV_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'SVELTEKIT_BUILD_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'SVELTEKIT_DIST_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'NODE_MODULES_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'SVELTEKIT_VITE_CACHE_PATH', kind: 'VariableDeclaration'},
				{name: 'GITHUB_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'GIT_DIRNAME', kind: 'VariableDeclaration'},
				{name: 'TSCONFIG_FILENAME', kind: 'VariableDeclaration'},
				{name: 'Paths', kind: 'InterfaceDeclaration'},
				{name: 'Url', kind: 'VariableDeclaration'},
				{name: 'Email', kind: 'VariableDeclaration'},
				{name: 'SourceId', kind: 'VariableDeclaration'},
				{name: 'BuildId', kind: 'VariableDeclaration'},
				{name: 'create_paths', kind: 'VariableDeclaration'},
				{name: 'paths_from_id', kind: 'VariableDeclaration'},
				{name: 'is_gro_id', kind: 'VariableDeclaration'},
				{name: 'to_root_path', kind: 'VariableDeclaration'},
				{name: 'source_id_to_base_path', kind: 'VariableDeclaration'},
				{name: 'base_path_to_source_id', kind: 'VariableDeclaration'},
				{name: 'lib_path_to_import_id', kind: 'VariableDeclaration'},
				{name: 'import_id_to_lib_path', kind: 'VariableDeclaration'},
				{name: 'to_gro_input_path', kind: 'VariableDeclaration'},
				{name: 'replace_root_dir', kind: 'VariableDeclaration'},
				{name: 'print_path', kind: 'VariableDeclaration'},
				{name: 'print_path_or_gro_path', kind: 'VariableDeclaration'},
				{name: 'replace_extension', kind: 'VariableDeclaration'},
				{name: 'gro_dir_basename', kind: 'VariableDeclaration'},
				{name: 'paths', kind: 'VariableDeclaration'},
				{name: 'is_this_project_gro', kind: 'VariableDeclaration'},
				{name: 'gro_paths', kind: 'VariableDeclaration'},
				{name: 'gro_sveltekit_dist_dir', kind: 'VariableDeclaration'},
			],
		},
		'./plugin.js': {
			path: 'plugin.ts',
			declarations: [
				{name: 'Plugin', kind: 'InterfaceDeclaration'},
				{name: 'CreateConfigPlugins', kind: 'InterfaceDeclaration'},
				{name: 'PluginContext', kind: 'InterfaceDeclaration'},
				{name: 'Plugins', kind: 'ClassDeclaration'},
				{name: 'replace_plugin', kind: 'VariableDeclaration'},
			],
		},
		'./print_task.js': {
			path: 'print_task.ts',
			declarations: [
				{name: 'log_available_tasks', kind: 'VariableDeclaration'},
				{name: 'log_error_reasons', kind: 'VariableDeclaration'},
				{name: 'print_task_help', kind: 'VariableDeclaration'},
			],
		},
		'./publish.task.js': {
			path: 'publish.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./release.task.js': {
			path: 'release.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./resolve_node_specifier.js': {
			path: 'resolve_node_specifier.ts',
			declarations: [
				{name: 'resolve_node_specifier', kind: 'VariableDeclaration'},
				{name: 'ParsedNodeSpecifier', kind: 'InterfaceDeclaration'},
				{name: 'parse_node_specifier', kind: 'VariableDeclaration'},
			],
		},
		'./resolve_specifier.js': {
			path: 'resolve_specifier.ts',
			declarations: [
				{name: 'ResolvedSpecifier', kind: 'InterfaceDeclaration'},
				{name: 'resolve_specifier', kind: 'VariableDeclaration'},
			],
		},
		'./run_gen.js': {
			path: 'run_gen.ts',
			declarations: [
				{name: 'GEN_NO_PROD_MESSAGE', kind: 'VariableDeclaration'},
				{name: 'run_gen', kind: 'VariableDeclaration'},
				{name: 'to_gen_import_path', kind: 'VariableDeclaration'},
				{name: 'to_gen_context_imports', kind: 'VariableDeclaration'},
			],
		},
		'./run_task.js': {
			path: 'run_task.ts',
			declarations: [
				{name: 'RunTaskResult', kind: 'TypeAliasDeclaration'},
				{name: 'run_task', kind: 'VariableDeclaration'},
			],
		},
		'./schema.js': {
			path: 'schema.ts',
			declarations: [
				{name: 'JsonSchema', kind: 'InterfaceDeclaration'},
				{name: 'bundle_schemas', kind: 'VariableDeclaration'},
				{name: 'is_json_schema', kind: 'VariableDeclaration'},
				{name: 'to_json_schema_resolver', kind: 'VariableDeclaration'},
				{name: 'infer_schema_types', kind: 'VariableDeclaration'},
				{name: 'parse_schema_name', kind: 'VariableDeclaration'},
			],
		},
		'./search_fs.js': {
			path: 'search_fs.ts',
			declarations: [
				{name: 'SearchFsOptions', kind: 'InterfaceDeclaration'},
				{name: 'search_fs', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_config.js': {
			path: 'sveltekit_config.ts',
			declarations: [
				{name: 'load_sveltekit_config', kind: 'VariableDeclaration'},
				{name: 'ParsedSveltekitConfig', kind: 'InterfaceDeclaration'},
				{name: 'init_sveltekit_config', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_app_environment.js': {
			path: 'sveltekit_shim_app_environment.ts',
			declarations: [
				{name: 'browser', kind: 'VariableDeclaration'},
				{name: 'building', kind: 'VariableDeclaration'},
				{name: 'dev', kind: 'VariableDeclaration'},
				{name: 'version', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_app_forms.js': {
			path: 'sveltekit_shim_app_forms.ts',
			declarations: [
				{name: 'applyAction', kind: 'VariableDeclaration'},
				{name: 'deserialize', kind: 'VariableDeclaration'},
				{name: 'enhance', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_app_navigation.js': {
			path: 'sveltekit_shim_app_navigation.ts',
			declarations: [
				{name: 'afterNavigate', kind: 'VariableDeclaration'},
				{name: 'beforeNavigate', kind: 'VariableDeclaration'},
				{name: 'disableScrollHandling', kind: 'VariableDeclaration'},
				{name: 'goto', kind: 'VariableDeclaration'},
				{name: 'invalidate', kind: 'VariableDeclaration'},
				{name: 'invalidateAll', kind: 'VariableDeclaration'},
				{name: 'preloadCode', kind: 'VariableDeclaration'},
				{name: 'preloadData', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_app_paths.js': {
			path: 'sveltekit_shim_app_paths.ts',
			declarations: [
				{name: 'assets', kind: 'VariableDeclaration'},
				{name: 'base', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_app_stores.js': {
			path: 'sveltekit_shim_app_stores.ts',
			declarations: [
				{name: 'getStores', kind: 'VariableDeclaration'},
				{name: 'navigating', kind: 'VariableDeclaration'},
				{name: 'page', kind: 'VariableDeclaration'},
				{name: 'updated', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_app.js': {
			path: 'sveltekit_shim_app.ts',
			declarations: [
				{name: 'sveltekit_shim_app_paths_matcher', kind: 'VariableDeclaration'},
				{name: 'sveltekit_shim_app_environment_matcher', kind: 'VariableDeclaration'},
				{name: 'sveltekit_shim_app_specifiers', kind: 'VariableDeclaration'},
				{name: 'render_sveltekit_shim_app_paths', kind: 'VariableDeclaration'},
				{name: 'render_sveltekit_shim_app_environment', kind: 'VariableDeclaration'},
			],
		},
		'./sveltekit_shim_env.js': {
			path: 'sveltekit_shim_env.ts',
			declarations: [{name: 'render_env_shim_module', kind: 'VariableDeclaration'}],
		},
		'./sync.task.js': {
			path: 'sync.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
				{name: 'sveltekit_sync', kind: 'VariableDeclaration'},
			],
		},
		'./task_module.js': {
			path: 'task_module.ts',
			declarations: [
				{name: 'TaskModule', kind: 'InterfaceDeclaration'},
				{name: 'TaskModuleMeta', kind: 'InterfaceDeclaration'},
				{name: 'validate_task_module', kind: 'VariableDeclaration'},
				{name: 'load_task_module', kind: 'VariableDeclaration'},
				{name: 'find_task_modules', kind: 'VariableDeclaration'},
				{name: 'load_task_modules', kind: 'VariableDeclaration'},
			],
		},
		'./task.js': {
			path: 'task.ts',
			declarations: [
				{name: 'Task', kind: 'InterfaceDeclaration'},
				{name: 'TaskContext', kind: 'InterfaceDeclaration'},
				{name: 'TASK_FILE_SUFFIX_TS', kind: 'VariableDeclaration'},
				{name: 'TASK_FILE_SUFFIX_JS', kind: 'VariableDeclaration'},
				{name: 'is_task_path', kind: 'VariableDeclaration'},
				{name: 'to_task_name', kind: 'VariableDeclaration'},
				{name: 'TaskError', kind: 'ClassDeclaration'},
			],
		},
		'./test.task.js': {
			path: 'test.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./throttle.js': {
			path: 'throttle.ts',
			declarations: [{name: 'throttle', kind: 'VariableDeclaration'}],
		},
		'./type_imports.js': {
			path: 'type_imports.ts',
			declarations: [{name: 'normalize_type_imports', kind: 'VariableDeclaration'}],
		},
		'./typecheck.task.js': {
			path: 'typecheck.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./upgrade.task.js': {
			path: 'upgrade.task.ts',
			declarations: [
				{name: 'Args', kind: 'VariableDeclaration'},
				{name: 'task', kind: 'VariableDeclaration'},
			],
		},
		'./watch_dir.js': {
			path: 'watch_dir.ts',
			declarations: [
				{name: 'WatchNodeFs', kind: 'InterfaceDeclaration'},
				{name: 'WatcherChange', kind: 'InterfaceDeclaration'},
				{name: 'WatcherChangeType', kind: 'TypeAliasDeclaration'},
				{name: 'WatcherChangeCallback', kind: 'InterfaceDeclaration'},
				{name: 'Options', kind: 'InterfaceDeclaration'},
				{name: 'watch_dir', kind: 'VariableDeclaration'},
			],
		},
	},
} satisfies PackageJson;
