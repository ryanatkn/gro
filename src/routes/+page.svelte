<script lang="ts">
	import {base} from '$app/paths';
	import Library_Footer from '@ryanatkn/fuz/Library_Footer.svelte';
	import Package_Detail from '@ryanatkn/fuz/Package_Detail.svelte';
	import Package_Summary from '@ryanatkn/fuz/Package_Summary.svelte';
	import {slide} from 'svelte/transition';

	import {parse_package_meta} from '$lib/package_meta.js';
	import {package_json, src_json} from '$lib/package.js';

	// TODO add website, rewriting the markdown docs as Svelte

	const pkg = parse_package_meta(package_json.homepage, package_json, src_json);

	let show_detail = false;
</script>

<main class="box w_100">
	<div class="box width_md">
		<section class="prose box">
			<h1>gro</h1>
			<a class="panel p_md box" title="source repo" href="https://github.com/ryanatkn/gro">
				<img
					alt="a pixelated green oak acorn with a glint of sun"
					src="{base}/favicon.png"
					style:width="var(--icon_size_lg)"
					style:height="var(--icon_size_lg)"
				/>
			</a>
		</section>
		<section class="panel mb_lg p_md text_align_center">
			this website is a work in progress!<br />
			<div class="box row mb_lg">
				for now, docs are in&nbsp;
				<a href="https://github.com/ryanatkn/gro">the source repo</a>
			</div>
		</section>
		<section class="panel mb_lg p_md w_100 relative">
			<button
				class="toggle icon_button"
				title={show_detail ? 'show package summary' : 'show package detail'}
				on:click={() => (show_detail = !show_detail)}
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
		<section class="box">
			<a href="{base}/about" class="chip">about</a>
		</section>
		<section>
			<Library_Footer {pkg} />
		</section>
	</div>
	<div hidden>
		Mastodon verification:
		<a rel="me" href="https://hci.social/@ryanatkn">@ryanatkn@hci.social</a>
	</div>
</main>

<style>
	main {
		margin-bottom: var(--space_xl5);
	}
	section {
		margin-top: var(--space_xl3);
		margin-bottom: var(--space_xl3);
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
