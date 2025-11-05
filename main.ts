import fs from "fs";
import { homedir } from "os";
import { clusterApiUrl, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { TimeVault } from "../time-vault/target/types/time_vault.ts";
import timeVaultIdl from "../time-vault/target/idl/time_vault.json";
import { createAssociatedTokenAccount, createAssociatedTokenAccountInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import type { P2pTokenEscrow } from "../p2p-token-escrow/target/types/p2p_token_escrow.ts";
import escrowIdl from "../p2p-token-escrow/target/idl/p2p_token_escrow.json";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const main = async () => {
  const aMint = getKeypairFromFile(homedir() + "/.config/solana/new-mint.json");
  const timeMint = getKeypairFromFile(homedir() + "/.config/solana/TimeVaultToken.json");

  const dev = getKeypairFromFile(homedir() + "/.config/solana/dev.json");
  const alice = getKeypairFromFile(homedir() + "/.config/solana/alice.json");
  const bob = getKeypairFromFile(homedir() + "/.config/solana/bob.json");

  const wallet = new anchor.Wallet(getKeypairFromFile(homedir() + "/.config/solana/bob.json"));
  const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
  const provider = new anchor.AnchorProvider(conn, wallet, {commitment: "confirmed"});
  anchor.setProvider(provider);

  const timeVault = new anchor.Program<TimeVault>(timeVaultIdl as TimeVault, provider);
  const escrow = new anchor.Program<P2pTokenEscrow>(escrowIdl as P2pTokenEscrow, provider); 

  try {

    const escrowSeed = new anchor.BN(0);
    const escrowAskMint = timeMint;
    const escrowAskAmount = new anchor.BN(67);
    const escrowOfferMint = aMint.publicKey;
    const escrowOfferAmount = new anchor.BN(7.11);
    const trans = new Transaction();
    trans.add(createAssociatedTokenAccountInstruction(
      bob.publicKey,
      getAssociatedTokenAddressSync(escrowAskMint.publicKey, bob.publicKey),
      bob.publicKey,
      escrowAskMint.publicKey,
    ));
    trans.add(createAssociatedTokenAccountInstruction(
      alice.publicKey,
      getAssociatedTokenAddressSync(escrowOfferMint, alice.publicKey),
      alice.publicKey,
      escrowOfferMint,
    ));
    trans.add(await escrow.methods.take(escrowSeed, escrowOfferAmount, escrowAskAmount)
      .accountsPartial({
        taker: alice.publicKey,
        maker: bob.publicKey,
        mintMaker: escrowOfferMint,
        mintMakerTokenProgram: TOKEN_PROGRAM_ID,
        mintTaker: escrowAskMint.publicKey,
        mintTakerTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([alice])
      .transaction());
    const tx2 = await sendAndConfirmTransaction(conn, trans, [alice, bob], {skipPreflight: false});
    console.log("https://solscan.io/tx/" + tx2 + "?cluster=devnet")
  }
  catch (e) {
    console.error(e)
  }
};

main().catch(console.error);

async function generalInit(
  conn: Connection,
  dev: Keypair,
  wallet: anchor.Wallet,
  alice: Keypair, 
  bob: Keypair, 
  timeMint: PublicKey,
  aMint: Keypair,
  timeVault: anchor.Program<TimeVault>,
  escrow: anchor.Program<P2pTokenEscrow>) {
    let trans = new Transaction();

    trans.add(await timeVault
    .methods
    .initialize(new anchor.BN(10))
    .accounts({signer: bob.publicKey})
    .signers([bob])
    .instruction());
    trans.add(await timeVault
      .methods
      .lock(false)
      .accounts({authority: bob.publicKey})
      .signers([bob])
      .instruction());

    const rent = await conn.getMinimumBalanceForRentExemption(MINT_SIZE, "confirmed"); 
    trans.add(SystemProgram.createAccount({
      fromPubkey: bob.publicKey,
      newAccountPubkey: aMint.publicKey,
      space: MINT_SIZE,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    }));

    trans.add(createInitializeMint2Instruction(
      aMint.publicKey, 
      6, 
      wallet.publicKey, 
      null,
      TOKEN_PROGRAM_ID));

    const bobATA = getAssociatedTokenAddressSync(
      aMint.publicKey, 
      bob.publicKey);
    trans.add(createAssociatedTokenAccountInstruction(
      bob.publicKey, 
      bobATA, 
      bob.publicKey, 
      aMint.publicKey));

    trans.add(createMintToInstruction(
      aMint.publicKey,
      bobATA,
      bob.publicKey,
      1000000000000,
    ));

    const vaultDataPDA = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("vault_data"),
        bob.publicKey.toBuffer(),
      ],
      timeVault.programId
    )[0];

    trans.add(await timeVault.methods
    .deposit(new anchor.BN(10000000))
    .accounts({
        authority: bob.publicKey,
        vaultData: vaultDataPDA,
        fromAta: getAssociatedTokenAddressSync(aMint.publicKey, bob.publicKey),
        mint: aMint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([bob])
    .instruction());

    trans.add(await timeVault
      .methods
      .lock(true)
      .accounts({authority: bob.publicKey})
      .signers([bob])
      .instruction());

    const escrowSeed = new anchor.BN(0);
    const escrowAskMint = timeMint;
    const escrowAskAmount = new anchor.BN(67);
    const escrowOfferMint = aMint.publicKey;
    const escrowOfferAmount = new anchor.BN(7.11);
    trans.add(await escrow.methods
      .make(escrowSeed, escrowOfferAmount, escrowAskAmount)
      .accounts({
        maker: bob.publicKey,
        mintMaker: escrowOfferMint,
        mintTaker: escrowAskMint,
        mintMakerTokenProgram: TOKEN_PROGRAM_ID,
        mintTakerTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bob])
      .instruction());

    const aliceATA = getAssociatedTokenAddressSync(escrowAskMint, alice.publicKey);
    trans.add(createMintToInstruction(
      escrowAskMint, 
      aliceATA, 
      dev.publicKey, 
      escrowAskAmount));


    const tx = await sendAndConfirmTransaction(conn, trans, [alice, bob, aMint, dev], {skipPreflight: false});
    console.log("https://solscan.io/tx/" + tx + "?cluster=devnet")
}

function saveKeypairToFile(keypair: Keypair, path: string) {
  fs.writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
}

function getKeypairFromFile(path: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(path, "utf8").toString()
      )
    )
  );
}
