<script lang="ts">
	import {resolve} from '$app/paths';
	import Docs_Footer from '@ryanatkn/fuz/Docs_Footer.svelte';
	import Package_Detail from '@ryanatkn/fuz/Package_Detail.svelte';
	import Package_Summary from '@ryanatkn/fuz/Package_Summary.svelte';
	import Svg from '@ryanatkn/fuz/Svg.svelte';
	import Card from '@ryanatkn/fuz/Card.svelte';
	import {gro_logo} from '@ryanatkn/fuz/logos.js';
	import {slide} from 'svelte/transition';
	import Hidden_Personal_Links from '@ryanatkn/fuz/Hidden_Personal_Links.svelte';
	import {pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	const pkg = pkg_context.get();

	let show_detail = $state(false);
</script>

<main class="box width_100">
	<div class="box width_upto_md">
		<section class="box">
			<h1>gro</h1>
			<a class="panel p_md box mb_xl3" title="source repo" href="https://github.com/ryanatkn/gro">
				<Svg data={gro_logo} size="var(--icon_size_lg)" />
			</a>
		</section>
		<section>
			<Card href={resolve('/docs')}>docs{#snippet icon()}{pkg.package_json.glyph}{/snippet}</Card>
		</section>
		<section class="panel mb_lg p_md width_100 position_relative">
			<button
				type="button"
				class="toggle icon_button deselectable"
				class:plain={show_detail}
				title={show_detail ? 'show package summary' : 'show package detail'}
				onclick={() => (show_detail = !show_detail)}>🪜</button
			>
			{#if show_detail}
				<div class="box width_100" transition:slide>
					<Package_Detail {pkg} />
				</div>
			{:else}
				<div class="box" transition:slide>
					<Package_Summary {pkg} />
				</div>
			{/if}
		</section>
		<section>
			<Docs_Footer {pkg}>
				{#snippet logo_header()}<a href={resolve('/about')} class="mb_xs">about</a>{/snippet}
				<Hidden_Personal_Links />
			</Docs_Footer>
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
		font-size: var(--font_size_xl);
		z-index: 1;
	}
</style>
