// esbuild.js
import { build } from "esbuild";

build({
    entryPoints: ["./src/actions/taproot-action.js"],
    bundle: true,
    minify: false,
    sourcemap: false,
    outfile: "./actions/bundled-action.js",
    platform: "node",
    metafile: true,
    external: ["ethers"],
    define: {
        'global': 'globalThis',
        'require': 'undefined' // This prevents require calls in the bundled output
    },
    inject: ["esbuild-shims.js"],
    // This ensures all node_modules are bundled
    plugins: [{
        name: 'no-externals',
        setup(build) {
            build.onResolve({ filter: /.*/ }, args => {
                if (args.path === 'ethers') return { external: true };
                return null;
            });
        },
    }],
});