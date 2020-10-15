export const importTs = (path: string): Promise<unknown> => {
	console.log('import typescript...', path);
	return import(path);
};
