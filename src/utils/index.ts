import fs from 'fs';

import Arweave from 'arweave';
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const createWallet = async () => {
    const arweave = Arweave.init({
        host: '127.0.0.1',
        port: 1984,
        protocol: 'http'
    });

    const wallet = await arweave.wallets.generate();
    const address = await arweave.wallets.jwkToAddress(wallet);

    fs.writeFileSync('./wallets/wallet-arweave.json', JSON.stringify(wallet));

    await fetch('http://127.0.0.1:1984/mint/' + address + '/' + Math.pow(10, 100));

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const keypair = Keypair.generate();
    const feePayerAirdropSignature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL * 2);
    await connection.confirmTransaction(feePayerAirdropSignature);

    fs.writeFileSync('./wallets/wallet-solana.json', JSON.stringify(Array.from(keypair.secretKey)));
};
