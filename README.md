This repo contains all boiler plate for a absolutely minimalistic TypeScript/anchor client.

```$ git clone https://github.com/CarlTornberg/solana-ts-client```

```$ cd solana-ts-client```

```$ ts-node main.ts```

------------

Instructions for a completely blank project:

CREATE STRUCTURE:
* ```$ mkdir folder```
* ```$ cd folder```
* ```$ touch main.ts```

INSTALL DEPENDENCIES
* ```$ npm install @solana/web3.js @coral-xyz/anchor```
* ```$ npm install @solana/web3.js @metaplex-foundation/umi @metaplex-foundation/mpl-token-metadata @metaplex-foundation/umi-bundle-defaults @metaplex-foundation/mpl-candy-machine```

CREATE AND INIT CONFIG:
* ```$ tcs --init```
* In the tsconfig.json, set "resolveJsonModule": true & "allowImportingTsModules": true

RUN:
* ```$ ts-node main.ts```
