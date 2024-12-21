bitcoin.initEccLib(ecc);

const signTaprootTransaction = async (
    PRIVATE_KEY,
    TRANSACTION_HEX,
    SIGHASH,
    BROADCAST
) => {
    const BTC_ENDPOINT = "https://mempool.space/testnet";

    if (PRIVATE_KEY.startsWith("0x") || PRIVATE_KEY.startsWith("0X")) {
        PRIVATE_KEY = PRIVATE_KEY.slice(2);
    }
    console.log("🔄 Signing the transaction");
    const TRANSACTION = bitcoin.Transaction.fromHex(TRANSACTION_HEX);

    const signature = Buffer.from(
        signSchnorr(SIGHASH, Buffer.from(PRIVATE_KEY, "hex"))
    );
    TRANSACTION.setWitness(0, [signature]);
    console.log("✅ Taproot transaction signed");

    console.log("🔄 Broadcasting transaction...");
    const signedTx = TRANSACTION.toHex();
    console.log("signedTx: ", signedTx);

    let response = signedTx;

    if (BROADCAST == true) {
        const broadcastResponse = await fetch(`${BTC_ENDPOINT}/api/tx`, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: signedTx,
        });
        const txid = await broadcastResponse.text();
        console.log(
            `✅ Transaction broadcast successfully. TXID: ${BTC_ENDPOINT}/tx/${txid}`
        );
        response = txid;
    }
    return response;
};

const encryptData = async (privateKey, accessControlConditions) => {
    const { ciphertext, dataToEncryptHash } = await Lit.Actions.encrypt({
        accessControlConditions: [accessControlConditions],
        to_encrypt: new TextEncoder().encode(privateKey),
    });

    return { ciphertext, dataToEncryptHash };
};

const decryptData = async (
    accessControlConditions,
    _ciphertext,
    _dataToEncryptHash
) => {
    const decryptedData = await Lit.Actions.decryptToSingleNode({
        accessControlConditions: [accessControlConditions],
        ciphertext: _ciphertext,
        dataToEncryptHash: _dataToEncryptHash,
        authSig: null,
        chain: "ethereum",
    });
    console.log("decryptedData: ", decryptedData.slice(2));

    return decryptedData.slice(2);
};

function getFirstSessionSig(pkpSessionSigs) {
    const sessionSigsEntries = Object.entries(pkpSessionSigs);

    if (sessionSigsEntries.length === 0) {
        throw new Error(
            `Invalid pkpSessionSigs, length zero: ${JSON.stringify(
                pkpSessionSigs
            )}`
        );
    }

    const [[, sessionSig]] = sessionSigsEntries;

    return sessionSig;
}
function getPkpAddressFromSessionSig(pkpSessionSig) {
    const sessionSignedMessage = JSON.parse(pkpSessionSig.signedMessage);

    const capabilities = sessionSignedMessage.capabilities;

    if (!capabilities || capabilities.length === 0) {
        throw new Error(
            `Capabilities in the session's signedMessage is empty, but required.`
        );
    }

    const delegationAuthSig = capabilities.find(
        ({ algo }) => algo === "LIT_BLS"
    );

    if (!delegationAuthSig) {
        throw new Error(
            "SessionSig is not from a PKP; no LIT_BLS capabilities found"
        );
    }

    const pkpAddress = delegationAuthSig.address;
    console.log(`pkpAddress to permit decryption: ${pkpAddress}`);

    return pkpAddress;
}

function getPkpAccessControlCondition(pkpAddress) {
    if (!ethers.utils.isAddress(pkpAddress)) {
        throw new Error(
            `pkpAddress is not a valid Ethereum Address: ${pkpAddress}`
        );
    }

    return {
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [":userAddress"],
        returnValueTest: {
            comparator: "=",
            value: pkpAddress,
        },
    };
}

/**
 * Main execution function that handles Taproot wallet creation and transaction signing through a PKP
 * @async
 * @function go
 */

/**
 * Creates a new wallet and encrypts it within the action
 * @async
 * @method createWallet
 * @param {Object} pkpSessionSigs - Session signatures for PKP authentication
 * @returns {Object} Object containing:
 *   - publicKey: The wallet's public key
 *   - ciphertext: The encrypted wallet data
 *   - dataToEncryptHash: Hash of the encrypted data
 */

/**
 * Signs a taproot transaction
 * @async
 * @method signTaprootTxn
 * @param {string} ciphertext - The encrypted wallet data
 * @param {string} dataToEncryptHash - Hash of the encrypted data
 * @param {string} transactionHex - Transaction data in hexadecimal format
 * @param {string} sigHash - Signature hash type
 * @param {boolean} broadcast - Whether to broadcast the transaction
 * @returns {Object} Decrypted data response
 */
const go = async () => {
    try {
        if (method === "createWallet") {
            const sessionSig = getFirstSessionSig(pkpSessionSigs);
            const pkpAddress = getPkpAddressFromSessionSig(sessionSig);
            const ACC = getPkpAccessControlCondition(pkpAddress);
            const wallet = ethers.Wallet.createRandom();
            const publicKey = wallet.publicKey;
            const privateKey = wallet.privateKey;
            const encryptedData = await encryptData(
                privateKey,
                ACC
            );
            const response = { publicKey, ...encryptedData };
            console.log("response: ", response);
            Lit.Actions.setResponse({ response: JSON.stringify({ response }) });
        } else if (method === "signTaprootTxn") {
            const sessionSig = getFirstSessionSig(pkpSessionSigs);
            const pkpAddress = getPkpAddressFromSessionSig(sessionSig);
            const ACC = getPkpAccessControlCondition(pkpAddress);
            const decryptedData = await decryptData(
                ACC,
                ciphertext,
                dataToEncryptHash
            );
            const response = decryptedData;
            console.log("response: ", response);
            // signTaprootTransaction(decryptedData, transactionHex, sigHash, broadcast);
            Lit.Actions.setResponse({ response: JSON.stringify({ response }) });
        }
    } catch (error) {
        Lit.Actions.setResponse({ response: error.message });
    }
};
go();
