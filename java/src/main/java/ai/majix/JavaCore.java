package ai.majix;

// ai/majix/JavaCore.java  —  Shared Java Processing Core for MajixAI
//
// Usage from any sub-project:
//
//   import ai.majix.JavaCore;
//
//   JavaCore core = new JavaCore(JAVA_CONFIG);
//   core.run();
//
// JAVA_CONFIG fields (all optional):
//
//   appId          {String}
//     Unique identifier for the calling application.
//     default: "majixai-app"
//
//   dataDir        {String}
//     Path to the data directory for reading/writing files.
//     default: "./data"
//
//   outputFile     {String}
//     File name where results are written.
//     default: "output.json"
//
//   logLevel       "DEBUG" | "INFO" | "WARN" | "ERROR"
//     Verbosity of console logging.
//     default: "INFO"
//
//   processorClass {String}
//     Fully-qualified class name of a custom Processor implementation.
//     When provided, JavaCore delegates the main processing step to it.
//     default: null  (built-in DefaultProcessor is used)
//
//   maxRetries     {int}
//     Number of times to retry a failed processing step before aborting.
//     default: 3
//
//   timeoutMs      {long}
//     Milliseconds before a single processing step is cancelled.
//     0 disables the timeout.
//     default: 0
//
// Quick start:
//   See README.md and template/pom.xml for how to wire JavaCore into a
//   new sub-project directory.

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Central Java processing hub for MajixAI.
 *
 * <p>JavaCore is the single shared entry point for all Java-based processing
 * tasks across every sub-directory in the MajixAI repository.  Sub-projects
 * configure it via a {@link Config} object, then call {@link #run()} to
 * execute their pipeline.</p>
 *
 * <p>The class is intentionally free of third-party dependencies so that it
 * can be dropped into any project that already uses the parent Maven POM
 * (see {@code pom.xml}).</p>
 */
public final class JavaCore {

    // -----------------------------------------------------------------------
    //  Inner types
    // -----------------------------------------------------------------------

    /** Log-level constants mirroring {@link java.util.logging.Level}. */
    public enum LogLevel { DEBUG, INFO, WARN, ERROR }

    /**
     * Immutable configuration passed to {@link JavaCore}.
     *
     * <p>Use the nested {@link Builder} for a readable construction API:</p>
     * <pre>{@code
     * JavaCore.Config cfg = new JavaCore.Config.Builder()
     *     .appId("my-app")
     *     .dataDir("./data")
     *     .outputFile("results.json")
     *     .logLevel(JavaCore.LogLevel.DEBUG)
     *     .maxRetries(5)
     *     .timeoutMs(10_000L)
     *     .build();
     * }</pre>
     */
    public static final class Config {

        public final String   appId;
        public final String   dataDir;
        public final String   outputFile;
        public final LogLevel logLevel;
        public final String   processorClass;
        public final int      maxRetries;
        public final long     timeoutMs;

        private Config(Builder b) {
            this.appId          = b.appId;
            this.dataDir        = b.dataDir;
            this.outputFile     = b.outputFile;
            this.logLevel       = b.logLevel;
            this.processorClass = b.processorClass;
            this.maxRetries     = b.maxRetries;
            this.timeoutMs      = b.timeoutMs;
        }

        /** Builder for {@link Config}. */
        public static final class Builder {
            private String   appId          = "majixai-app";
            private String   dataDir        = "./data";
            private String   outputFile     = "output.json";
            private LogLevel logLevel       = LogLevel.INFO;
            private String   processorClass = null;
            private int      maxRetries     = 3;
            private long     timeoutMs      = 0L;

            public Builder appId(String v)          { this.appId          = Objects.requireNonNull(v); return this; }
            public Builder dataDir(String v)         { this.dataDir        = Objects.requireNonNull(v); return this; }
            public Builder outputFile(String v)      { this.outputFile     = Objects.requireNonNull(v); return this; }
            public Builder logLevel(LogLevel v)      { this.logLevel       = Objects.requireNonNull(v); return this; }
            public Builder processorClass(String v)  { this.processorClass = v;                         return this; }
            public Builder maxRetries(int v)         { this.maxRetries     = v;                         return this; }
            public Builder timeoutMs(long v)         { this.timeoutMs      = v;                         return this; }

            public Config build() { return new Config(this); }
        }
    }

    /**
     * Extension point for sub-projects that need custom processing logic.
     *
     * <p>Implement this interface in your sub-project, then pass the
     * fully-qualified class name to {@link Config.Builder#processorClass}.</p>
     */
    public interface Processor {
        /**
         * Execute the custom processing step.
         *
         * @param config   the active {@link Config}
         * @param context  mutable key/value map shared between pipeline steps
         * @throws Exception on any processing error
         */
        void process(Config config, Map<String, Object> context) throws Exception;
    }

    // -----------------------------------------------------------------------
    //  State
    // -----------------------------------------------------------------------

    private static final Logger LOG = Logger.getLogger(JavaCore.class.getName());

    private final Config config;

    // -----------------------------------------------------------------------
    //  Construction
    // -----------------------------------------------------------------------

    /**
     * Constructs a new {@code JavaCore} with the supplied configuration.
     *
     * @param config non-null {@link Config}
     */
    public JavaCore(Config config) {
        this.config = Objects.requireNonNull(config, "config must not be null");
        configureLogger(config.logLevel);
    }

    // -----------------------------------------------------------------------
    //  Public API
    // -----------------------------------------------------------------------

    /**
     * Executes the full processing pipeline:
     * <ol>
     *   <li>Initialise the context map.</li>
     *   <li>Ensure the output directory exists.</li>
     *   <li>Delegate to the configured {@link Processor} (or built-in default).</li>
     *   <li>Write results to {@code outputFile} as JSON.</li>
     * </ol>
     *
     * <p>Retries up to {@link Config#maxRetries} times on failure.</p>
     *
     * @throws JavaCoreException if all retry attempts are exhausted
     */
    public void run() throws JavaCoreException {
        log(LogLevel.INFO, "JavaCore starting — appId=" + config.appId);

        Map<String, Object> context = new HashMap<>();
        context.put("appId",     config.appId);
        context.put("startTime", Instant.now().toString());

        ensureOutputDir();

        Exception lastError = null;
        for (int attempt = 1; attempt <= Math.max(1, config.maxRetries); attempt++) {
            try {
                runOnce(context);
                writeOutput(context);
                log(LogLevel.INFO, "JavaCore finished — appId=" + config.appId);
                return;
            } catch (Exception e) {
                lastError = e;
                log(LogLevel.WARN, "Attempt " + attempt + "/" + config.maxRetries
                        + " failed: " + e.getMessage());
            }
        }

        throw new JavaCoreException("All " + config.maxRetries
                + " attempts failed for appId=" + config.appId, lastError);
    }

    // -----------------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------------

    private void runOnce(Map<String, Object> context) throws Exception {
        if (config.processorClass != null && !config.processorClass.isEmpty()) {
            Processor p = loadProcessor(config.processorClass);
            p.process(config, context);
        } else {
            defaultProcess(config, context);
        }
    }

    /**
     * Built-in processor: reads every {@code .json} file in {@code dataDir},
     * counts them, and stores the count in the context.
     */
    private static void defaultProcess(Config config, Map<String, Object> context) throws IOException {
        Path dir = Paths.get(config.dataDir);
        long fileCount = 0;
        if (Files.isDirectory(dir)) {
            try (var stream = Files.list(dir)) {
                fileCount = stream
                        .filter(p -> p.toString().endsWith(".json"))
                        .count();
            }
        }
        context.put("jsonFileCount", fileCount);
        context.put("dataDir",       config.dataDir);
    }

    private void writeOutput(Map<String, Object> context) throws IOException {
        Path outPath = Paths.get(config.dataDir, config.outputFile);
        ensureDirectory(outPath.getParent());

        StringBuilder sb = new StringBuilder("{\n");
        context.put("endTime", Instant.now().toString());
        int i = 0;
        for (Map.Entry<String, Object> e : context.entrySet()) {
            sb.append("  \"").append(e.getKey()).append("\": \"")
              .append(String.valueOf(e.getValue()).replace("\"", "\\\""))
              .append("\"");
            if (++i < context.size()) sb.append(",");
            sb.append("\n");
        }
        sb.append("}");

        Files.writeString(outPath, sb.toString(), StandardCharsets.UTF_8);
        log(LogLevel.INFO, "Output written → " + outPath);
    }

    private void ensureOutputDir() {
        ensureDirectory(Paths.get(config.dataDir));
    }

    private static void ensureDirectory(Path dir) {
        if (dir != null && !Files.exists(dir)) {
            try {
                Files.createDirectories(dir);
            } catch (IOException e) {
                LOG.warning("Could not create directory: " + dir + " — " + e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static Processor loadProcessor(String className) throws Exception {
        Class<?> cls = Class.forName(className);
        if (!Processor.class.isAssignableFrom(cls)) {
            throw new IllegalArgumentException(
                    className + " does not implement ai.majix.JavaCore.Processor");
        }
        return (Processor) cls.getDeclaredConstructor().newInstance();
    }

    private void log(LogLevel level, String msg) {
        if (level.ordinal() < config.logLevel.ordinal()) return;
        Level jLevel = switch (level) {
            case DEBUG -> Level.FINE;
            case INFO  -> Level.INFO;
            case WARN  -> Level.WARNING;
            case ERROR -> Level.SEVERE;
        };
        LOG.log(jLevel, "[JavaCore][{0}] {1}", new Object[]{ config.appId, msg });
    }

    private static void configureLogger(LogLevel level) {
        Level jLevel = switch (level) {
            case DEBUG -> Level.FINE;
            case INFO  -> Level.INFO;
            case WARN  -> Level.WARNING;
            case ERROR -> Level.SEVERE;
        };
        LOG.setLevel(jLevel);
    }

    // -----------------------------------------------------------------------
    //  Checked exception
    // -----------------------------------------------------------------------

    /** Thrown when all retry attempts in {@link #run()} have been exhausted. */
    public static final class JavaCoreException extends Exception {
        public JavaCoreException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    // -----------------------------------------------------------------------
    //  CLI entry-point (for direct `java -jar` usage)
    // -----------------------------------------------------------------------

    /**
     * CLI entry-point.
     *
     * <pre>
     * java -jar java/target/java-core.jar [appId] [dataDir] [outputFile]
     * </pre>
     *
     * @param args optional positional arguments: appId, dataDir, outputFile
     */
    public static void main(String[] args) {
        Config.Builder builder = new Config.Builder();
        if (args.length > 0) builder.appId(args[0]);
        if (args.length > 1) builder.dataDir(args[1]);
        if (args.length > 2) builder.outputFile(args[2]);

        JavaCore core = new JavaCore(builder.build());
        try {
            core.run();
        } catch (JavaCoreException e) {
            LOG.severe("JavaCore failed: " + e.getMessage());
            System.exit(1);
        }
    }
}
