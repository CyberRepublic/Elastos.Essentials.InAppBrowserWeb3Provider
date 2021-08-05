import EventEmitter from "events";
import { AbstractProvider, RequestArguments } from "web3-core";
import { JsonRpcResponse, JsonRpcPayload } from "web3-core-helpers";
import { IdMapping } from "./ids";
import { ProviderRpcError } from "./providerrpcerror";
import { Utils } from "./utils";

// TODO: MAKE THIS DYNAMIC, REGISTERED BY ESSENTIALS CHAINID+URL
const rpcUrls = {
  // TODO: add others
  20: "https://api.trinity-tech.cn/eth",           // Elastos mainnet
  21: "https://api-testnet.trinity-tech.cn/eth",   // Elastos testnet
  128: "https://http-mainnet.hecochain.com"              // HECO mainnet
}

type JsonRpcCallback = (error: Error | null, result?: JsonRpcResponse) => void;

/**
 * Internal web3 provider injected into Elastos Essentials' in app browser dApps and bridging
 * requests from dApps to Essentials (send transaction, etc).
 *
 * Source code inspired by the Trust Wallet provider (https://github.com/trustwallet/trust-web3-provider/blob/master/src/index.js).
 */
class InAppBrowserWeb3Provider extends EventEmitter implements AbstractProvider {
  private address: string = "";
  private ready: boolean = false;
  private idMapping = new IdMapping(); // Helper class to create and retrieve payload IDs for requests and responses.
  private callbacks = new Map<string | number, JsonRpcCallback>();
  private wrapResults = new Map<string | number, boolean>();
  private chainId: number = 20;

  constructor() {
    super();
    console.log("Creating an Essentials InAppBrowserWeb3Provider");
    this.emitConnect(this.chainId);
  }

  /**
   * Sets the active wallet chain ID and informs listeners about the change.
   */
  public setChainId(chainId: number) {
    console.log("Setting chain ID to:", this.chainId);

    this.chainId = chainId;
    this.ready = !!(this.chainId && this.address);

    this.emit("chainChanged", this.chainId);
    this.emit("networkChanged", this.chainId);
  }

  /**
   * Sets the active wallet address and informs listeners about the change.
   */
  public setAddress(address: string) {
    console.log("Setting address to:", address);

    const lowerAddress = (address || "").toLowerCase();
    this.address = lowerAddress;
    this.ready = !!(this.chainId && this.address);

    this.emit("accountsChanged", [address]);

    /* TODO
    for (var i = 0; i < window.frames.length; i++) {
      const frame = window.frames[i];
      if (frame.ethereum && frame.ethereum.isTrust) {
        frame.ethereum.address = lowerAddress;
        frame.ethereum.ready = !!address;
      }
    } */
  }

  public isConnected(): boolean {
    return true;
  }

  public request(payload: JsonRpcPayload): Promise<any> {
    // 'this' points to window in methods like web3.eth.getAccounts()
    var that = this;
    if (!(this instanceof InAppBrowserWeb3Provider)) {
      that = (window as any).ethereum;
    }

    return that._request(payload, false);
  }

  /**
   * @deprecated Use request() method instead.
   * https://docs.metamask.io/guide/ethereum-provider.html#legacy-methods
   */
  public send(requestOrMethod: JsonRpcPayload | string, callbackOrParams: JsonRpcCallback | Array<any>) {
    if (typeof requestOrMethod === "string") {
      const method = requestOrMethod;
      const params = Array.isArray(callbackOrParams)
        ? callbackOrParams
        : callbackOrParams !== undefined
          ? [callbackOrParams]
          : [];
      const request: JsonRpcPayload = {
        jsonrpc: "2.0",
        id: 0,
        method,
        params
      };
      // Call _request() to wrap result into a JsonRpcResponse
      return this._request(request).then(res => res.result);
    }
    // send(JSONRPCRequest | JSONRPCRequest[], callback): void
    if (typeof callbackOrParams === "function") {
      const request = requestOrMethod;
      const callback = callbackOrParams;
      return this.sendAsync(request, callback);
    }
    // send(JSONRPCRequest[]): JSONRPCResponse[]
    if (Array.isArray(requestOrMethod)) {
      const requests = requestOrMethod;
      return requests.map(r => this.request(r));
    }
    // send(JSONRPCRequest): JSONRPCResponse
    const req = requestOrMethod;
    return this.request(req);
  }

  /**
   * @deprecated Use request() method instead.
   * https://docs.metamask.io/guide/ethereum-provider.html#legacy-methods
   */
  public sendAsync(payload: JsonRpcPayload, callback: (error: Error, result?: JsonRpcResponse) => void) {
    // 'this' points to window in methods like web3.eth.getAccounts()
    var that = this;
    if (!(this instanceof InAppBrowserWeb3Provider)) {
      that = (window as any).ethereum;
    }

    that._request(payload)
      .then((data) => callback(null, data))
      .catch((error) => callback(error, null));
  }

  /**
   * Internal request handler that receives JsonRpcPayloads and returns JsonRpcResponses.
   */
  private _request(payload: JsonRpcPayload, wrapResult = true): Promise<JsonRpcResponse> {
    //console.log("InAppBrowserWeb3Provider: _request", payload);

    this.idMapping.tryIntifyId(payload);
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      if (!payload.id) {
        payload.id = Utils.genId();
      }
      this.callbacks.set(payload.id as any, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
      this.wrapResults.set(payload.id, wrapResult);

      switch (payload.method) {
        case "eth_accounts":
          return this.sendResponse(payload.id, this.eth_accounts());
        case "eth_coinbase":
          return this.sendResponse(payload.id, this.eth_coinbase());
        case "net_version":
          return this.sendResponse(payload.id, this.net_version());
        case "eth_chainId":
          return this.sendResponse(payload.id, this.eth_chainId());
        case "eth_sign":
          return this.eth_sign(payload);
        case "personal_sign":
          return this.personal_sign(payload);
        case "personal_ecRecover":
          return this.personal_ecRecover(payload);
        case "eth_signTypedData_v3":
          return this.eth_signTypedData(payload, false);
        case "eth_signTypedData":
        case "eth_signTypedData_v4":
          return this.eth_signTypedData(payload, true);
        case "eth_sendTransaction":
          return this.eth_sendTransaction(payload);
        case "eth_requestAccounts":
          return this.eth_requestAccounts(payload);
        case "wallet_watchAsset":
          return this.wallet_watchAsset(payload);
        case "wallet_addEthereumChain":
          return this.wallet_addEthereumChain(payload);
        case "eth_newFilter":
        case "eth_newBlockFilter":
        case "eth_newPendingTransactionFilter":
        case "eth_uninstallFilter":
        case "eth_subscribe":
          throw new ProviderRpcError(4200, `Elastos Essentials does not support the ${payload.method} method.`);
        default:
          // call upstream rpc
          this.callbacks.delete(payload.id as any);
          this.wrapResults.delete(payload.id);

          this.callJsonRPC(payload).then(response => {
            wrapResult ? resolve(response) : resolve(response.result);
          }).catch(e => {
            console.log("callJsonRPC catched");
            reject(e);
          });
      }
    });
  }

  private emitConnect(chainId: number) {
    console.log("InAppBrowserWeb3Provider: emitting connect", chainId);
    this.emit("connect", { chainId: chainId });
  }

  private eth_accounts(): string[] {
    return this.address ? [this.address] : [];
  }

  private eth_coinbase(): string {
    return this.address;
  }

  private net_version(): string {
    return this.chainId.toString(10) || null;
  }

  private eth_chainId(): string {
    return "0x" + this.chainId.toString(16);
  }

  private eth_sign(payload: JsonRpcPayload) {
    const buffer = Utils.messageToBuffer(payload.params[1]);
    const hex = Utils.bufferToHex(buffer);
    throw new Error("eth_sign NOT IMPLEMENTED");
    // TODO: unclear why this is a "personal message" if the buffer is utf8...
    /* if (isUtf8(buffer)) {
      this.postMessage("signPersonalMessage", payload.id, { data: hex });
    } else {
      this.postMessage("signMessage", payload.id, { data: hex });
    } */
  }

  private personal_sign(payload: JsonRpcPayload) {
    const message = payload.params[0];
    const buffer = Utils.messageToBuffer(message);
    if (buffer.length === 0) {
      // hex it
      const hex = Utils.bufferToHex(message);
      this.postMessage("signPersonalMessage", payload.id, { data: hex });
    } else {
      this.postMessage("signPersonalMessage", payload.id, { data: message });
    }
  }

  private personal_ecRecover(payload: JsonRpcPayload) {
    this.postMessage("ecRecover", payload.id, {
      signature: payload.params[1],
      message: payload.params[0],
    });
  }

  private eth_signTypedData(payload, useV4) {
    // TODO
    /* const message = JSON.parse(payload.params[1]);
    const hash = TypedDataUtils.sign(message, useV4);
    this.postMessage("signTypedMessage", payload.id, {
      data: "0x" + hash.toString("hex"),
      raw: payload.params[1],
    }); */
  }

  private eth_sendTransaction(payload: JsonRpcPayload) {
    this.postMessage("signTransaction", payload.id, payload.params[0]);
  }

  private eth_requestAccounts(payload: JsonRpcPayload) {
    this.postMessage("requestAccounts", payload.id, {});
  }

  private wallet_watchAsset(payload: /* JsonRpcPayload */ any) {
    let options = payload.params.options;
    this.postMessage("watchAsset", payload.id, {
      type: payload.type,
      contract: options.address,
      symbol: options.symbol,
      decimals: options.decimals || 0,
    });
  }

  private wallet_addEthereumChain(payload: JsonRpcPayload) {
    this.postMessage("addEthereumChain", payload.id, payload.params[0]);
  }

  /**
   * Internal js -> native message handler
   */
  private postMessage(handler: string, id: string | number, data: unknown) {
    //console.log("InAppBrowserWeb3Provider: postMessage", handler, id, data);

    if (this.ready || handler === "requestAccounts") {
      let object = {
        id: id,
        name: handler,
        object: data,
      };
      (window as any).webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(object));
    } else {
      this.sendError(id, new ProviderRpcError(4100, "Provider is not ready"));
    }
  }

  /**
   * Internal native result -> js
   */
  private sendResponse(id: string | number, result: unknown): void {
    //console.log("InAppBrowserWeb3Provider: sendResponse", result);

    let originId = this.idMapping.tryPopId(id) || id;
    let callback = this.callbacks.get(id);
    let wrapResult = this.wrapResults.get(id);
    let data: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: originId
    };

    /* if (typeof result === "object" && "jsonrpc" in result && "result" in result) {
      // result is a JsonRpcResponse
      data.result = (result as JsonRpcResponse).result;
    } else {
      // result is the JsonRpcResponse result
      data.result = result;
    } */
    data.result = result;

    //console.log("data result", data.result);
    //console.log("wrapResult", wrapResult);

    if (callback) {
      wrapResult ? callback(null, data) : callback(null, result as any);
      this.callbacks.delete(id);
    } else {
      console.log(`callback id: ${id} not found`);
      // check if it's iframe callback

      // TODO
      /* for (var i = 0; i < window.frames.length; i++) {
        const frame = window.frames[i];
        try {
          if (frame.ethereum.callbacks.has(id)) {
            frame.ethereum.sendResponse(id, result);
          }
        } catch (error) {
          console.log(`send response to frame error: ${error}`);
        }
      } */
    }
  }

  /**
   * Internal native error -> js
   */
  private sendError(id: string | number, error: Error | string) {
    //console.log(`<== ${id} sendError ${error}`);
    let callback = this.callbacks.get(id);
    if (callback) {
      callback(error instanceof Error ? error : new Error(error), null);
      this.callbacks.delete(id);
    }
  }

  private getRPCApiEndpoint(): string {
    return rpcUrls[this.chainId];
  }

  private async callJsonRPC(payload: JsonRpcPayload): Promise<JsonRpcResponse> {
    return new Promise(async (resolve, reject) => {
      var request = new XMLHttpRequest();

      let rpcApiEndpoint = await this.getRPCApiEndpoint();

      request.open('POST', rpcApiEndpoint, true);
      request.setRequestHeader('Content-Type', 'application/json');
      request.timeout = 5000;

      request.onreadystatechange = function () {
        if (request.readyState === 4 && request.timeout !== 1) {
          var result = request.responseText;

          try {
            console.log("JSON RPC call result:", result, "for payload:", payload);
            resolve(JSON.parse(result) as JsonRpcResponse);
          } catch (e) {
            console.log("JSON parse error");
            reject("Invalid JSON response returned by the JSON RPC");
          }
        }
      };

      request.ontimeout = function () {
        reject("Timeout");
      };

      request.onerror = function (error) {
        console.error("RPC call error");
        reject(error);
      }

      try {
        request.send(JSON.stringify(payload));
      } catch (error) {
        reject("Connection error");
      }
    });
  }
}

// Expose this class globally to be able to create instances from the browser dApp.
window["InAppBrowserWeb3Provider"] = InAppBrowserWeb3Provider;