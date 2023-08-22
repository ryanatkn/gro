/*

Adapted from https://github.com/changesets/changesets

MIT License

Copyright (c) 2019 Ben Conolly

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

import {
	NewChangesetWithCommit,
	VersionType,
	ChangelogFunctions,
	ModCompWithPackage,
} from '@changesets/types';

const getReleaseLine = async (changeset: NewChangesetWithCommit, _type: VersionType) => {
	const [firstLine, ...futureLines] = changeset.summary.split('\n').map((l) => l.trimRight());

	let returnVal = `- ${changeset.commit ? `${changeset.commit}: ` : ''}${firstLine}`;

	if (futureLines.length > 0) {
		returnVal += `\n${futureLines.map((l) => `  ${l}`).join('\n')}`;
	}

	return returnVal;
};

const getDependencyReleaseLine = async (
	changesets: NewChangesetWithCommit[],
	dependenciesUpdated: ModCompWithPackage[],
) => {
	if (dependenciesUpdated.length === 0) return '';

	const changesetLinks = changesets.map(
		(changeset) => `- Updated dependencies${changeset.commit ? ` [${changeset.commit}]` : ''}`,
	);

	const updatedDependenciesList = dependenciesUpdated.map(
		(dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
	);

	return [...changesetLinks, ...updatedDependenciesList].join('\n');
};

const defaultChangelogFunctions: ChangelogFunctions = {
	getReleaseLine,
	getDependencyReleaseLine,
};

export default defaultChangelogFunctions;
