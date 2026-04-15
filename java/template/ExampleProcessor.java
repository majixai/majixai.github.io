package ai.majix.example;

import ai.majix.JavaCore;
import java.util.Map;

/**
 * Example sub-project processor showing how to plug a custom
 * {@link JavaCore.Processor} into the shared pipeline.
 *
 * <p>Configure via {@code JavaCore.Config.Builder#processorClass}:</p>
 * <pre>{@code
 * JavaCore.Config cfg = new JavaCore.Config.Builder()
 *     .appId("example")
 *     .processorClass("ai.majix.example.ExampleProcessor")
 *     .build();
 * new JavaCore(cfg).run();
 * }</pre>
 */
public final class ExampleProcessor implements JavaCore.Processor {

    @Override
    public void process(JavaCore.Config config, Map<String, Object> context) {
        // Place any custom processing logic here.
        // Values stored in `context` are written to outputFile as JSON.
        context.put("message",  "Hello from ExampleProcessor!");
        context.put("appId",     config.appId);
        context.put("dataDir",   config.dataDir);
        context.put("processed", "true");
    }
}
