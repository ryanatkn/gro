import './devtools.js';
import App from './App.svelte';

console.log('hey gro');

// // test bad import
// import '../build/failme.js';

// test bare internal import
import './foo.js';

// test internal import with a simple export
import {bar} from './bar.js';
console.log('bar', bar);

// test internal import from parent directory
import {mix} from '../utils/math.js';
console.log('mix', mix);

// test wildcard internal import
import * as math from '../utils/math.js';
console.log('math', math);
if (mix !== math.mix) throw Error('Expected same module');

// test internal import that has an external import
import {baz} from './baz.js';
console.log('baz', baz);

// test fully qualified external import
import * as motion from 'svelte/motion/index.js';
console.log('imported svelte motion', motion);

// test transitive external import
// import {deepEqual} from '../utils/deepEqual.js';
// console.log('deepEqual', deepEqual({}, {}));

// test dynamic import
import('svelte/store').then((store) => {
	console.log('imported svelte/store', store);
});

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {name: 'gro'},
});

(window as any).app = app;
