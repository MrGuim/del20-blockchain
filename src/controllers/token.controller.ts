import fs from 'fs';

import { PassThrough } from 'stream';

import { RequestHandler } from 'express';
import httpStatus from 'http-status';

import QRCode from 'qrcode';
import Arweave from 'arweave';

import { JWKInterface } from 'arweave/node/lib/wallet';

import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { keypairIdentity, Metaplex } from '@metaplex-foundation/js';

import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';

import { ApiError, catchError } from '../middlewares/error';
import { Event } from '../types/event';

export const getEvent: RequestHandler = catchError(async (req: any, res) => {
    const eventId = req.params.eventId;
    const publicKey: PublicKey = new PublicKey(req.query.publicKey);
    const path: string = './events/' + eventId + '.json';

    let event: Event;

    try {
        event = JSON.parse(fs.readFileSync(path).toString());
    } catch (e) {
        throw new ApiError(404, 'event not found');
    }

    if (event.currentPeople == event.maxPeople || !event.isCreated || event.imageUrl === undefined) {
        return res.status(httpStatus.GONE).send({
            isActive: false
        });
    }

    event.currentPeople++;

    const arweave = Arweave.init({
        host: '127.0.0.1',
        port: 1984,
        protocol: 'http'
    });

    const wallet: JWKInterface = JSON.parse(fs.readFileSync('./wallets/wallet-arweave.json').toString());
    const secretKey = JSON.parse(fs.readFileSync('./wallets/wallet-solana.json').toString());
    const keypair: Keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

    const metadata = {
        name: 'Event test #' + event.currentPeople,
        symbol: 'DNFT',
        description: 'The ' + event.currentPeople + ' arrived at the event test',
        seller_fee_basis_points: 500,
        external_url: 'https://www.delaware.pro',
        attributes: [
            {
                trait_type: 'Emit number',
                value: event.currentPeople
            }
        ],
        collection: {
            name: 'Event test',
            family: 'Event'
        },
        properties: {
            files: [
                {
                    uri: event.imageUrl,
                    type: 'image/png'
                }
            ],
            category: 'image',
            maxSupply: 0,
            creators: [
                {
                    address: keypair.publicKey,
                    share: 100
                }
            ]
        },
        image: event.imageUrl
    };

    const metadataRequest = JSON.stringify(metadata);

    const metadataTransaction = await arweave.createTransaction({
        data: metadataRequest
    });

    metadataTransaction.addTag('Content-Type', 'application/json');

    await arweave.transactions.sign(metadataTransaction, wallet);

    console.log('metadata txid', metadataTransaction.id);

    const response = await arweave.transactions.post(metadataTransaction);
    if (response.status !== 200) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'failed to create the nft');
    }

    fs.writeFile(path, JSON.stringify(event), () => null);

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    const metaplex = Metaplex.make(connection).use(keypairIdentity(keypair));

    const { nft } = await metaplex.nfts().create({
        uri: 'http://127.0.0.1:1984/' + metadataTransaction.id,
        maxSupply: 1
    });

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, keypair, nft.mint, keypair.publicKey);
    console.log('fromTokenAccount', fromTokenAccount.address);

    // Get the token account of the toWallet address, and if it does not exist, create it
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, keypair, nft.mint, publicKey);
    console.log('toTokenAccount', toTokenAccount.address);

    const signature = await transfer(
        connection,
        keypair,
        fromTokenAccount.address,
        toTokenAccount.address,
        keypair.publicKey,
        1,
        []
    );

    console.log(signature);

    res.status(httpStatus.OK).send({ ok: 'ok' });
});

export const createWallet: RequestHandler = catchError(async (req: any, res) => {
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

    res.sendStatus(httpStatus.OK);
});

export const createEvent: RequestHandler = catchError(async (req: any, res) => {
    const eventId = fs.readdirSync('./events').length / 2 + 1;
    console.log(eventId);

    const path: string = './events/' + eventId + '.json';

    const arweave = Arweave.init({
        host: '127.0.0.1',
        port: 1984,
        protocol: 'http'
    });

    const data = fs.readFileSync(req.file.path);

    const transaction = await arweave.createTransaction({
        data: data
    });

    transaction.addTag('Content-Type', req.file.mimetype);

    const wallet: JWKInterface = JSON.parse(fs.readFileSync('./wallets/wallet-arweave.json').toString());

    await arweave.transactions.sign(transaction, wallet);

    const response = await arweave.transactions.post(transaction);
    if (response.status !== 200) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'failed to upload image');
    }

    const event: Event = {
        eventName: req.params.name,
        maxPeople: req.params.maxAttendees,
        publicKeys: [],
        imageUrl: `http://127.0.0.1:1984/${transaction.id}`
    };

    fs.writeFileSync(path, JSON.stringify(event));

    const content = 'http://127.0.0.1:3000/event/' + eventId;

    const qrStream = new PassThrough();

    await QRCode.toFileStream(qrStream, content, {
        type: 'png',
        width: 200,
        errorCorrectionLevel: 'H'
    });

    qrStream.pipe(res);
});
