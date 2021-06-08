export const render_noscript_section = (source_code_url: string): string => `<noscript>
<section style="display: flex; justify-content: center;">
	<div style="max-width: 300px; padding-right: 10px;">
		<p>
			JavaScript is disabled. If you enable it, fun and surprising
			things could happen!
		</p>
		<p>
			This website tries to respect you and your machines - the
			<a href="${source_code_url}">source code</a>
			is open for inspection and criticism.
		</p>
	</div>
</section>
</noscript>`;

export const render_meta_tags = (): string => `<meta charset="utf-8" />
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, user-scalable=no, shrink-to-fit=no"
/>`;
