import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoin-js/tiny-secp256k1-asmjs";
import { ECPairFactory } from "ecpair";
import { ethers } from "ethers";
import { LIT_ABILITY, LIT_RPC } from "@lit-protocol/constants";
import { EthWalletProvider } from "@lit-protocol/lit-auth-client";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitActionResource, LitPKPResource } from "@lit-protocol/auth-helpers";
import { getEnv } from "../src/utils";
import fs from "fs";

// import { signSchnorr } from "@bitcoinerlab/secp256k1";
// import {
//     AccsDefaultParams,
//     AuthSig,
//     SessionKeySignedMessage,
//     SessionSigsMap,
//   } from '@lit-protocol/types';

const litActionCodeFile = fs.readFileSync("./actions/bundled-action.js");

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const BTC_ENDPOINT = "https://mempool.space/testnet";

async function main() {
    let privateKey;
    privateKey =
        "0x19a3808c69a5a6434d7c16bf34417efe6a9c02da4b17df741ffbf122d9a57eac";
    const publicKey = ethers.utils.computePublicKey(privateKey);
    const destinationAddress =
        "tb1pfgj62z9zdc3mm4we7lhhq06lgvmyalxfac7q7vk4u6qw4rgx49kq2hheus";
    const amountToSend = 20000;
    const fee = 11000;
    const NETWORK = bitcoin.networks.testnet;
    const response = await createTaprootTxn(
        publicKey,
        destinationAddress,
        amountToSend,
        fee,
        NETWORK
    );
    console.log("Response: ", response);
    // const signedTx = await signTaprootTransaction(
    //     privateKey,
    //     response.Transaction,
    //     response.SigHash,
    //     true
    // );
    // console.log("signedTx: ", signedTx);
}

async function createTaprootTxn(
    senderPublicKey: string,
    destinationAddress: string,
    amountToSend: number,
    fee: number,
    network: any
) {
    console.log("🔄 Deriving a BTC Taproot Address from the Private Key...");
    if (senderPublicKey.startsWith("0x") || senderPublicKey.startsWith("0X")) {
        senderPublicKey = senderPublicKey.slice(2);
    }
    const keyPair = ECPair.fromPublicKey(Buffer.from(senderPublicKey, "hex"));
    const pubKey = keyPair.publicKey;
    const xOnlyPubKey = pubKey.slice(1);

    const { address, output } = bitcoin.payments.p2tr({
        pubkey: Buffer.from(xOnlyPubKey),
        network: network,
    });

    const senderAddress = address!;
    console.log("PKP Taproot Address derived: ", address);

    console.log("🔄 Fetching UTXO information...");
    const utxos = await fetch(
        `${BTC_ENDPOINT}/api/address/${senderAddress}/utxo`
    ).then((r) => r.json());
    if (!utxos.length) throw new Error("No UTXOs found");
    console.log("✅ UTXO information fetched");

    console.log("🔄 Creating new Taproot transaction...");
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    tx.addInput(Buffer.from(utxos[0].txid, "hex").reverse(), utxos[0].vout);

    const sendAmount = amountToSend - fee;
    tx.addOutput(
        bitcoin.address.toOutputScript(destinationAddress, network),
        sendAmount
    );

    const hash = tx.hashForWitnessV1(
        0,
        [output!],
        [utxos[0].value],
        bitcoin.Transaction.SIGHASH_DEFAULT
    );
    console.log("✅ Taproot transaction created");
    return { Transaction: tx.toHex(), SigHash: hash };
}

const testLitAction = `
function getFirstSessionSig(pkpSessionSigs) {
    const sessionSigsEntries = Object.entries(pkpSessionSigs);
  
    if (sessionSigsEntries.length === 0) {
      throw new Error(
        \`Invalid pkpSessionSigs, length zero: \${JSON.stringify(pkpSessionSigs)}\`
      );
    }
  
    const [[, sessionSig]] = sessionSigsEntries;
    // console.log(\`Session Sig being used: \${JSON.stringify(sessionSig)}\`);
  
    return sessionSig;
}
function getPkpAddressFromSessionSig(pkpSessionSig) {
    const sessionSignedMessage = JSON.parse(
      pkpSessionSig.signedMessage
    );
  
    const capabilities = sessionSignedMessage.capabilities;
  
    if (!capabilities || capabilities.length === 0) {
      throw new Error(
        \`Capabilities in the session's signedMessage is empty, but required.\`
      );
    }
  
    const delegationAuthSig = capabilities.find(({ algo }) => algo === 'LIT_BLS');
  
    if (!delegationAuthSig) {
      throw new Error(
        'SessionSig is not from a PKP; no LIT_BLS capabilities found'
      );
    }
  
    const pkpAddress = delegationAuthSig.address;
    // console.log(\`pkpAddress to permit decryption: \${pkpAddress}\`);
  
    return pkpAddress;
}

function getPkpAccessControlCondition(pkpAddress) {
  if (!ethers.utils.isAddress(pkpAddress)) {
    throw new Error(
      \`pkpAddress is not a valid Ethereum Address: \${pkpAddress}\`
    );
  }

  return {
    contractAddress: '',
    standardContractType: '',
    chain: "ethereum",
    method: '',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: pkpAddress,
    },
  };
}

const go = async () => {
    try {
        const sessionSig = getFirstSessionSig(pkpSessionSigs);
        const pkpAddress = getPkpAddressFromSessionSig(sessionSig);
        const ACC = getPkpAccessControlCondition(pkpAddress);
        console.log(ACC)
        Lit.Actions.setResponse({response: ACC})
    } catch (error) {
        Lit.Actions.setResponse({response: error.message})
    }
}
go();
`

async function obtainSignature(pkpPublicKey: any) {
    const ETHEREUM_PRIVATE_KEY = getEnv("ETHEREUM_PRIVATE_KEY");
    const litNodeClient = new LitNodeClient({
        litNetwork: "datil-dev",
        debug: false,
    });

    try {
        await litNodeClient.connect();

        const ethersWallet = new ethers.Wallet(
            ETHEREUM_PRIVATE_KEY,
            new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
        );

        const authMethod = await EthWalletProvider.authenticate({
            signer: ethersWallet,
            litNodeClient: litNodeClient,
        });

        const pkpSessionSigs = await litNodeClient.getPkpSessionSigs({
            pkpPublicKey: pkpPublicKey,
            chain: "ethereum",
            authMethods: [authMethod],
            resourceAbilityRequests: [
                {
                    resource: new LitActionResource("*"),
                    ability: LIT_ABILITY.LitActionExecution,
                },
                {
                    resource: new LitPKPResource("*"),
                    ability: LIT_ABILITY.PKPSigning,
                },
            ],
            expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
        });

        // const sessionSig = getFirstSessionSig(pkpSessionSigs);
        // const pkpAddress = getPkpAddressFromSessionSig(sessionSig);
        // const ACC = {
        //     contractAddress: '',
        //     standardContractType: '',
        //     chain: "ethereum",
        //     method: '',
        //     parameters: [':userAddress'],
        //     returnValueTest: {
        //       comparator: '=',
        //       value: pkpAddress,
        //     },
        //   };
        // console.log("response: ", ACC);
        const response = await litNodeClient.executeJs({
            sessionSigs: pkpSessionSigs,
            code: litActionCodeFile.toString(),
            jsParams: {
                pkpSessionSigs: pkpSessionSigs,
                method: "createWallet",
                // pkpPublicKey: pkpPublicKey,
                // dataToSign: dataToSign,
            },
        });
        console.log("Response: ", response);
        return response;
    } catch (error) {
        console.log("Error: ", error);
    } finally {
        await litNodeClient?.disconnect();
    }
}


// export function getFirstSessionSig(pkpSessionSigs: SessionSigsMap): AuthSig {
//     const sessionSigsEntries = Object.entries(pkpSessionSigs);
  
//     if (sessionSigsEntries.length === 0) {
//       throw new Error(
//         `Invalid pkpSessionSigs, length zero: ${JSON.stringify(pkpSessionSigs)}`
//       );
//     }
  
//     const [[, sessionSig]] = sessionSigsEntries;
//     // console.log(`Session Sig being used: ${JSON.stringify(sessionSig)}`);
  
//     return sessionSig;
//   }

// export function getPkpAddressFromSessionSig(pkpSessionSig: AuthSig): string {
//     const sessionSignedMessage: SessionKeySignedMessage = JSON.parse(
//       pkpSessionSig.signedMessage
//     );
  
//     const capabilities = sessionSignedMessage.capabilities;
  
//     if (!capabilities || capabilities.length === 0) {
//       throw new Error(
//         `Capabilities in the session's signedMessage is empty, but required.`
//       );
//     }
  
//     const delegationAuthSig = capabilities.find(({ algo }) => algo === 'LIT_BLS');
  
//     if (!delegationAuthSig) {
//       throw new Error(
//         'SessionSig is not from a PKP; no LIT_BLS capabilities found'
//       );
//     }
  
//     const pkpAddress = delegationAuthSig.address;
//     // console.log(`pkpAddress to permit decryption: ${pkpAddress}`);
  
//     return pkpAddress;
//   }

  obtainSignature(getEnv("PKP_PUBLIC_KEY"));