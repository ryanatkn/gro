<script lang="ts" module>
	export const a = 'ok';

	/* eslint-disable svelte/no-useless-mustaches */
</script>

<script lang="ts">
	interface Props {
		b: string;
	}

	const {b = 'ok'}: Props = $props();

	// `
	// ``
	// ```
	`backticks`;
	('`');
	('``');
	('```');
	`\``;
	`\`\``;
	`\`\`\``;
</script>

Some_Test_Svelte.svelte contents

{a}

{b}

` `` ```
<!-- ` -->
<!-- `` -->
<!-- ``` -->
{`backticks`}
{'`'}
{'``'}
{'```'}
{`\``}
{`\`\``}
{`\`\`\``}
