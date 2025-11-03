import fs from "fs";
import { homedir } from "os";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ProgramOne } from "../program-one/target/types/program_one.ts"

const main = async () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const programOne = anchor.workspace.TimeVault as Program<ProgramOne>;

  const alice = getKeypairFromFile(homedir() + "/.config/solana/alice.json");
  const bob = getKeypairFromFile(homedir() + "/.config/solana/bob.json");
};
main().catch(console.error);

function getKeypairFromFile(path: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(path, "utf8").toString()
      )
    )
  );
}
