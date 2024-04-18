import EventEmitter from "events";
import { DABMessagePayload } from "../dab-message";
import { Utils } from "../utils";
import { AddressType, GetAddressesRequestPayload, Request } from "./request-types";
import { JsonRpcPayload } from "web3-core-helpers";

/**
 * Internal web3 provider injected into Elastos Essentials' in app browser dApps and bridging
 * requests from dApps to Essentials (send transaction, etc).
 *
 * This provider simulates support for window.elamain (Elastos main chain wallet)
 */
class DappBrowserElaMainProvider extends EventEmitter {
  private rpcUrl: string = null;
  private address: string = null; // Ela main chain address
  private requests = new Map<number, Request>(); // stores on going requests


  constructor(rpcUrl: string, address: string) {
    super();
    console.log("Creating an Essentials DappBrowserElaMainProvider", rpcUrl, address);

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
   * Sets the active wallet address and informs listeners about the change.
   */
  public setAddress(address: string) {
    this.address = address;

    this.emit("accountsChanged", [address]);
  }

  public async getAddresses(count: number, type = AddressType.Normal_external, index = 0): Promise<string[]> {
    console.log("InAppBrowserElaMainProvider getAddresses", count, type, index);

    const requestPayload: GetAddressesRequestPayload = {
      index,
      count,
      type
    }
    return this.executeRequest("elamain_getAddresses", requestPayload);
  }

  private elamain_sign(payload: JsonRpcPayload) {
    // TODO
    return this.executeRequest("elamain_sign", payload);
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
    console.log("InAppBrowserElaMainProvider: postMessage", message);
    (window as any).webkit.messageHandlers.essentialsExtractor.postMessage(JSON.stringify(message));
  }

  /**
   * Internal native result -> js
   */
  public sendResponse(id: number, result: unknown): void {
    console.log("InAppBrowserElaMainProvider: sendResponse", id, result);

    const request = this.requests.get(id);
    request.resolver(result);
    this.requests.delete(id);
  }

  /**
   * Internal native error -> js
   */
  public sendError(id: number, error: Error | string | object) {
    console.log("InAppBrowserElaMainProvider: sendError", id, error);

    const request = this.requests.get(id);

    if (error instanceof Error)
      request.rejecter(error);
    else
      request.rejecter(new Error(`${error}`));

    this.requests.delete(id);
  }
}

// Expose this class globally to be able to create instances from the browser dApp.
window["DappBrowserElaMainProvider"] = DappBrowserElaMainProvider;