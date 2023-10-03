<script lang="ts">
	import {base} from '$app/paths';
	import {parse_package_meta} from '@fuz.dev/fuz_library/package.js';
	import LibraryHeader from '@fuz.dev/fuz_library/LibraryHeader.svelte';
	import LibraryFooter from '@fuz.dev/fuz_library/LibraryFooter.svelte';

	// TODO add website, rewriting the markdown docs as Svelte

	// TODO SvelteKit warns about this but we put `/static` in `/src` because of what it's saying,
	/// maybe change to import as the first item from `packages`
	import package_json from '../static/.well-known/package.json';
	const pkg = parse_package_meta(package_json.homepage, package_json);
</script>

<main class="box width_full">
	<div class="box width_md">
		<section>
			<LibraryHeader {pkg} />
		</section>
		<section class="panel spaced padded_md text_align_center">
			this website is a work in progress!<br />
			<div class="box row spaced">
				for now, docs are in&nbsp;
				<a href="https://github.com/grogarden/gro">the source repo</a>
			</div>
			<!-- TODO put this in the header, icon support (repo.json?) -->
			<a class="panel padded_md box" title="source repo" href="https://github.com/grogarden/gro">
				<img
					alt="a pixelated green oak acorn with a glint of sun"
					src="{base}/favicon.png"
					style:width="var(--icon_size_lg)"
					style:height="var(--icon_size_lg)"
				/>
			</a>
		</section>
		<section>
			<LibraryFooter {pkg} />
		</section>
	</div>
	<div hidden>
		Mastodon verification:
		<a rel="me" href="https://hci.social/@ryanatkn">@ryanatkn@hci.social</a>
	</div>
</main>

<style>
	main {
		margin-bottom: var(--spacing_5);
	}
	section {
		margin-top: var(--spacing_3);
		margin-bottom: var(--spacing_3);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
