import EventEmitter from "events";
import { DABMessagePayload } from "../dab-message";
import { Utils } from "../utils";
import { PushTxParam, Request, SendBitcoinRequestPayload, SignBitcoinDataPayload } from "./request-types";

/**
 * Internal web3 provider injected into Elastos Essentials' in app browser dApps and bridging
 * requests from dApps to Essentials (send transaction, etc).
 *
 * This provider simulates support for window.unisat (Bitcoin wallet)
 */
class DappBrowserUnisatProvider extends EventEmitter {
  private rpcUrl: string = null;
  private address: string = null; // Bitcoin address
  private requests = new Map<number, Request>(); // stores on going requests

  public isEssentials = true; // Let dapps know that this provider is the Essentials injected one, in case they want to adjust their UI.

  constructor(rpcUrl: string, address: string) {
    super();
    console.log("Creating an Essentials DappBrowserUnisatProvider", rpcUrl, address);

    this.rpcUrl = rpcUrl;
    this.address = address;
  }

  public async requestAccounts(): Promise<string[]> {
    return [this.address];
  }

  public async getAccounts(): Promise<string[]> {
    return [this.address];
  }

  /**
   * Called by essentials to update the address from browser settings
   * while still browsing the app.
   */
  public setAddress(address: string) {
    this.address = address;

    console.log("Setting bitcoin address to:", address);

    this.emit("accountsChanged", [address]);
  }

  public async sendBitcoin(payAddress: string, satAmount: number, options?: SendBitcoinOptions): Promise<string> {
    console.log("sendBitcoin", payAddress, satAmount, options);

    const requestPayload: SendBitcoinRequestPayload = {
      payAddress,
      satAmount,
      satPerVB: options?.feeRate
    }
    return this.executeRequest("unisat_sendBitcoin", requestPayload);
  }

  public async signMessage(message: string): Promise<string> {
    console.log("signMessage", message);

    return this.executeRequest("unisat_signMessage", message);
  }

  /**
   *
   * @param rawData : btc transaction
   * @param prevOutScript : the lock BTC script
   * @param inIndex : the index of inputs
   * @param value : the sat amount of input
   * @returns
   */
  public async signData(rawData: string, prevOutScript: string, inIndex: number, value: number): Promise<string> {
    console.log("signData", rawData, prevOutScript, inIndex, value);
    const requestPayload: SignBitcoinDataPayload = {
      rawData,
      prevOutScript,
      inIndex,
      value
    }
    return this.executeRequest("unisat_signData", requestPayload);
  }

  public async getPublicKey(): Promise<string> {
    console.log("getPublicKey");

    return this.executeRequest("unisat_getPublicKey", null);
  }

  public async pushTx(options: PushTxParam): Promise<string> {
    console.log("pushTx");
    return this.executeRequest("unisat_pushTx", options);
  }

  /**
   * Sends a request to Essentials, and awaits the result from essentials.
   */
  private async executeRequest<ResultType>(name: string, data: any) {
    const id = Utils.genId();

    const message: DABMessagePayload = {
      id,
      name,
      object: data
    }

    const result = new Promise<ResultType>((resolver, rejecter) => {
      // Rember the request
      this.requests.set(id, { message, resolver, rejecter });

      // Send request to Essentials
      this.postMessage(message);
    });

    return result;
  }

  /**
   * Internal js -> native message handler
   */
  private postMessage(message: DABMessagePayload) {
    console.log("InAppBrowserUnisatProvider: postMessage", message);
    (window as any).webkit.messageHandlers.essentialsExtractor.postMessage(JSON.stringify(message));
  }

  /**
   * Internal native result -> js
   */
  public sendResponse(id: number, result: unknown): void {
    console.log("InAppBrowserUnisatProvider: sendResponse", id, result);

    const request = this.requests.get(id);
    request.resolver(result);
    this.requests.delete(id);
  }

  /**
   * Internal native error -> js
   */
  public sendError(id: number, error: Error | string | object) {
    console.log("InAppBrowserUnisatProvider: sendError", id, error);

    const request = this.requests.get(id);

    if (error instanceof Error)
      request.rejecter(error);
    else
      request.rejecter(new Error(`${error}`));

    this.requests.delete(id);
  }
}

// Expose this class globally to be able to create instances from the browser dApp.
window["DappBrowserUnisatProvider"] = DappBrowserUnisatProvider;