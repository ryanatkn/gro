# Moss Plugin to Gen Migration

This demonstrates converting `gro_plugin_moss` from a Plugin to a Gen file, leveraging the improved Filer with lazy initialization.

## Key Improvements

### Performance Characteristics

**Plugin System (gro_plugin_moss.ts):**

- Filer runs continuously during development
- Persistent memory usage for file watching
- Complex lifecycle management (setup/teardown)
- Throttling/debouncing needed for performance

**Gen System (moss.gen.css.ts):**

- Filer initialized only when gen runs (lazy init)
- Shared filer instance across all gen files in single run
- Automatic cleanup after generation completes
- No persistent memory overhead between runs

### Architecture Benefits

1. **Simpler Code**: No plugin lifecycle, just a gen function
2. **Better Integration**: Works with `gro gen --check` in CI
3. **Standalone Usage**: Can run `gro gen src/routes/moss.gen.css.ts`
4. **Automatic Watch**: gro_plugin_gen handles file watching and triggers regeneration

## File Statistics Example

When running `gro gen src/routes/moss.gen.css.ts`:

```
Total files in filer: 665
- External dependencies: 489
- Internal project files: 176
  - Files matching filter: 124
  - Files with CSS classes: 3
  - Unique classes found: 15
```

## Migration Steps

1. Create `moss.gen.css.ts` with Gen function
2. Use `filer.init()` for lazy initialization
3. Process files from in-memory graph (no file system reads)
4. Generate CSS and return formatted content
5. Remove plugin from gro.config.ts (once ready)

## Usage

```bash
# Generate once
gro gen src/routes/moss.gen.css.ts

# Check in CI (fails if output would change)
gro gen --check

# Watch mode (via gro_plugin_gen)
gro dev
```

## Implementation Notes

- The filer ownership pattern ensures proper cleanup
- `invoke_task` creates filer if not provided
- Filer is shared across all gen files in single run
- Only the owner closes the filer after completion

This migration demonstrates how the gen system with lazy filer initialization provides better performance and simpler architecture than the plugin system for code generation tasks.
