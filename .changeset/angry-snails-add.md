---
'@ryanatkn/gro': minor
---

remove ts-morph dep and use the ts API instead

- add `typescript^5` peer dep
- merge `svelte_helpers.ts` into `constants.ts`
- add default declarations:
  - new: `'./package.json': {path: 'package.json', declarations: [{name: 'default', kind: 'json'}]},`
  - old: `'./package.json': {path: 'package.json', declarations: []},`
- add `parse_exports.ts`
- add `Src_Module_Declaration_Kind`
