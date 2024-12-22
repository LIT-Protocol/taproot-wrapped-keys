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

const PKP_PUBLIC_KEY = getEnv("PKP_PUBLIC_KEY");
const LIT_ACTION = fs.readFileSync("./actions/taproot-action.js");

// createWallet();
createAndSignTxn()

async function createWallet() {
    let params = {
        method: "createWallet",
    };
    const response = await executeJsHandler(PKP_PUBLIC_KEY, params);

    // @ts-ignore
    const parsedResponse = JSON.parse(response?.response);

    const publicKey = parsedResponse.publicKey;
    const ciphertext = parsedResponse.ciphertext;
    const dataHash = parsedResponse.dataToEncryptHash;

    console.log("Public Key:", publicKey);
    console.log("Ciphertext:", ciphertext);
    console.log("Data Hash:", dataHash);
}

async function createAndSignTxn() {
    const publicKey =
        "0x04b5051e04e8e6eb40a312d61913f35e92692738d3507ed6118618b7d1e33d6aa58813cd196caa20ff65af1e38c4860ebdb2d63c1f7d2bd93c6df9e18ce4c97667";
    const destinationAddress =
        "tb1pfgj62z9zdc3mm4we7lhhq06lgvmyalxfac7q7vk4u6qw4rgx49kq2hheus";
    const amountToSend = 8000;
    const fee = 3000;
    const NETWORK = bitcoin.networks.testnet;

    const txnResponse = await createTaprootTxn(
        publicKey,
        destinationAddress,
        amountToSend,
        fee,
        NETWORK
    );
    console.log("Transactions Response: ", txnResponse);

    const ciphertext =
        "pUoTkA1EhOm1sR190B41dwVFt7rT8RRTs0teKF3yH+GUDvx2dKuxBXAO7CZ7bcDuhfBQiwwzvMBGv4D2gY6gz1xo0I4maXPuQH+NcFskxDxHhgWf5PU2SSz3sYCKrYkBCPdh8YAg1uJC1487VOMk05IknejtcEPH7fpZP0wPNs3h5pPMIPI7+QSgueWSYuDQSCHDGkNwd/gC";
    const dataToEncryptHash =
        "62c97ef37c50131b33c3a225f76fcc813d0bd198bb5f53a2b52de796034b09f9";
    const broadcast = true;

    const signResponse = await obtainSignature(
        ciphertext,
        dataToEncryptHash,
        txnResponse.Transaction,
        txnResponse.SigHash,
        broadcast
    );
    console.log("Signature Response: ", signResponse);
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
    return { Transaction: tx.toHex(), SigHash: hash.toString('hex') };
}

async function obtainSignature(
    ciphertext: string,
    dataToEncryptHash: string,
    transactionHex: string,
    sigHash: string,
    broadcast: boolean
) {
    let params = {
        method: "signTaprootTxn",
        ciphertext,
        dataToEncryptHash,
        transactionHex,
        sigHash,
        broadcast,
    };
    const response = await executeJsHandler(PKP_PUBLIC_KEY, params);
    return response;
}

async function executeJsHandler(pkpPublicKey: string, params: Object) {
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
            code: LIT_ACTION.toString(),
            jsParams: {
                ...params,
                pkpSessionSigs,
            },
        });

        return response;
    } catch (error) {
        console.log("Error: ", error);
    } finally {
        await litNodeClient?.disconnect();
    }
}
