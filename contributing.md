hey! thanks for your interest in contributing! Welcome, but it's complicated!;;;;

So, Gro is a project that I, a developer of quantity 1, use to support my other work.
Although Gro is a [@feltcoop](https://github.com/feltcoop) project,
I am its only developer for now,
and we have
[more](https://github.com/feltcoop/felt)
[important](https://github.com/feltcoop/felt-server)
[projects](https://github.com/feltcoop/felt.social)
that occupy almost all of our time.

[Gro extends SvelteKit](https://github.com/feltcoop/gro/blob/main/src/docs/sveltekit.md)
with additional things we find useful,
but today it's not a well-designed superset of functionality.
Gro has its own build and publishing systems that are less flexible than they ought to be.
It mostly avoids interfering with SvelteKit, and generally complements it,
but I need to reduce its scope and
[rely more on SvelteKit and Vite](https://github.com/feltcoop/gro/blob/main/src/docs/sveltekit.md).
Gro's unfortunate design qualities are partially due to the fact that
it predates both SvelteKit and the game-changing speed of
[`esbuild`](https://github.com/evanw/esbuild).
Gro uses `esbuild`, but some design decisions were made in a world with slow TypeScript compilation.
So while the goal is to shrink Gro, it'll take time and a lot of thought.
I would absolutely welcome your input!
Please feel invited to open issues or email me, ryan at felt dot social.

Another issue is that Gro doesn't support Windows. That's not great.
It excludes many people out there who don't know what a WSL is.
I have many other things to prioritize,
but I also don't want to promote open source Node projects that don't support Windows.

So Gro sits in a pre-alpha limbo.

All that said: IMO and IME, **if you draw inside its lines, Gro is a good development tool today**.
(I think its task runner alone is worth the dependency, though it's bloated for a task runner)
I am happy to take contributions in any form,
but **please open [issues](https://github.com/feltcoop/gro/issues)**
**before attempting work that you _expect_ to be merged.**
If you're reasonably sure it's an straightforward improvement or don't mind being turned down,
I don't mind if you only send a PR and no issue.

A standard caveat for this kind of toolkit: Gro can't work for everyone's needs and still be Gro.
I'm trying to make it small, flexible, and batteries-included,
which are often at tension with one another.
If it doesn't work for you, I would enjoy discussing why.
Big caveat though, I also can't guarantee that Gro will work for your use cases,
and at times it's I may look inflexible. (it's ok to push back, but please be kind!)
This is why Gro's tagline is:

> opinionated webdev toolkit

It's trying to say "look out for the opinions: it's normal to disagree; MIT".
Gro _is_ more general-purpose than the phrase may suggest,
but SvelteKit and Vite are _actually designed to be_ general-purpose tools.
Please set your expectations accordingly 🐢
I expect we'll see more and more kits tailored
to needs beyond Gro's already-opinionated scope.

> **fun fact**: not every design detail in Gro is an opinion! sometimes it's just an implementation 🐌

In summary, this permissively licensed free software is
[free as in puppy](https://twitter.com/GalaxyKate/status/1371159136684105728),
I guess is what I'm saying.
I hope it's not free as in mattress... that's not the software I want to dump on the world.

I'm always interested in discussing Gro —
open [issues](https://github.com/feltcoop/gro/issues)!
For more you can read about [Gro's current philosophy](/src/docs/philosophy.md).
