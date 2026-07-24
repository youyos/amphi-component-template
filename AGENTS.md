# AGENTS.md

## Repository purpose

This repository is a reusable source template for developing built-in,
zero-code components for Amphi running inside JupyterLab.

Target environment:

- Python 3.11
- JupyterLab 4.4.10
- jupyterlab-amphi 0.9.7
- TypeScript 5.8

Components are delivered through a companion prebuilt JupyterLab extension.
Do not modify Amphi's official `@amphi/*` extension directories.

## Repository structure

```text
src/
  index.ts                     Component registration entry point
  AmphiComponentTemplate.tsx   Reusable component implementation template
scripts/
  validate_embedded_python.py  Embedded Python and Amphi compatibility check
  build-and-install.sh         Build and installation workflow
docs/
  Amphi组件开发速查.md            Short Chinese development guide
README.md                      Full development documentation
```

Generated directories such as `node_modules/`, `lib/`, `labextension/`,
`.yarn/cache/` and `__pycache__/` must not be committed.

## Required workflow for a new component

1. Copy `src/AmphiComponentTemplate.tsx` to a clearly named component file.
2. Give the component a globally unique id.
3. Keep the id passed to `super()` identical to the id registered in
   `src/index.ts`.
4. Define defaults and form fields with matching configuration keys.
5. Put reusable Python functions in `provideFunctions()`.
6. Generate only the final function invocation in `generateComponentCode()`.
7. Register the component with a dynamic import in `componentDefinitions`.
8. Add Python runtime dependencies to the requirements documentation.
9. Run all validation and build commands before reporting completion.

## Amphi component conventions

Use the correct component type:

| Scenario | Component type |
|---|---|
| Data source | `pandas_df_input` |
| Classification, regression, clustering or transform | `pandas_df_processor` |
| Two DataFrame inputs | `pandas_df_double_processor` |
| Multiple DataFrame inputs | `pandas_df_multi_processor` |
| Data export | `pandas_df_output` |

For a standard `pandas_df_processor`,
`generateComponentCode()` receives:

```ts
{ config, inputName, outputName }
```

The generated Python should assign its resulting DataFrame to `outputName`.
Modeling components should additionally expose model and metrics variables:

```python
output, output_model, output_metrics = run_algorithm(...)
```

## Critical embedded Python compatibility rule

Amphi 0.9.7 applies `formatVariables()` to generated Python code. It converts
ordinary quoted strings containing curly braces into f-strings.

Never use these patterns inside embedded Python:

```python
"Missing columns: {}".format(missing)
"Invalid feature: {!r}".format(feature)
```

Use percent formatting instead:

```python
"Missing columns: %s" % missing
"Invalid feature: %r" % feature
```

Python dictionaries may use curly braces normally.

Every change to an embedded `String.raw` Python block must pass:

```bash
python scripts/validate_embedded_python.py
```

Do not bypass or remove this validation.

## Data and modeling requirements

Machine-learning components should:

- Accept a pandas DataFrame and validate its type.
- Validate selected target and feature columns.
- Handle missing numeric and categorical values explicitly.
- Avoid mutating the input DataFrame in place.
- Use a configurable, deterministic random seed where randomness is involved.
- Handle small datasets and insufficient target classes with clear errors.
- Preserve rows with missing targets as scoring rows where appropriate.
- Use unambiguous output column prefixes.
- Return useful metrics such as row counts, accuracy, F1 or algorithm-specific
  diagnostics.
- Expose the fitted model when a model is trained.
- Avoid silent overwriting of important source columns.

Tests should include:

- Numeric and categorical features.
- Missing feature values.
- Missing target values where scoring is supported.
- Binary or multiclass targets as appropriate.
- Small-sample and invalid-column error paths.
- Deterministic output for a fixed random seed.

## Validation commands

From the repository root:

```bash
python scripts/validate_embedded_python.py
jlpm run build:lib
jupyter labextension build --development True .
```

For the complete installation workflow:

```bash
./scripts/build-and-install.sh /absolute/path/to/python-venv
```

After installation, verify:

```bash
/absolute/path/to/python-venv/bin/jupyter labextension list
```

Expected result:

```text
@local/amphi-custom-components vX.Y.Z enabled OK
```

The JupyterLab server must then be restarted and the browser hard-refreshed.

## Package and installation rules

- Keep custom package names under the `@local/*` npm scope.
- Keep `package.json` name and installation directory consistent.
- Install into the same Python environment that launches JupyterLab.
- The installation directory is:

```text
<python-data-dir>/share/jupyter/labextensions/@local/<package-name>/
```

- `package.json` and `static/` must be directly inside that directory.
- Back up an existing installed version before replacing it.
- Do not write custom files into an official `@amphi/*` package.
- Build with `--development True` for the pinned local toolchain unless the
  production builder has been separately verified.

## Change discipline

- Preserve unrelated user changes.
- Do not commit generated build products or dependency directories.
- Update documentation when component ids, package names, dependencies or
  build commands change.
- Bump the package version for every installed or distributed update.
- Keep source files focused; share common Python or TypeScript helpers instead
  of duplicating large implementations.
- Use clear Chinese labels and tooltips for user-facing Amphi forms.

## Completion criteria

A component task is complete only when:

1. Embedded Python validation passes after simulating Amphi formatting.
2. TypeScript compilation passes.
3. The prebuilt JupyterLab extension builds successfully.
4. `jupyter labextension list` reports `enabled OK`.
5. The component automatically appears in the expected Amphi category after a
   clean JupyterLab restart.
6. A realistic CSV-driven pipeline executes successfully.
7. Result DataFrame columns, model variables and metrics are verified.
8. Source and usage documentation are updated.
