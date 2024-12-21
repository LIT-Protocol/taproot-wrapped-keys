// esbuild.js
import { build } from "esbuild";

build({
    entryPoints: ["./src/actions/taproot-action.js"],
    bundle: true,
    format: "iife", // This ensures everything is bundled into a self-contained file
    globalName: "LitAction", // Gives a name to the IIFE
    minify: false,
    sourcemap: false,
    outfile: "./actions/bundled-action.js",
    platform: "browser", // Change to browser since we're running in Lit's environment
    target: ["es2020"],
    metafile: true,
    external: ["ethers"], // Keep ethers external since it's provided by Lit
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

// esbuild-shims.js
globalThis.Buffer = globalThis.Buffer || (() => {
    const { Buffer } = require('buffer/');
    return Buffer;
})();

// Add any other necessary global shims here
globalThis.process = globalThis.process || {
    env: { NODE_ENV: 'production' }
};