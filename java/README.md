# /java — Shared Java Processing Infrastructure

This directory is the single source of truth for Java-based processing
across every MajixAI sub-directory.  It mirrors the role that
[`/pwa`](../pwa/README.md) plays for Progressive Web App plumbing.

## Files

| Path | Purpose |
|------|---------|
| `src/main/java/ai/majix/JavaCore.java` | Core Java processor (retry pipeline, configurable, extensible) |
| `pom.xml` | Parent Maven POM — inherited by every sub-project |
| `java-runner.js` | Node.js CLI — builds the JAR and invokes it from any directory |
| `template/pom.xml` | Starter POM for a new sub-project |
| `template/ExampleProcessor.java` | Example custom `Processor` implementation |

---

## Quick start — adding Java processing to a new directory

### 1 — Copy the template POM

```bash
cp java/template/pom.xml my-app/pom.xml
```

Edit `my-app/pom.xml`:

- Set `<artifactId>` to a unique slug (e.g. `stock-fetcher`).
- Adjust `<relativePath>` if your sub-directory is more than one level deep.

### 2 — Write your Processor (optional)

If you need custom logic, create a class that implements `JavaCore.Processor`:

```java
// my-app/src/ai/majix/myapp/MyProcessor.java
package ai.majix.myapp;

import ai.majix.JavaCore;
import java.util.Map;

public final class MyProcessor implements JavaCore.Processor {

    @Override
    public void process(JavaCore.Config config, Map<String, Object> context) {
        // Your logic here — results stored in context → written to outputFile
        context.put("result", "42");
    }
}
```

### 3 — Wire it up in a main class or script

```java
import ai.majix.JavaCore;

public class Main {
    public static void main(String[] args) throws Exception {
        JavaCore.Config cfg = new JavaCore.Config.Builder()
            .appId("my-app")
            .dataDir("./my-app/data")
            .outputFile("results.json")
            .processorClass("ai.majix.myapp.MyProcessor")
            .maxRetries(3)
            .build();

        new JavaCore(cfg).run();
    }
}
```

### 4 — Build and run via `java-runner.js`

```bash
# First run (auto-builds JAR if missing):
node java/java-runner.js my-app ./my-app/data results.json

# Force rebuild before running:
node java/java-runner.js --build my-app ./my-app/data results.json
```

### 5 — Or build directly with Maven

```bash
# From the repo root — build just the core JAR:
mvn -f java/pom.xml package

# Run the fat JAR directly:
java -jar java/target/java-core.jar my-app ./my-app/data results.json
```

---

## JavaCore pipeline

Every call to `JavaCore.run()` executes these steps in order:

| Step | What happens |
|------|-------------|
| 1 — Init | Context map created; `appId` and `startTime` added |
| 2 — Dir check | `dataDir` is created if it does not exist |
| 3 — Process | Custom `Processor.process()` called, or built-in default runs |
| 4 — Write output | Context serialised to JSON → `dataDir/outputFile` |
| Retry | Steps 3–4 retried up to `maxRetries` times on any exception |

---

## `Config` reference

All fields are **optional**; sensible defaults are applied by `JavaCore`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `appId` | `String` | `"majixai-app"` | Unique identifier logged with every message |
| `dataDir` | `String` | `"./data"` | Directory for reading inputs and writing output |
| `outputFile` | `String` | `"output.json"` | File name written inside `dataDir` |
| `logLevel` | `LogLevel` | `INFO` | `DEBUG` · `INFO` · `WARN` · `ERROR` |
| `processorClass` | `String` | `null` | Fully-qualified `Processor` implementation; `null` uses built-in default |
| `maxRetries` | `int` | `3` | Times to retry a failed processing step before throwing |
| `timeoutMs` | `long` | `0` | Per-step timeout in milliseconds; `0` disables |

---

## `java-runner.js` CLI reference

```
node java/java-runner.js [--build] [appId] [dataDir] [outputFile]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--build` | off | Force Maven rebuild before running |
| `appId` | `majixai-app` | Passed as first arg to `JavaCore.main()` |
| `dataDir` | `./data` | Passed as second arg |
| `outputFile` | `output.json` | Passed as third arg |

Environment variables honoured:

| Variable | Effect |
|----------|--------|
| `JAVA_HOME` | Overrides the `java` executable path |

---

## Built-in default processor

When no `processorClass` is set, `JavaCore` runs a simple built-in processor:

- Lists every `.json` file found in `dataDir`.
- Stores the count as `jsonFileCount` in the output.
- Useful as a smoke-test that the pipeline is working end-to-end.

---

## Build requirements

| Tool | Minimum version |
|------|----------------|
| Java | 17 |
| Maven | 3.8 |
| Node.js | 14 (for `java-runner.js`) |

---

## Adding a GitHub Actions workflow

To run Java processing on a schedule, create a workflow file
`.github/workflows/my-app-java.yml`:

```yaml
name: my-app Java processing

on:
  schedule:
    - cron: '0 */6 * * *'   # every 6 hours
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Java processor
        run: node java/java-runner.js --build my-app ./my-app/data results.json

      - name: Commit output
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add my-app/data/results.json
          git diff --cached --quiet || git commit -m "data: Update my-app results [skip ci]"
          git push
```
