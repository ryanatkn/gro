# gro/deploy

For now, the [`gro deploy`](/src/deploy.task.ts)
task supports only static deployments to
[GitHub pages](https://pages.github.com/).

```bash
gro deploy # prepare dist/ and commit it to the `deploy` branch, then push to go live
gro deploy --branch my-branch # deploy from `my-branch` instead of the default `main`
gro deploy --dry # prepare dist/ but don't commit or push
gro deploy --clean # if something goes wrong, use this to reset git and gro state
```

See [`src/deploy.task.ts`](/src/deploy.task.ts) for the details.

Eventually we want to expand builtin support,
including servers and other static clouds,
but for now you need to implement `src/deploy.task.ts` yourself outside of GitHub pages.
For a low-tech deploy task example for a VPS server,
see
[`@feltcoop/felt-mockup/src/deploy.task.ts`](https://github.com/feltcoop/felt-mockup/blob/main/src/deploy.task.ts).
(disclaimer: this code was written a while ago in a hurry)
