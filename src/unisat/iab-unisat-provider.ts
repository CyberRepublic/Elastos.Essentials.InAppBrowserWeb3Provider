import EventEmitter from "events";
import { DABMessagePayload } from "../dab-message";
import { Utils } from "../utils";
import {
  PushTxParam,
  Request,
  SendBitcoinRequestPayload,
  SignBitcoinDataPayload,
} from "./request-types";

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
    console.log(
      "Creating an Essentials DappBrowserUnisatProvider",
      rpcUrl,
      address
    );

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

  /**
   * Updates the provider with a new wallet address and emits events
   */
  public updateAddress(address: string) {
    this.setAddress(address);
  }

  public async sendBitcoin(
    payAddress: string,
    satAmount: number,
    options?: SendBitcoinOptions
  ): Promise<string> {
    console.log("sendBitcoin", payAddress, satAmount, options);

    const requestPayload: SendBitcoinRequestPayload = {
      payAddress,
      satAmount,
      satPerVB: options?.feeRate,
    };
    return this.executeRequest("unisat_sendBitcoin", requestPayload);
  }

  public async signMessage(message: string): Promise<string> {
    console.log("signMessage", message);

    return this.executeRequest("unisat_signMessage", message);
  }

  /**
   * Signs any payload, including random data or a real BTC raw transaction (CAUTION).
   *
   * @param rawData Any HEX payload to sign, a raw BTC transaction encoded to HEX.
   *
   * @return Concatenated signature R|S (32 bytes, 32 bytes), HEX.
   */
  public async signData(
    rawData: string,
    type: "ecdsa" | "schnorr" = "ecdsa"
  ): Promise<string> {
    console.log("signData rawData:", rawData, "type:", type);
    const requestPayload: SignBitcoinDataPayload = {
      rawData,
      type,
    };
    return this.executeRequest("unisat_signData", requestPayload);
  }

  public async getPublicKey(): Promise<string> {
    console.log("getPublicKey");

    return this.executeRequest("unisat_getPublicKey", null);
  }

  // unisat: {rawtx: string}
  // okx: rawtx: string
  public async pushTx(options: PushTxParam | string): Promise<string> {
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
      object: data,
    };

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
    (window as any).webkit.messageHandlers.essentialsExtractor.postMessage(
      JSON.stringify(message)
    );
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

    if (error instanceof Error) request.rejecter(error);
    else request.rejecter(new Error(`${error}`));

    this.requests.delete(id);
  }
}

// Expose this class globally to be able to create instances from the browser dApp.
window["DappBrowserUnisatProvider"] = DappBrowserUnisatProvider;
