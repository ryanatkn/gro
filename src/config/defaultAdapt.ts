import type {AdaptBuilds} from './adapt';

// TODO copy dist ? autodetect behavior?

export const defaultAdapt: AdaptBuilds = async () => {
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	console.log('adapt!!');
	return [
		{
			name: 'default-adapter',
			adapt: (ctx) => {
				console.log('adapting!', ctx);
			},
		},
	];
};
