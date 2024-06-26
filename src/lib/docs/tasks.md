# tasks

> <sub>[gro](/../..) / [lib](..) / [docs](./) / tasks.md</sub>

What is a `Task`? See [`task.md`](./task.md).

## all tasks

- [build](../build.task.ts) - build the project
- [changeset](../changeset.task.ts) - call changeset with gro patterns
- [check](../check.task.ts) - check that everything is ready to commit
- [clean](../clean.task.ts) - remove temporary dev and build files, and optionally prune git branches
- [commit](../commit.task.ts) - commit and push to a new branch
- [deploy](../deploy.task.ts) - deploy to a branch
- [dev](../dev.task.ts) - start SvelteKit and other dev plugins
- [format](../format.task.ts) - format source files
- [gen](../gen.task.ts) - run code generation scripts
- [lint](../lint.task.ts) - run eslint
- [publish](../publish.task.ts) - bump version, publish to npm, and git push
- [reinstall](../reinstall.task.ts) - refreshes package-lock.json with the latest and cleanest deps
- [release](../release.task.ts) - publish and deploy
- [resolve](../resolve.task.ts) - diagnostic that logs resolved filesystem info for the given input paths
- [run](../run.task.ts) - execute a file with the loader, like `node` but works for TypeScript
- [sync](../sync.task.ts) - run `gro gen`, update `package.json`, and optionally `npm i` to sync up
- [test](../test.task.ts) - run tests with uvu
- [typecheck](../typecheck.task.ts) - run tsc on the project without emitting any files
- [upgrade](../upgrade.task.ts) - upgrade deps

## usage

```bash
$ gro some/name
```

> <sub>[gro](/../..) / [lib](..) / [docs](./) / tasks.md</sub>

> <sub>generated by [tasks.gen.md.ts](tasks.gen.md.ts)</sub>
