import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {init_lexer, parse_imports} from './parse_imports.js';

await init_lexer();

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
    export type {G} from './g';
  `,
	);
	assert.equal(parsed, ['static_import', 'dynamic_import']);
});

test('parse svelte imports', () => {
	const parsed = parse_imports(
		'a.svelte',
		`
      <script lang="ts" context="module">
        const a2: 5 = 5;
        import {foo2} from 'static_import2';
        await import('dynamic_import2');
        const b2: {} = {};
      </script>
      
      abc
      
      <script lang="ts">
        const a: 5 = 5;
        import {foo} from 'static_import';
        await import('dynamic_import');
        const b: {} = {};
      </script>
      
      efg
      
      <script>
        const a = 5;
        import {foo3} from 'static_import3';
        await import('dynamic_import3');
        const b3 = {};
      </script>
      
      hij
  `,
	);
	assert.equal(parsed, [
		'static_import2',
		'dynamic_import2',
		'static_import',
		'dynamic_import',
		'static_import3',
		'dynamic_import3',
	]);
});

test.run();
