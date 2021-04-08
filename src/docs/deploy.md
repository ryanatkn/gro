# gro/deploy

For now, Gro's `gro deploy` task supports only static deployments to
[GitHub pages](https://pages.github.com/).
Eventually we want to expand builtin support,
including servers and other static clouds,
but for now you need to implement `src/deploy.task.ts` yourself outside of GitHub pages.

```bash
gro deploy # prepare dist/ and commit it to the `deploy` branch, then push to deploy
gro deploy --branch my-branch # deploy from a branch other than `main`
gro deploy --dry # prepare dist/ but don't commit or push
gro deploy --clean # if something goes wrong, use this to reset git and gro state
```

See [`src/deploy.task.ts`](/src/deploy.task.ts) for the details.
