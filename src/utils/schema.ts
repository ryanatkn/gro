// This is like the ajv `SchemaObject` except that it requires `$id`.
// We may want to loosen this restriction,
// but for now it seems like a convenient way to disambiguate schemas from other objects
// while ensuring they can be registered with ajv and referenced by other schemas.
export interface SchemaObject {
	$id: string;
	[key: string]: unknown;
}

export const isSchema = (value: unknown): value is SchemaObject =>
	!!value && typeof value === 'object' && '$id' in value;
