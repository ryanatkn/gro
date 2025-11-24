<script lang="ts">
	import type {Snippet} from 'svelte';
	import Docs from '@ryanatkn/fuz/Docs.svelte';
	import {Pkg, pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	import {tomes} from '$routes/docs/tomes.js';
	import {package_json, src_json} from '$routes/package.js';

	interface Props {
		children: Snippet;
	}

	const {children}: Props = $props();

	const pkg = new Pkg(package_json, src_json);
	pkg_context.set(pkg);
</script>

<Docs {tomes} {pkg}>
	{@render children()}
</Docs>
