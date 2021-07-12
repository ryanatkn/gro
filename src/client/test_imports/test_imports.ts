// test lib imports
import {test_absolute_lib_import} from '$lib/test_absolute_lib_import.js';
console.log('test_nested_imports test_absolute_lib_import', test_absolute_lib_import);

// test absolute imports
import {test_absolute_src_import} from 'src/lib/test_absolute_src_import.js';
console.log('test_nested_imports test_absolute_src_import', test_absolute_src_import);

// test external imports
import {tick} from 'svelte';
console.log('test_nested_imports test_external_import', tick);

// // test json imports
import test_json from './test_json.json';
console.log('test_json', test_json);
