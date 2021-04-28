# gro/deploy

The [`gro deploy`](/src/deploy.task.ts)
task is designed to support static deployments to
[GitHub pages](https://pages.github.com/),
but what it actually does is just push builds to a branch.
It needs some refactoring to be more generic,
but it works for simple cases beyond "static deployments".
Needs more work for its scope to be clear.

```bash
gro deploy # prepare dist/ and commit it to the `deploy` branch, then push to go live
gro deploy --branch my-branch # deploy from `my-branch` instead of the default `main`
gro deploy --dry # prepare dist/ but don't commit or push
gro deploy --clean # if something goes wrong, use this to reset git and gro state
```

See [`src/deploy.task.ts`](/src/deploy.task.ts) for the details.

For needs more advanced than pushing to a remote branch,
you need to implement `src/deploy.task.ts` yourself.
For a low-tech deploy task example for a VPS server, see
[`@feltcoop/felt-mockup/src/deploy.task.ts`](https://github.com/feltcoop/felt-mockup/blob/main/src/deploy.task.ts).
(disclaimer: this code was written a while ago in a hurry)
