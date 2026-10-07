import esbuild from "esbuild";
import { builtinModules } from "node:module";

const watch = process.argv.includes("--watch");
const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  bundle: true,
  format: "cjs",
  target: "es2022",
  platform: "browser",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
});
if (watch) await ctx.watch();
else {
  await ctx.rebuild();
  await ctx.dispose();
}
