import {init, parse} from 'es-module-lexer';

await init;

const parsed_js = parse(`
  const a = 5;
  import {foo} from 'bar';
  await import('baz');
  const b = {};
`);

console.log(`parsed_js`, parsed_js);

const parsed_ts = parse(`
  const a: 5 = 5;
  type A = 123;
  interface B {
    b: 456;
  }
  import {foo} from 'bar';
  await import('baz');
  const b: {} = {};
  export type {G} from './g';
`);

console.log(`parsed_ts`, parsed_ts);

// TODO BLOCK svelte regexp extractor? get from Svelte
const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;
const all_script_matches = `
<script lang="ts" context="module">
  const a2: 5 = 5;
  import {foo2} from 'bar2';
  await import('baz2');
  const b2: {} = {};
</script>

abc

<script lang="ts">
  const a: 5 = 5;
  import {foo} from 'bar';
  await import('baz');
  const b: {} = {};
</script>

efg

<script>
  const a = 5;
  import {foo3} from 'bar3';
  await import('baz3');
  const b3 = {};
</script>

hij
`.matchAll(script_matcher);
// console.log(`all_script_matches`, Array.from(all_script_matches).length);
for (const matches of all_script_matches) {
	const e = matches[1];
	console.log(`e`, e);
	const parsed_svelte = parse(e);
	console.log(`parsed_svelte`, parsed_svelte);
}
