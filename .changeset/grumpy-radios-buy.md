---
'@grogarden/gro': patch
---

avoid building twice on `gro release`

- if `gro publish` is called before `gro deploy`, we don't need to build to deploy
