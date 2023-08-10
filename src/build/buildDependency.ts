import type {BuildId} from '../paths.js';

export interface BuildDependency {
	readonly specifier: string;
	readonly mappedSpecifier: string;
	readonly originalSpecifier: string;
	readonly buildId: BuildId;
	readonly external: boolean;
}

// The optional properties in the following serialized types
// are not `readonly` in order to simplify object creation.
export interface SerializedBuildDependency {
	readonly specifier: string;
	mappedSpecifier?: string; // `undefined` implies same as `specifier`
	originalSpecifier?: string; // `undefined` implies same as `specifier`
	buildId?: string; // `undefined` implies same as `specifier`
	external?: boolean; // `undefined` implies `false`
}

export const deserializeBuildDependency = ({
	specifier,
	mappedSpecifier,
	originalSpecifier,
	buildId,
	external,
}: SerializedBuildDependency): BuildDependency => ({
	specifier,
	mappedSpecifier: mappedSpecifier !== undefined ? mappedSpecifier : specifier,
	originalSpecifier: originalSpecifier !== undefined ? originalSpecifier : specifier,
	buildId: buildId !== undefined ? buildId : specifier,
	external: external !== undefined ? external : false,
});

export const serializeBuildDependency = ({
	specifier,
	mappedSpecifier,
	originalSpecifier,
	buildId,
	external,
}: BuildDependency): SerializedBuildDependency => {
	const serialized: SerializedBuildDependency = {specifier};
	if (mappedSpecifier !== specifier) {
		serialized.mappedSpecifier = mappedSpecifier;
	}
	if (originalSpecifier !== specifier) {
		serialized.originalSpecifier = originalSpecifier;
	}
	if (buildId !== specifier) {
		serialized.buildId = buildId;
	}
	if (external) {
		serialized.external = external;
	}
	return serialized;
};
