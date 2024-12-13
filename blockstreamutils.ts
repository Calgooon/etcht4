import axios, { AxiosResponse } from "axios";
const MEMPOOL_API = "https://mempool.space/testnet4/api"
const blockstream = new axios.Axios({
    baseURL: `https://blockstream.info/testnet/api`
});

interface Transaction {
    txid: string;
    vout: number;
    status: {
      confirmed: boolean;
      block_height: number;
      block_hash: string;
      block_time: number;
    };
    value: number;
  };

export const fetchMempoolUtxo = async (address: string) => {
    const url = `${MEMPOOL_API}/address/${address}/utxo`;
    const res = await axios.get(url);
    const fetchData: Transaction[] = res.data;
    const result = fetchData.map(({ txid, value, vout }) => ({ txid, value, vout }));
    return result;
  }

export async function waitUntilUTXO(address: string) {
    return new Promise<any[]>((resolve, reject) => {
        let intervalId: any;
        const checkForUtxo = async () => {
            try {
                const url = `${MEMPOOL_API}/address/${address}/utxo`;
                const res = await axios.get(url);
                const fetchData: Transaction[] = res.data;
                const result = fetchData.map(({ txid, value, vout }) => ({ txid, value, vout }));
                if (result.length > 0) {
                    resolve(result);
                    clearInterval(intervalId);
                }
            } catch (error) {
                reject(error);
                clearInterval(intervalId);
            }
        };
        intervalId = setInterval(checkForUtxo, 10000);
    });
}

export async function broadcast(txHex: string) {
    const response: AxiosResponse<string> = await blockstream.post('/tx', txHex);
    return response.data;
}

interface IUTXO {
    txid: string;
    vout: number;
    status: {
        confirmed: boolean;
        block_height: number;
        block_hash: string;
        block_time: number;
    };
    value: number;
}