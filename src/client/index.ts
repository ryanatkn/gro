import './devtools.js';
import App from './App.svelte';

// TODO remove when we have another import from outside `src/client/`
import {mix} from '../utils/math.js';
console.log('mix', mix);

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {name: 'gro'},
});

(window as any).app = app;
