// test lib imports
import {testAbsoluteLibImport} from '$lib/testAbsoluteLibImport.js';
console.log('testNestedImports testAbsoluteLibImport', testAbsoluteLibImport);

// test absolute imports
import {testAbsoluteSrcImport} from 'src/lib/testAbsoluteSrcImport.js';
console.log('testNestedImports testAbsoluteSrcImport', testAbsoluteSrcImport);

// test external imports
import {tick} from 'svelte';
console.log('testNestedImports testExternalImport', tick);

// // test json imports
import testJson from './testJson.json';
console.log('testJson', testJson);

// test js imports
import {js} from './testJs.js';
console.log('testJs', js);
