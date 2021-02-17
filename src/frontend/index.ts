import './devtools.js';
import App from './App.svelte';

// // test a bad import
// import '../build/failme.js';

// test a bare internal import
import './foo.js';

// test an internal import with a simple export
import {bar} from './bar.js';
console.log('bar', bar);

// test internal import from parent directory
import {mix} from '../utils/math.js';
console.log('mix', mix);

// test wildcard internal import
import * as math from '../utils/math.js';
console.log('math', math);
if (mix !== math.mix) throw Error('Expected same module');

// test an internal import that has an external import
import {baz} from './baz.js';
console.log('baz', baz);

console.log('hey');

// test fully qualified external import
import * as motion from 'svelte/motion/index.js';
console.log('imported svelte motion', motion);

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
