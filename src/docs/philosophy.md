# philosophy

> why does gro?

This document describes some of our thinking behind Gro.
Its purpose and scope is specific to Gro and our situation;
it's not something to apply out of context without care.
The context:

1. Gro is a low level tool supporting our other projects
2. our other projects are in their infancy
3. our plan is to sustainably produce software by selling services for these other projects
4. we expect a lot of experimentation and backwards incompatible change while exploring

Some important details might not apply to your projects,
and Gro's philosophy will change over time.

### we want tools that are:

- **specific**: designed for our use cases and workflows; natural fits for the domain
- **sharp**: powerful, efficient, productive, lean, coordinated, wieldy
- **automated**: leverage laziness to its full potential, with wisdom; see prior _point_
- **customizable**: happypath defaults and full control when you need it; hypermodular
- **easy to use**: as internally complex as needed to be simple and powerful externally
- **loved**: tools made by people who _love_ them feel 1) different and 2) better
- **social force multipliers for good**: unlock and inspire ways to create and collaborate
- **human-inspectable**:
  - understanding what our tools are doing should be a holistically designed experience
  - interoperability should be an integrated design quality:
    output tool data in common formats using human-friendly APIs, like JSON to the filesystem,
    and provide userland plugin points for reading/writing data and monitoring behavior
  - two examples of good efforts here include the
    [build system](https://github.com/feltcoop/gro/blob/main/src/docs/unbundled.md)
    and [task resolution and composition](https://github.com/feltcoop/gro/tree/main/src/task)
- **built to evolve and grow for the long run**:
  - patiently search for best-of-all-worlds tradeoffs, or at least better ones
  - pay technical debt sooner rather than later; the evergreen web lets us leave legacy in the past
  - if/when software outlives its usefulness, cede gracefully and help users exit,
    acknowledging we're all people not resources

> Good news! We have perfectly solved all of the above problems
> in a new shiny tool called BulletSilver, or BS for short.

What I mean is, the above are ideals, not a purity test.
We want to maintain a growth mindset, always striving never arriving.

### talk is cheap so here's some more:

- **_respectful software_ is more than free**: it's written for people first,
  and it cares about user health, culture, power consumption, etc,
  including the important things that don't feed the bottom line
- **respect sources of truth**: without authoritatives sources of information,
  you cannot derive data and code with confidence,
  muddying the model of relationships and flow in your emergent system language,
  dashing any hopes of holistic automation
  - we should support patterns for defining sources of truth and
    deriving useful information throughout our systems (e.g. codegen & JSON schema)
  - our tools and meta tools should be the same technologies, so they can feed into each other
- **own the buck, don't pass it**:
  - follow end UX through to DX and take responsibility for every detail and dependency
    (in theory lol)
  - at some point, practically speaking, we have to say
    "below this turtle is a black box I do not have time to understand from the inside"
    and that's ok; we need to be intentional about what we consider a black box and why;
    this is part of the "taking responsibility" in the prior point
  - be smart about taking on dependencies versus re-implementing;
    Gro and Felt lean more towards re-invention but draw a bright line
    around TypeScript, Svelte, Rollup, esbuild,
    any of [@lukeed](https://github.com/lukeed)'s modules, and many other technologies,
    saying "this is the dependency we're standardizing on"
    (this _sometimes_ forces choices on users;
    prefer options when elegant but beware compromising important qualities for flexibility)
- **foster experimentation**: create environments that encourage us to try new things
