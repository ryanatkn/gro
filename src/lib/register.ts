import {register} from 'node:module';

console.log(`import.meta.url`, import.meta.url);

register('./loader.js', import.meta.url);
