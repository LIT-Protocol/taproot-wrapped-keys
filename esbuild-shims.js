// the Lit nodes inject ethers for us, so this fixes SIWE so that it uses the built in ethers provided by the Lit nodes.
import { Buffer } from "buffer";

globalThis.Buffer = Buffer;
globalThis.require = (name) => {
    if (name === "ethers") {
      return ethers;
    }
    else if (name === "buffer") {
      return Buffer;
    }
    throw new Error("unknown module " + name);
};