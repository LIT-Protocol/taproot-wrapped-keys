// Direct imports
// const bitcoin = require("bitcoinjs-lib");
// const ecc = require("@bitcoin-js/tiny-secp256k1-asmjs");
// const { signSchnorr } = require("@bitcoinerlab/secp256k1");
// const { Buffer } = require("buffer");
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoin-js/tiny-secp256k1-asmjs";
import { signSchnorr } from "@bitcoinerlab/secp256k1";
import { Buffer } from "buffer";

// Global assignments
globalThis.Buffer = Buffer;
globalThis.bitcoin = bitcoin;
globalThis.ecc = ecc;
globalThis.signSchnorr = signSchnorr;

// Require shim
globalThis.require = (name) => {
  switch(name) {
    case "bitcoinjs-lib": return bitcoin;
    case "@bitcoin-js/tiny-secp256k1-asmjs": return ecc;
    case "@bitcoinerlab/secp256k1": return { signSchnorr };
    case "buffer": return { Buffer };
    case "ethers": return ethers;
    default: throw new Error(`Module ${name} not found`);
  }
};