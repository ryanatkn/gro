import Ajv, {type Options, type ValidateFunction, type SchemaObject} from 'ajv';

let ajvInstance: Ajv | null = null;

export const ajv = (opts?: Options): Ajv => {
	if (ajvInstance) return ajvInstance;
	ajvInstance = new Ajv(opts);
	ajvInstance.addKeyword('tsType').addKeyword('tsImport');
	return ajvInstance;
};

export interface CreateValidate<T = unknown> {
	(): ValidateFunction<T>;
}

const validators: Map<SchemaObject, ValidateFunction> = new Map();

// Memoizes the returned schema validation function in the module-level lookup `validators`.
// Does not support multiple instantiations with different options.
export const validateSchema = <T>(schema: SchemaObject): ValidateFunction<T> =>
	toValidateSchema<T>(schema)();

// Creates a lazily-compiled schema validation function to avoid wasteful compilation.
// It's also faster than ajv's internal compiled schema cache
// because we can assume a consistent environment.
export const toValidateSchema = <T>(schema: SchemaObject): CreateValidate<T> => {
	let validate = validators.get(schema) as ValidateFunction<T> | undefined;
	return () => {
		if (validate) return validate;
		validate = ajv().compile(schema);
		validators.set(schema, validate);
		return validate;
	};
};
