# AGENTS.md

## Repository purpose

This repository contains 75 production zero-code algorithm components in five
Amphi sidebar groups and remains a reusable source template for additional Amphi
components running inside JupyterLab.

Supported runtime range:

- Python >= 3.11, including Python 3.13
- JupyterLab >= 4.3.4, < 5
- jupyterlab-amphi >= 0.9.0, < 1
- TypeScript 5.8

Components are delivered through a companion prebuilt JupyterLab extension.
Do not modify Amphi's official `@amphi/*` extension directories.

The local build toolchain currently uses JupyterLab 4.4.10 and
jupyterlab-amphi 0.9.7. Do not turn those verified build versions into exact
runtime checks unless an actual incompatibility is demonstrated.

## Repository structure

```text
src/
  index.ts                       Component registration entry point
  AlgorithmComponents.tsx       Shared specialized-component class and forms
  algorithmCatalog.ts           75 ids, names, categories and descriptions
  algorithmIcons.ts             75 unique name-based SVG icons
  algorithmParameters.ts        Per-algorithm form parameters and output names
  algorithmRuntime.ts           Shared embedded Python algorithm dispatcher
  pythonLiteral.ts              Python-safe option serialization
  JavaExecutorComponent.tsx     Java source/inline execution component
  javaExecutorCode.ts           Java component Python-call generation
  javaRuntime.ts                Embedded javac/java subprocess runtime
  AmphiComponentTemplate.tsx     Reusable component implementation template
scripts/
  validate_embedded_python.py    Embedded Python and Amphi compatibility check
  test_generated_component_code.mjs
                                  Generated Python option serialization test
  test_algorithm_runtime.py      All 75 algorithms runtime test
  test_csv_pipeline.py           Real CSV classification/regression test
  test_java_runtime.py           Real javac/java compile and execution test
  test_script_report_runtime.py  Script, chart and document-report runtime test
  build-and-install.sh           Local build and installation workflow
  package-release.sh             Portable release archive workflow
packaging/
  install.sh                     Target-machine installer
  README-发布包.md                  Release-package instructions
docs/
  Amphi组件开发速查.md              Short Chinese development guide
  75种零代码算法组件.md             Component catalog and usage guide
  多语言与文档报告组件.md           Script, chart and report usage guide
  模型评估与管理组件.md             Evaluation and model lifecycle guide
  50种零代码图表组件.md             50-chart component catalog and guide
  分析计算组件.md                 Analytical calculation component guide
packages/
  amphi-ai14-components/         Independent @local-ai/amphi-ai14-components extension
    src/
      index.ts                   Registration entry for nine components
      ModelEvaluationComponents.tsx Five evaluations and lifecycle nodes
      modelEvaluationCode.ts     Safe generated evaluation/model calls
      modelEvaluationRuntime.ts  Embedded metrics and model artifact runtime
    scripts/                     Independent build, install and release scripts
    packaging/                   Portable installer and release instructions
  amphi-ai22-components/         Independent @local-ai/amphi-ai22-components extension
    src/
      index.ts                   Registration entry for 50 chart components
      ChartComponents.tsx        Shared chart component class and forms
      chartCatalog.ts            Unified group and 50 chart definitions
      chartIcons.ts              Unique name-based SVG icons
      chartCode.ts               Safe generated chart calls
      chartRuntime.ts            Self-contained HTML/SVG renderer
    scripts/                     Independent build, install and release scripts
    packaging/                   Portable installer and release instructions
  amphi-ai24-components/         Independent @local-ai/amphi-ai24-components extension
    src/
      index.ts                   Registration entry for 19 analysis components
      AnalysisComponents.tsx     Shared specialized forms and component class
      analysisCatalog.ts         Unified group and 19 analysis definitions
      analysisIcons.ts           Unique name-based SVG icons
      analysisCode.ts            Base64-safe generated analysis calls
      analysisRuntime.ts         Embedded calculation and modeling runtime
    scripts/                     Independent build, install and release scripts
    packaging/                   Portable installer and release instructions
  amphi-ai27-components/         Independent @local-ai/amphi-ai27-components extension
    src/
      index.ts                   Registration entry for seven components
      ScriptReportComponents.tsx Unified "平台扩展组件" definitions
      scriptReportCode.ts        Safe generated script/report calls
      scriptReportRuntime.ts     Embedded script/chart/report Python runtime
      ReportDesignerPanel.ts     Template editor and report download sidebar
    scripts/                     Independent build, install and release scripts
    packaging/                   Portable installer and release instructions
README.md                        Full development documentation
```

Generated directories such as `node_modules/`, `lib/`, `labextension/`,
`dist/`, `.yarn/cache/` and `__pycache__/` must not be committed.

## Required workflow for an algorithm component

1. Add a globally unique id, Chinese name, category, kind and description to
   `algorithmCatalog.ts`.
2. Add algorithm-specific fields to `algorithmParameters.ts`. Do not expose a
   generic "complexity parameter" when the algorithm has named parameters.
3. Keep result-column naming automatic and algorithm-specific. Do not require
   users to type a prediction/output column name.
4. Add a unique, name-based SVG abbreviation to `algorithmIcons.ts`; duplicate
   icon names or identical SVG sources are not allowed.
5. Implement the actual parameter behavior in `algorithmRuntime.ts`; a form
   field that is ignored by Python is not complete.
6. Keep reusable preprocessing, validation and metrics code shared rather than
   copying the whole embedded Python function.
7. Ensure the catalog id is the id passed to `super()` and registered by
   `index.ts`.
8. Add or update representative runtime and generated-code tests.
9. Add Python runtime dependencies to the requirements documentation.
10. Run all validation, runtime, build and package checks before completion.

For a non-catalog component with substantially different ports or behavior,
copy `AmphiComponentTemplate.tsx`, keep the traditional `super()`/registration
ids identical, and register it with a dynamic import.

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

TypeScript-generated values must also be valid Python literals. In particular,
JavaScript `true`, `false` and `null` are invalid Python. Use the helpers in
`pythonLiteral.ts`, and run `test_generated_component_code.mjs`.

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
- The exact Python invocation generated from each component's default form
  values.
- All catalog ids having specialized parameter definitions.
- All catalog ids having unique icon names and unique SVG sources.

## Validation commands

From the repository root:

```bash
python scripts/validate_embedded_python.py
jlpm run build:lib
node scripts/test_generated_component_code.mjs
python scripts/test_algorithm_runtime.py
python scripts/test_csv_pipeline.py
jupyter labextension build --development True .
```

`test_generated_component_code.mjs` runs against compiled `lib/`, so compile
TypeScript before running it when sources changed.

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
@local-ai/amphi-custom-components vX.Y.Z enabled OK
```

The JupyterLab server must then be restarted and the browser hard-refreshed.

For a portable, prebuilt release:

```bash
./scripts/package-release.sh
```

Then extract the archive into a temporary directory and run its installer in
check-only mode before delivery:

```bash
./install.sh --check /absolute/path/to/python-venv
./install.sh --check --user --python /absolute/path/to/python3
```

## Package and installation rules

- Keep custom package names under the `@local-ai/*` npm scope.
- Keep `package.json` name and installation directory consistent.
- Install into the same Python environment that launches JupyterLab.
- Virtual-environment installation directory:

```text
<python-data-dir>/share/jupyter/labextensions/@local-ai/<package-name>/
```

- Without a virtual environment, use `install.sh --user`; it installs under the
  current user's Jupyter data directory and should not require `sudo`.
- When multiple Python installations exist, use
  `--python /absolute/path/to/python3` and choose the Python that launches
  JupyterLab.
- `package.json` and `static/` must be directly inside that directory.
- Back up an existing installed version outside `labextensions/`, under
  `labextension-backups/`. Backups inside `labextensions/` are incorrectly
  discovered as duplicate extensions.
- Do not write custom files into an official `@amphi/*` package.
- Build with `--development True` for the pinned local toolchain unless the
  production builder has been separately verified.
- Keep `@jupyterlab/application` runtime metadata compatible with
  `>=4.3.4 <5`; the exact local builder version belongs in `devDependencies`.

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
4. All 75 runtime tests and the realistic CSV pipeline test pass.
5. Generated option literals for all catalog components pass.
6. `jupyter labextension list` reports `enabled OK`.
7. The component automatically appears in the expected Amphi category after a
   clean JupyterLab restart.
8. Result DataFrame columns, model variables and metrics are verified.
9. Source and usage documentation are updated.
10. A distributable update has a bumped version, `.tar.gz`, matching SHA-256
    file, and passes extraction plus `install.sh --check`.
