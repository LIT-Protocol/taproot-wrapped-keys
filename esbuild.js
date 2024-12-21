import { build } from "esbuild";

const run = async () => {
  await build({
    entryPoints: ["./src/actions/taproot-action.js"],
    bundle: true,
    minify: false,
    sourcemap: false,
    outfile: "./actions/bundled-action.js",
    sourceRoot: "./",
    platform: "node",
    metafile: true,
    external: ["ethers"],
    inject: ["esbuild-shims.js", "buffer-shims.js"],
  });
};
run();