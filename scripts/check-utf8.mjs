import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetDirs = ["app", "components", "lib", "docs", "scripts"];
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".sql",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".txt",
  ".ps1",
]);

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const mojibakeRegex = /Ã[\u0080-\u024F]|Â[\u0080-\u024F]|â[\u0080-\u024F]{1,2}/;
const failedFiles = [];

function shouldSkip(fullPath) {
  return (
    fullPath.includes(`${path.sep}.git${path.sep}`) ||
    fullPath.includes(`${path.sep}.next${path.sep}`) ||
    fullPath.includes(`${path.sep}node_modules${path.sep}`) ||
    fullPath.includes(`${path.sep}public${path.sep}uploads${path.sep}`)
  );
}

function visitDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (shouldSkip(fullPath)) continue;

    if (entry.isDirectory()) {
      visitDir(fullPath);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    const isDotEnv = entry.name.toLowerCase().startsWith(".env");
    if (!textExtensions.has(ext) && !isDotEnv) continue;

    try {
      const bytes = fs.readFileSync(fullPath);
      const text = utf8Decoder.decode(bytes);

      if (text.includes("\uFFFD")) {
        failedFiles.push(`${fullPath} -> possui caractere de substituição (�)`);
        continue;
      }

      if (mojibakeRegex.test(text)) {
        failedFiles.push(`${fullPath} -> possível texto corrompido (mojibake)`);
      }
    } catch {
      failedFiles.push(`${fullPath} -> não está em UTF-8 válido`);
    }
  }
}

for (const relative of targetDirs) {
  visitDir(path.join(root, relative));
}

if (failedFiles.length > 0) {
  console.error("Falha na verificação de UTF-8. Arquivos com problema:");
  for (const file of failedFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("UTF-8 OK: nenhum problema encontrado.");
