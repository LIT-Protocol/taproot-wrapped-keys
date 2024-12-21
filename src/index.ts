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
    const signature = await obtainSignature(publicKey);
    console.log("Signature: ", signature);
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

// const litActionCodeFile = fs.readFileSync("./actions/bundled-action.js");
const litActionCodeFile = fs.readFileSync("./actions/taproot-action.js");

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

        const response = await litNodeClient.executeJs({
            sessionSigs: pkpSessionSigs,
            code: litActionCodeFile.toString(),
            jsParams: {
                pkpSessionSigs: pkpSessionSigs,
                method: "createWallet",
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

  obtainSignature(getEnv("PKP_PUBLIC_KEY"));