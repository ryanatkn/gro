import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {parse_imports} from './parse_imports.js';

test('parse js imports', () => {
	const parsed = parse_imports(
		'a.js',
		`
      const a = 5;
      import {foo} from 'static_import';
      await import('dynamic_import');
      const b = {};
    `,
	);
	assert.equal(parsed, ['static_import', 'dynamic_import']);
});

test('parse ts imports', () => {
	const parsed = parse_imports(
		'a.ts',
		`
      const a: 5 = 5;
      type A = 123;
      interface B {
        b: 456;
      }
      import {foo} from 'static_import';
      await import('dynamic_import');
      const b: {} = {};
      export type {G} from 'exported_import';
    `,
	);
	assert.equal(parsed, ['static_import', 'dynamic_import', 'exported_import']);
});

// TODO BLOCK include inline `type` import test case (not `import type {foo` but `import {type foo`)

test('parse ts imports and omit types', () => {
	const parsed = parse_imports(
		'a.ts',
		`
      import type {foo} from 'static_import';
      await import('dynamic_import');
    `,
	);
	assert.equal(parsed, ['dynamic_import']);
});

test('parse ts imports and include types', () => {
	const parsed = parse_imports(
		'a.ts',
		`
      import type {foo} from 'static_import';
      await import('dynamic_import');
    `,
		false,
	);
	assert.equal(parsed, ['static_import', 'dynamic_import']);
});

test('parse svelte imports', () => {
	const parsed = parse_imports(
		'a.svelte',
		`
      000

      <!-- TS module script -->
      <script lang="ts" module>
        const a2: 5 = 5;
        import {foo2} from 'static_import_module_context';
        await import('dynamic_import_module_context');
        const b2: {} = {};
      </script>
      
      111
      
      <!-- TS script -->
      <script lang="ts">
        const a: 5 = 5;
        import {foo} from 'static_import';
        await import('dynamic_import');
        const b: {} = {};
      </script>
      
      222
    `,
	);
	assert.equal(parsed, [
		'static_import_module_context',
		'dynamic_import_module_context',
		'static_import',
		'dynamic_import',
	]);
});

test('parse plain JS svelte imports', () => {
	const parsed = parse_imports(
		'a.svelte',
		`
      <script>
        const a = 5;
        import {foo3} from 'static_import';
        await import('dynamic_import');
        const b3 = {};
      </script>
    `,
	);
	assert.equal(parsed, ['static_import', 'dynamic_import']);
});

test('parse empty imports', () => {
	const parsed = parse_imports(
		'a.ts',
		`
      const a: 5 = 5;
      type A = 123;
      interface B {
        b: 456;
      }
      import {foo} from '';
      await import('');
      const b: {} = {};
    `,
	);
	assert.equal(parsed, []);
});

test.run();
