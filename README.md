# BTC Taproot Wrapped Keys Example

This code example demonstrates how to create a BTC Taproot KeyPair and sign a transaction with it within a Lit's Trusted Execution Environment (TEE). This a custom wrapped keys implementation to perfrom Non-ECDSA
compatabile Schnorr signatures within a Lit Action.

## Prerequisites

- **An Ethereum private key**
  - This private key will be used to:
    - Own the PKP we mint.
    - In order to pay for requests to Lit Network, the corresponding Ethereum account must have Lit Test Tokens. If you do not have any, you can get some from [the faucet](https://chronicle-yellowstone-faucet.getlit.dev/).

- **BTC Wallet**
  - We will use this to fund the newly created wallet and use as a destnation address for this example. You can use any wallet provider for testnets like Unisat. Make sure to have some balance in this, here's its [faucet](https://coinfaucet.eu/en/btc-testnet/)
    
- **BTC Endpoint**
    - We will use this
      - To fetch UTXOs for creating transactions
      - For broadcasting transactions from inside of a Lit Action
     
- **Node.js and NPM**
    - Please have these installed before running the example.

## Installation and Setup

1. Clone the repository
3. Install the dependencies: `npm i`
4. Create and fill in the `.env` file: `cp .env.example .env`
    -  **Required**:
        - `ETHEREUM_PRIVATE_KEY`: This is the Ethereum private key that will be used to mint a PKP
        - `NETWORK`, `BTC_ENDPOINT`, `DESTINATION_ADDRESS`, `AMOUNT_TO_SEND`, `FEE`, `BROADCAST`: BTC transaction variables which specify transaction details as well the btc network

## Executing the Example

Here's an overview of how the code example works:
1. Specify `ETHEREUM_PRIVATE_KEY` in the environment with some funds on Chronicle Yellowstons
2. Run `npm run pkp` to create a pkp which will be owning the wrapped keypair
3. Specify `PKP_PUBLIC_KEY` in the environment
4. Run `npm run create` to create a new Taproot Keypair inside of a Lit Action and encrypt its private key to only be decrypted with PKPs session signatures which created it
5. Specify `WK_PUBLIC_KEY`, `CIPHERTEXT`, `DATA_TO_ENCRYPT_HASH` returned by last command in the environment
6. Fund the `WK_PUBLIC_KEY` address with some amount (`AMOUNT_TO_SEND` + `FEE`) so it gets some UTXOs and is able to sign and send transactions
7. Run `npm run txn` to create a Taproot transaction and send it to the Lit Action for signing it. Here the sender is the newly generated public key and receiver is your defined `DESTINATION_ADDRESS`. Lit Action will also broadcast the transaction as defined in `BROADCAST` variable
8. 
