import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BN } from "bn.js";
import { R24AnchorGofundme } from "../target/types/r24_anchor_gofundme";

describe("r24_anchor_gofundme", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .R24AnchorGofundme as Program<R24AnchorGofundme>;

  const utils = {
    derivePageVisitsPda: (userPubkey: anchor.web3.PublicKey) => {
      return anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("gofundme-20221215"),
          userPubkey.toBuffer(),
        ],
        program.programId
      )[0];
    },
    getAccountData: async (
      structData: anchor.AccountClient,
      pk: anchor.web3.PublicKey
    ) => {
      let dat_1 = await structData.fetch(pk);
      console.log(dat_1);
    },
    getAccountBalance: async (pk: anchor.web3.PublicKey) => {
      let balance = await program.provider.connection.getBalance(pk);
      console.log(`[${pk}] Balance: ${balance}`);
    },
  };

  const wallet1 = new anchor.Wallet(anchor.web3.Keypair.generate());
  const wallet2 = new anchor.Wallet(anchor.web3.Keypair.generate());
  const user1_FundMePDA = utils.derivePageVisitsPda(wallet1.publicKey);
  const user2_FundMePDA = utils.derivePageVisitsPda(wallet1.publicKey);

  // airdrop some solana to wallets
  before(async () => {
    // give each acount 100 lamports
    const lamports = new BN(100).mul(new BN(10).pow(new BN(9)));

    // airdrop some solana
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(
        wallet1.publicKey,
        lamports.toNumber()
      ),
      "confirmed"
    );

    // airdrop some solana
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(
        wallet2.publicKey,
        lamports.toNumber()
      ),
      "confirmed"
    );
  });

  it("Is initialized!", async () => {
    // number to lamports
    const lamports = new BN(5).mul(new BN(10).pow(new BN(9)));

    await program.methods
      .initialize("My FundMe", "https://www.google.com/image.jpg", lamports)
      .accounts({
        fundsData: user1_FundMePDA,
        user: wallet1.publicKey,
      })
      .signers([wallet1.payer])
      .rpc();

    // get the data
    await utils.getAccountData(program.account.fundData, user1_FundMePDA);
    // get the balance of PDA
    await utils.getAccountBalance(user1_FundMePDA);
  });

  it("Can receive funding from other wallets", async () => {
    // get the balance of PDA
    await utils.getAccountBalance(user1_FundMePDA);
    // get the balance of user
    await utils.getAccountBalance(wallet2.publicKey);

    // number to lamports
    const lamports = new BN(5).mul(new BN(10).pow(new BN(9)));

    await program.methods
      .fund(lamports)
      .accounts({
        fundsData: user1_FundMePDA,
        user: wallet2.publicKey,
      })
      .signers([wallet2.payer])
      .rpc();

    // get the balance of PDA
    await utils.getAccountBalance(user1_FundMePDA);
    // get the balance of user
    await utils.getAccountBalance(wallet2.publicKey);
  });

  it("Can withdraw funds", async () => {
    // get the balance of PDA
    await utils.getAccountBalance(user1_FundMePDA);
    // get the balance of user
    await utils.getAccountBalance(wallet1.publicKey);

    await program.methods
      .withdraw()
      .accounts({
        fundsData: user1_FundMePDA,
        user: wallet1.publicKey,
      })
      .signers([wallet1.payer])
      .rpc();

    // get the balance of PDA
    await utils.getAccountBalance(user1_FundMePDA);
    // get the balance of user
    await utils.getAccountBalance(wallet1.publicKey);
  });
});
