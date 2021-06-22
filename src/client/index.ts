import './devtools.js';
import App from './App.svelte';

// test absolute imports
import {test_absolute_import} from '$lib/test_absolute_import.js';
// import {test_absolute_import} from 'src/lib/test_absolute_import.js';
console.log('devtools test_absolute_import', test_absolute_import);

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {},
});

(window as any).app = app;
