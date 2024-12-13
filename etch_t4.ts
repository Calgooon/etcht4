
import * as btc from "@scure/btc-signer";
import * as Bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory, type ECPairInterface } from "ecpair";
import { none, Rune, RuneId, Runestone, EtchInscription, Terms, Etching, some } from "runelib";
import { Taptree } from "bitcoinjs-lib/src/types";
import { Range } from 'runelib/dist/runestones';

import {waitUntilUTXO} from './blockstreamutils'
import axios from "axios";
const toXOnly = (pubKey) => {
    return pubKey.length === 33 ? pubKey.slice(1) : pubKey;
  };
export const TESTNET4_NETWORK: typeof btc.NETWORK = {
    bech32: "tb", // Bech32 prefix for addresses on testnet4
    pubKeyHash: 0x1c,
    scriptHash: 0x16,
    wif: 0x3f,
  };

const ECPair = ECPairFactory(ecc);
Bitcoin.initEccLib(ecc);
async function etching() {
    const name = "AGORAWASHEREEEEEEE";

    const keyPair = ECPair.fromWIF('PRVIATE_KEY', 
        Bitcoin.networks.testnet,
    )

    console.log(keyPair.privateKey)

    const ins = new EtchInscription()

    ins.setContent("text/plain", Buffer.from('scrypt is best', 'utf-8'))
    ins.setRune(name)

    const etching_script_asm = `${toXOnly(Buffer.from(keyPair.publicKey)).toString(
        "hex"
    )} OP_CHECKSIG`;
    const etching_script = Buffer.concat([Bitcoin.script.fromASM(etching_script_asm), ins.encipher()]);

    const scriptTree: Taptree = {
        output: etching_script,
    }

    const script_p2tr = Bitcoin.payments.p2tr({
        internalPubkey: toXOnly(Buffer.from(keyPair.publicKey)),
        scriptTree,
        network:Bitcoin.networks.testnet
    });

    const etching_redeem = {
        output: etching_script,
        redeemVersion: 192
    }


    const etching_p2tr = Bitcoin.payments.p2tr({
        internalPubkey: toXOnly(Buffer.from(keyPair.publicKey)),
        scriptTree,
        redeem: etching_redeem,
        network:Bitcoin.networks.testnet
    });


    const address = script_p2tr.address ?? "";
    console.log("send coin to address", address);

    const utxos = await waitUntilUTXO(address as string)
    console.log(`Using UTXO ${utxos[0].txid}:${utxos[0].vout}`);

    // you need to wait the funding transaction get `6` or more confirmations

    const psbt = new Bitcoin.Psbt({ network: Bitcoin.networks.testnet });


    psbt.addInput({
        hash: utxos[0].txid,
        index: utxos[0].vout,
        witnessUtxo: { value: utxos[0].value, script: script_p2tr.output! },
        tapLeafScript: [
            {
                leafVersion: etching_redeem.redeemVersion,
                script: etching_redeem.output,
                controlBlock: etching_p2tr.witness![etching_p2tr.witness!.length - 1]
            }
        ],
    });

    const rune = Rune.fromName(name)

    const amount = 10000;
    const cap = 0;
    const terms = new Terms(amount, cap, new Range(none(), none()), new Range(none(), none()))
    const symbol = "$"
    const premine = some(10000);
    const divisibility = none();
    const etching = new Etching(divisibility, premine, some(rune), none(), some(symbol), some(terms), true);

    const stone = new Runestone([], some(etching), none(), none());

    psbt.addOutput({
        script: stone.encipher(),
        value: 0
    })


    const fee = 5000;

    const change = utxos[0].value - 546 - fee;

    psbt.addOutput({
        address: 'tb1qph7kqwmydlat0npfgwxcs2y9vytkz0k032j0mn', // ord address
        value: 546
    });

    psbt.addOutput({
        address: 'tb1qph7kqwmydlat0npfgwxcs2y9vytkz0k032j0mn', // change address
        value: change
    });

    const signer: Bitcoin.Signer = {
        publicKey: Buffer.from(keyPair.publicKey),
        sign: (hash: Buffer) => {
          if (!keyPair.privateKey) {
            throw new Error('Missing private key');
          }
          return Buffer.from(ecc.sign(hash, keyPair.privateKey));
        },
        signSchnorr: (hash: Buffer) => {
            if (!keyPair.privateKey) {
              throw new Error('Missing private key');
            }
            return Buffer.from(ecc.sign(hash, keyPair.privateKey));
          }
      };

    console.log(signer)

    await signAndSend(signer, psbt, address as string);
}

const signAndSend = async (
    keyPair: Bitcoin.Signer,
    psbt: Bitcoin.Psbt,
    address: string
  ) => {
    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();
  
    const tx = psbt.extractTransaction();
    console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
    const txid = await pushRawTx(tx.toHex());
    console.log(`Success! Txid is ${txid}`);
  
    return txid
    // return tx.toHex()
  }
  const pushRawTx = async (rawTx: string) => {
    const txid = await postData(
      `https://mempool.space/testnet4/api/tx`,
      rawTx
    );
    console.log("pushed txid", txid);
    return txid;
  };
  const postData = async (
    url: string,
    json: any,
    content_type = "text/plain",
    apikey = ""
  ) => {
    while (1) {
      try {
        const headers: any = {};
  
        if (content_type) headers["Content-Type"] = content_type;
  
        if (apikey) headers["X-Api-Key"] = apikey;
        const res = await axios.post(url, json, {
          headers,
        });
  
        return res.data;
      } catch (err: any) {
        const axiosErr = err;
        console.log("push tx error", axiosErr.response?.data);
  
        if (
          !(axiosErr.response?.data).includes(
            'sendrawtransaction RPC error: {"code":-26,"message":"too-long-mempool-chain,'
          )
        )
          throw new Error("Got an err when push tx");
      }
    }
  };
  etching()