import type {BuildId} from '../path/paths.js';

export interface BuildDependency {
	readonly specifier: string;
	readonly mapped_specifier: string;
	readonly original_specifier: string;
	readonly build_id: BuildId;
	readonly external: boolean;
}

// The optional properties in the following serialized types
// are not `readonly` in order to simplify object creation.
export interface SerializedBuildDependency {
	readonly specifier: string;
	mapped_specifier?: string; // `undefined` implies same as `specifier`
	original_specifier?: string; // `undefined` implies same as `specifier`
	build_id?: BuildId; // `undefined` implies same as `specifier`
	external?: boolean; // `undefined` implies `false`
}

export const deserialize_build_dependency = ({
	specifier,
	mapped_specifier,
	original_specifier,
	build_id,
	external,
}: SerializedBuildDependency): BuildDependency => ({
	specifier,
	mapped_specifier: mapped_specifier !== undefined ? mapped_specifier : specifier,
	original_specifier: original_specifier !== undefined ? original_specifier : specifier,
	build_id: build_id !== undefined ? build_id : specifier,
	external: external !== undefined ? external : false,
});

export const serialize_build_dependency = ({
	specifier,
	mapped_specifier,
	original_specifier,
	build_id,
	external,
}: BuildDependency): SerializedBuildDependency => {
	const serialized: SerializedBuildDependency = {specifier};
	if (mapped_specifier !== specifier) {
		serialized.mapped_specifier = mapped_specifier;
	}
	if (original_specifier !== specifier) {
		serialized.original_specifier = original_specifier;
	}
	if (build_id !== specifier) {
		serialized.build_id = build_id;
	}
	if (external) {
		serialized.external = external;
	}
	return serialized;
};
