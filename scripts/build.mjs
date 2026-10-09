import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const sourceRoot = new URL("../src/browser/", import.meta.url);
const outputRoot = new URL("../dist/", import.meta.url);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

async function buildDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) {
      await buildDirectory(source);
      continue;
    }
    const relativePath = relative(sourceRoot.pathname, source);
    if (extname(source) === ".ts") {
      const destination = join(outputRoot.pathname, relativePath.replace(/\.ts$/, ".js"));
      await mkdir(dirname(destination), { recursive: true });
      const code = await readFile(source, "utf8");
      await writeFile(destination, stripTypeScriptTypes(code, { mode: "strip" }), "utf8");
    } else {
      const destination = join(outputRoot.pathname, relativePath);
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination);
    }
  }
}

await buildDirectory(sourceRoot.pathname);
