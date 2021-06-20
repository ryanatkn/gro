export interface Build_Dependency {
	readonly specifier: string;
	readonly mapped_specifier: string;
	readonly build_id: string;
	readonly external: boolean;
}

// The optional properties in the following serialized types
// are not `readonly` in order to simplify object creation.
export interface Serialized_Build_Dependency {
	readonly specifier: string;
	mapped_specifier?: string; // `undefined` implies same as `specifier`
	build_id?: string; // `undefined` implies same as `specifier`
	external?: boolean; // `undefined` implies `false`
}

export const deserialize_build_dependency = ({
	specifier,
	mapped_specifier,
	build_id,
	external,
}: Serialized_Build_Dependency): Build_Dependency => ({
	specifier,
	mapped_specifier: mapped_specifier !== undefined ? mapped_specifier : specifier,
	build_id: build_id !== undefined ? build_id : specifier,
	external: external !== undefined ? external : false,
});

export const serialize_build_dependency = ({
	specifier,
	mapped_specifier,
	build_id,
	external,
}: Build_Dependency): Serialized_Build_Dependency => {
	const serialized: Serialized_Build_Dependency = {specifier};
	if (mapped_specifier !== specifier) {
		serialized.mapped_specifier = mapped_specifier;
	}
	if (build_id !== specifier) {
		serialized.build_id = build_id;
	}
	if (external) {
		serialized.external = external;
	}
	return serialized;
};
