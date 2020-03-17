import {Gen} from '../gen.js';

export const gen: Gen = () => {
	const fieldValue = 1;
	return [
		{
			contents: `export interface Data { field: ${typeof fieldValue} }`,
			fileName: 'testMultiTypes.ts',
			outputToSource: true,
		},
		{contents: `{"field": ${fieldValue}}`, fileName: 'testMultiData.json'},
	];
};
