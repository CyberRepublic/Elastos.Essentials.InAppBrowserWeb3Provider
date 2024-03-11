import EventEmitter from "events";
import { JsonRpcResponse } from "web3-core-helpers";
import { IdMapping } from "../ids";

type JsonRpcCallback = (error: Error | null, result?: JsonRpcResponse) => void;

type SendBitcoinOptions = {
  feeRate: number;
}

/**
 * Internal web3 provider injected into Elastos Essentials' in app browser dApps and bridging
 * requests from dApps to Essentials (send transaction, etc).
 *
 * This provider simulates support for window.unisat (Bitcoin wallet)
 */
class DappBrowserUnisatProvider extends EventEmitter {
  private address: string = null; // Bitcoin address
  private ready: boolean = false;
  private idMapping = new IdMapping(); // Helper class to create and retrieve payload IDs for requests and responses.
  private callbacks = new Map<string | number, JsonRpcCallback>();
  private wrapResults = new Map<string | number, boolean>();

  /*private rpcUrls: { [chainID: number]: string } = {
    // List of chainId -> rpcUrl set by Essentials.
  } */

  constructor(rpcUrl: string, address: string) {
    super();
    console.log("Creating an Essentials DappBrowserUnisatProvider", rpcUrl, address);

    /* this._chainId = chainId;
    this.setRPCApiEndpoint(chainId, rpcUrl);
    this.ready = !!(this._chainId && this.address); */

    this.address = address;
    this.ready = true;

    //this.emitConnect(chainId);
  }

  public async requestAccounts(): Promise<string[]> {
    return [this.address];
  }

  public async getAccounts(): Promise<string[]> {
    return [this.address];
  }

  public async sendBitcoin(payAddress: string, satsToPay: number, options: SendBitcoinOptions): Promise<string> {
    console.log("sendBitcoin", payAddress, satsToPay, options);
    this.postMessage("sendBitcoin", 12, { toto: "data yes" })
    return "txid";
  }

  /**
   * Sets the active wallet address and informs listeners about the change.
   */
  /* public setAddress(address: string) {
    const lowerAddress = (address || "").toLowerCase();
    this.address = lowerAddress;
    this.ready = !!(this._chainId && this.address);

    console.log("Setting address to:", address);

    this.emit("accountsChanged", [address]);
  } */

  // Backward compatibility with some dapps.
  /* public get selectedAddress(): string {
    return this.address;
  } */

  /* public setRPCApiEndpoint(chainId: number, rpcUrl: string) {
    this.rpcUrls[chainId] = rpcUrl;
  }

  private getRPCApiEndpoint(): string {
    if (!(this._chainId in this.rpcUrls))
      throw new Error("RPC URL not set for chain ID" + this._chainId);

    return this.rpcUrls[this._chainId];
  } */

  /* public isConnected(): boolean {
    return true;
  }

  public enable(): Promise<void> {
    // Nothing to do - already active
    return Promise.resolve();
  }

  public request(payload: JsonRpcPayload): Promise<any> {
    // 'this' points to window in methods like web3.eth.getAccounts()
    var that = this;
    if (!(this instanceof DappBrowserWeb3Provider)) {
      that = (window as any).ethereum;
    }

    return that._request(payload, false);
  } */

  /**
   * @deprecated Use request() method instead.
   * https://docs.metamask.io/guide/ethereum-provider.html#legacy-methods
   */
  /* public send(requestOrMethod: JsonRpcPayload | string, callbackOrParams: JsonRpcCallback | Array<any>) {
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
  } */

  /**
   * @deprecated Use request() method instead.
   * https://docs.metamask.io/guide/ethereum-provider.html#legacy-methods
   */
  /* public sendAsync(payload: JsonRpcPayload, callback: (error: Error, result?: JsonRpcResponse) => void) {
    // 'this' points to window in methods like web3.eth.getAccounts()
    var that = this;
    if (!(this instanceof DappBrowserWeb3Provider)) {
      that = (window as any).ethereum;
    }

    that._request(payload)
      .then((data) => callback(null, data))
      .catch((error) => callback(error, null));
  } */

  /**
   * Internal request handler that receives JsonRpcPayloads and returns JsonRpcResponses.
   */
  /* private _request(payload: JsonRpcPayload, wrapResult = true): Promise<JsonRpcResponse> {
    //console.log("InAppBrowserUnisatProvider: _request", payload);

    this.idMapping.tryIntifyId(payload);
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      if (!payload.id) {
        payload.id = Utils.genId();
      }
      this.callbacks.set(payload.id as any, (error, data) => {
        if (error) {
          console.log("InAppBrowserUnisatProvider: _request error", error);
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
        case "wallet_switchEthereumChain":
          return this.wallet_switchEthereumChain(payload);
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
    console.log("InAppBrowserUnisatProvider: emitting connect", chainId);
    this.emit("connect", { chainId: chainId });
  }

  private eth_accounts(): string[] {
    return this.address ? [this.address] : [];
  }

  private eth_coinbase(): string {
    return this.address;
  }

  private net_version(): string {
    return this._chainId.toString(10) || null;
  }

  private eth_chainId(): string {
    return "0x" + this._chainId.toString(16);
  } */

  /* private eth_sign(payload: JsonRpcPayload) {
    const buffer = Utils.messageToBuffer(payload.params[1]);
    const hex = Utils.bufferToHex(buffer);

    **
     * Historically eth_sign can either receive:
     * - a very insecure raw message (hex) - supported by metamask
     * - a prefixed message (utf8) - standardized implementation
     *
     * So we detect the format here:
     * - if that's a utf8 prefixed string -> eth_sign = personal_sign
     * - if that's a buffer (insecure hex that could sign any transaction) -> insecure eth_sign screen
     *
    if (isUtf8(buffer)) {
      this.postMessage("personal_sign", payload.id, { data: hex });
    } else {
      this.postMessage("signInsecureMessage", payload.id, { data: hex });
    }
  } */

  /**
   * Internal js -> native message handler
   */
  private postMessage(handler: string, id: string | number, data: unknown) {
    console.log("InAppBrowserUnisatProvider: postMessage", handler, id, data);

    if (this.ready) {
      let object = {
        id: id,
        name: `unisat_${handler}`,
        object: data,
      };
      (window as any).webkit.messageHandlers.essentialsExtractor.postMessage(JSON.stringify(object));
    } else {
      // TODO this.sendError(id, new ProviderRpcError(4100, "Provider is not ready"));
    }
  }

  /**
   * Internal native result -> js
   */
  /* private sendResponse(id: string | number, result: unknown): void {
    //console.log("InAppBrowserUnisatProvider: sendResponse", result);

    let originId = this.idMapping.tryPopId(id) || id;
    let callback = this.callbacks.get(id);
    let wrapResult = this.wrapResults.get(id);
    let data: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: originId
    };

    data.result = result;

    if (callback) {
      wrapResult ? callback(null, data) : callback(null, result as any);
      this.callbacks.delete(id);
    } else {
      console.log(`callback id: ${id} not found`);
      // check if it's iframe callback
    }
  } */

  /**
   * Internal native error -> js
   */
  /* private sendError(id: string | number, error: Error | string | object) {
    //console.log(`<== ${id} sendError ${error}`, error);
    //console.log("Instanceof ProviderRpcError?", error instanceof ProviderRpcError)
    let callback = this.callbacks.get(id);
    if (callback) {
      if (error instanceof Error)
        callback(error);
      else if (typeof error === "object" && "code" in error)
        callback(new ProviderRpcError(error["code"], error["message"]));
      else
        callback(new Error(`${error}`));
      this.callbacks.delete(id);
    }
  } */

  /* private async callJsonRPC(payload: JsonRpcPayload): Promise<JsonRpcResponse> {
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
  } */
}

// Expose this class globally to be able to create instances from the browser dApp.
window["DappBrowserUnisatProvider"] = DappBrowserUnisatProvider;