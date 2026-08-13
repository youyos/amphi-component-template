export const DEFAULT_JAVA_CODE = `import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

public class Main {
    public static void main(String[] args) throws Exception {
        System.out.println("Java component is running.");
        if (args.length >= 2) {
            Files.copy(
                Paths.get(args[0]),
                Paths.get(args[1]),
                StandardCopyOption.REPLACE_EXISTING
            );
        }
    }
}`;

function encodeUtf8Base64(value: unknown): string {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function configuredValue(config: any, key: string, fallback = ''): string {
  const value = config?.[key];
  if (value && typeof value === 'object' && 'value' in value) {
    return String(value.value ?? fallback);
  }
  return String(value ?? fallback);
}

export function buildJavaExecutorCode(
  config: any,
  inputName: string,
  outputName: string
): string {
  const sourceMode = configuredValue(config, 'javaSourceMode', 'file');
  const resultMode = configuredValue(config, 'javaResultMode', 'auto');
  const timeoutValue = Number(config?.javaTimeoutSeconds ?? 30);
  const timeoutSeconds = Number.isFinite(timeoutValue)
    ? Math.min(600, Math.max(1, Math.trunc(timeoutValue)))
    : 30;

  const safeSourceMode = sourceMode === 'inline' ? 'inline' : 'file';
  const safeResultMode = ['auto', 'input', 'logs'].includes(resultMode)
    ? resultMode
    : 'auto';
  const encoded = {
    sourcePath: encodeUtf8Base64(
      configuredValue(config, 'javaSourcePath')
    ),
    inlineCode: encodeUtf8Base64(
      configuredValue(config, 'javaInlineCode', DEFAULT_JAVA_CODE)
    ),
    mainClass: encodeUtf8Base64(configuredValue(config, 'javaMainClass')),
    arguments: encodeUtf8Base64(configuredValue(config, 'javaArguments')),
    classpath: encodeUtf8Base64(configuredValue(config, 'javaClasspath')),
    artifactDirectory: encodeUtf8Base64(
      configuredValue(config, 'javaArtifactDirectory')
    ),
    javacCommand: encodeUtf8Base64(
      configuredValue(config, 'javacCommand', 'javac')
    ),
    javaCommand: encodeUtf8Base64(
      configuredValue(config, 'javaCommand', 'java')
    )
  };

  return `
${outputName}, ${outputName}_metrics = run_amphi_java_program(
    dataframe=${inputName},
    source_mode=${JSON.stringify(safeSourceMode)},
    source_path_base64=${JSON.stringify(encoded.sourcePath)},
    inline_code_base64=${JSON.stringify(encoded.inlineCode)},
    main_class_base64=${JSON.stringify(encoded.mainClass)},
    arguments_base64=${JSON.stringify(encoded.arguments)},
    classpath_base64=${JSON.stringify(encoded.classpath)},
    artifact_directory_base64=${JSON.stringify(encoded.artifactDirectory)},
    javac_command_base64=${JSON.stringify(encoded.javacCommand)},
    java_command_base64=${JSON.stringify(encoded.javaCommand)},
    timeout_seconds=${timeoutSeconds},
    result_mode=${JSON.stringify(safeResultMode)}
)
`.trim();
}
