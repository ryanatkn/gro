# deploy

The [`gro deploy`](/src/deploy.task.ts)
task was originally designed to support static deployments to
[GitHub pages](https://pages.github.com/),
but what it actually does is just [build](./build.md) and push to a branch.

Importantly, Gro **destructively force pushes** to the `--target` branch, `deploy` by default.
This is because Gro treats your deployment
branch as disposable, able to be deleted or squashed or whatever whenever.
Internally, `gro deploy` uses [git worktree](https://git-scm.com/docs/git-worktree)
for tidiness.

`gro deploy` needs some refactoring to be more generic,
but it works for simple cases beyond "static deployments".
Needs design work for its scope to be clear.

```bash
gro deploy # prepare dist/ and commit it to the `deploy` branch, then push to go live
gro deploy --source my-branch # deploy from `my-branch` instead of the default `main`

# deploy to `custom-deploy-branch` instead of the default `deploy`
# WARNING! this force pushes to the target branch!
gro deploy --target custom-deploy-branch
# the above actually fails because force pushing is destructive, so add `--force` to be extra clear:
gro deploy --target custom-deploy-branch --force
# TODO maybe it should be `--dangerous-target-branch` instead of `--target` and `--force`?

gro deploy --dry # prepare dist/ but don't commit or push
gro deploy --clean # if something goes wrong, use this to reset git and gro state
```

See [`src/deploy.task.ts`](/src/deploy.task.ts) for the details.

For needs more advanced than pushing to a remote branch,
projects can implement a custom `src/deploy.task.ts`.
