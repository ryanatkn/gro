import {Gen} from '../gen.js';

export const gen: Gen = () => {
	const fieldValue = 1;
	return [
		{contents: `export const data = {field: ${fieldValue}};`},
		{
			contents: `export interface Data { field: ${typeof fieldValue} }`,
			fileName: 'testMultiNewDir/testMultiTypes.ts',
		},
		{
			contents: `{"field": ${fieldValue}}`,
			fileName: '../testMultiData.json',
		},
	];
};
