<script lang="ts">
	import {base} from '$app/paths';
	import Library_Footer from '@ryanatkn/fuz/Library_Footer.svelte';
	import Package_Detail from '@ryanatkn/fuz/Package_Detail.svelte';
	import Package_Summary from '@ryanatkn/fuz/Package_Summary.svelte';
	import Gro_Logo from '@ryanatkn/fuz/Gro_Logo.svelte';
	import {slide} from 'svelte/transition';
	import Hidden_Personal_Links from '@ryanatkn/fuz/Hidden_Personal_Links.svelte';

	import {parse_package_meta} from '$lib/package_meta.js';
	import {package_json, src_json} from '$lib/package.js';

	// TODO add website, rewriting the markdown docs as Svelte

	const pkg = parse_package_meta(package_json, src_json);

	let show_detail = $state(false);
</script>

<main class="box w_100">
	<div class="box width_md">
		<section class="box">
			<h1>gro</h1>
			<a class="panel p_md box mb_xl3" title="source repo" href="https://github.com/ryanatkn/gro">
				<Gro_Logo size="var(--icon_size_lg)" />
			</a>
			<aside>
				This website is a work in progress!<br />
				For now, docs are in
				<a href="https://github.com/ryanatkn/gro">the source repo</a>
			</aside>
		</section>
		<section class="panel mb_lg p_md w_100 relative">
			<button
				type="button"
				class="toggle icon_button"
				title={show_detail ? 'show package summary' : 'show package detail'}
				onclick={() => (show_detail = !show_detail)}
				>{#if show_detail}🪜{:else}🔨{/if}</button
			>
			{#if show_detail}
				<div class="box w_100" transition:slide>
					<Package_Detail {pkg} />
				</div>
			{:else}
				<div class="box" transition:slide>
					<Package_Summary {pkg} />
				</div>
			{/if}
		</section>
		<section>
			<Library_Footer {pkg}>
				{#snippet logo_header()}<a href="{base}/about" class="mb_xs">about</a>{/snippet}
				<Hidden_Personal_Links />
			</Library_Footer>
		</section>
	</div>
</main>

<style>
	main {
		margin-bottom: var(--space_xl5);
	}
	section {
		margin-top: var(--space_xl3);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.toggle {
		position: absolute;
		top: var(--space_sm);
		right: var(--space_sm);
		font-size: var(--size_xl);
		z-index: 1;
	}
</style>
