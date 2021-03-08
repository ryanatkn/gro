import './devtools.js';
import App from './App.svelte';

const log = console.log.bind(console);

log('hey gro');

// // test bad import
// import '../build/failme.js';

// test bare internal import
import './foo.js';

// test internal import with a simple export
import {bar} from './bar.js';
log('bar', bar);

// test internal import from parent directory
import {mix} from '../utils/math.js';
log('mix', mix);

// test wildcard internal import
import * as math from '../utils/math.js';
log('math', math);
if (mix !== math.mix) throw Error('Expected same module');

// test internal import that has an external import
import {baz} from './baz.js';
log('baz', baz);

// test another transitive external import
import {deepEqual} from '../utils/deepEqual.js';
log('deepEqual', deepEqual({}, {}));

// test fully qualified external import
import * as motion from 'svelte/motion/index.js';
log('imported svelte motion', motion);

// test dynamic import
import('svelte/store').then((store) => {
	log('imported svelte/store', store);
});

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {name: 'gro'},
});

(window as any).app = app;
