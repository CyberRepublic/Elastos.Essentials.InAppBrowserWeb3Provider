import EventEmitter from "events";
import { AbstractProvider, RequestArguments } from "web3-core";
import { JsonRpcResponse, JsonRpcPayload } from "web3-core-helpers";
import { IdMapping } from "./ids";
import { ProviderRpcError } from "./providerrpcerror";
import { Utils } from "./utils";

/**
 * Internal web3 provider injected into Elastos Essentials' in app browser dApps and bridging
 * requests from dApps to Essentials (send transaction, etc).
 */
class InAppBrowserWeb3Provider extends EventEmitter implements AbstractProvider {
  private address: string = "0xeC22e7B0A63a24a2D689B2FFEF5640D141c80F21"; // TODO TMP
  private ready: boolean = false;
  private idMapping = new IdMapping();
  private callbacks = new Map(); // TODO: clear type
  private wrapResults = new Map(); // TODO: clear type
  private rpcApiEndpoint: string = "https://api.trinity-tech.cn/eth"; // RPC API server url.
  private chainId: number = 20; // TODO: config.chainId - hardcoding elastos mainnet for now

  constructor() {
    super();
    console.log("Creating an InAppBrowserWeb3Provider");
    this.emitConnect(this.chainId);
  }

  public setAddress(address: string) {
    const lowerAddress = (address || "").toLowerCase();
    this.address = lowerAddress;
    this.ready = !!address;
    /* for (var i = 0; i < window.frames.length; i++) {
      const frame = window.frames[i];
      if (frame.ethereum && frame.ethereum.isTrust) {
        frame.ethereum.address = lowerAddress;
        frame.ethereum.ready = !!address;
      }
    } */
  }

  public setRPCApiEndpoint(endpoint: string) {
    this.rpcApiEndpoint = endpoint;
  }

  public getRPCApiEndpoint(): string {
    return this.rpcApiEndpoint;
  }

  public request(payload: JsonRpcPayload) {
    return this._request(payload, false);
  }

  /**
   * @deprecated Use request() method instead.
   */
  public sendAsync(payload: JsonRpcPayload, callback: (error: Error, result?: JsonRpcResponse) => void) {
    this._request(payload)
      .then((data) => callback(null, data))
      .catch((error) => callback(error, null));
  }

  /**
   * @private Internal rpc handler
   */
   private _request(payload: JsonRpcPayload, wrapResult = true): Promise<JsonRpcResponse> {
    console.log("InAppBrowserWeb3Provider: _request", payload);

    this.idMapping.tryIntifyId(payload);
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      if (!payload.id) {
        payload.id = Utils.genId();
      }
      this.callbacks.set(payload.id, (error, data) => {
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
          this.callbacks.delete(payload.id);
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

  private eth_coinbase() {
    return this.address;
  }

  private net_version() {
    return this.chainId.toString(10) || null;
  }

  private eth_chainId() {
    return "0x" + this.chainId.toString(16);
  }

  private eth_sign(payload) {
    const buffer = Utils.messageToBuffer(payload.params[1]);
    const hex = Utils.bufferToHex(buffer);
    // TODO: unclear why this is a "personal message" if the buffer is utf8...
    /* if (isUtf8(buffer)) {
      this.postMessage("signPersonalMessage", payload.id, { data: hex });
    } else {
      this.postMessage("signMessage", payload.id, { data: hex });
    } */
  }

  private personal_sign(payload) {
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

  private personal_ecRecover(payload) {
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

  private eth_sendTransaction(payload) {
    this.postMessage("signTransaction", payload.id, payload.params[0]);
  }

  private eth_requestAccounts(payload) {
    this.postMessage("requestAccounts", payload.id, {});
  }

  private wallet_watchAsset(payload) {
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
    console.log("InAppBrowserWeb3Provider: postMessage", handler, data);
    if (this.ready || handler === "requestAccounts") {
      let object = {
        id: id,
        name: handler,
        object: data,
      };
      // TODO: Need to understand where "window.trustwallet" is injected (probably by the essentials code)
      // and if we need to support the "old client" flow or not.
      /* if (window.trustwallet.postMessage) {
        window.trustwallet.postMessage(object);
      } else {
        // old clients
        window.webkit.messageHandlers[handler].postMessage(object);
      } */
    } else {
      this.sendError(id, new ProviderRpcError(4100, "Provider is not ready"));
    }
  }

  /**
   * Internal native result -> js
   */
  private sendResponse(id: string | number, result: JsonRpcResponse | unknown): void {
    console.log("InAppBrowserWeb3Provider: sendResponse", result);

    let originId = this.idMapping.tryPopId(id) || id;
    let callback = this.callbacks.get(id);
    let wrapResult = this.wrapResults.get(id);
    let data: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: originId
    };

    if (typeof result === "object" && "jsonrpc" in result && "result" in result) {
      // result is a JsonRpcResponse
      data.result = (result as JsonRpcResponse).result;
    } else {
      // result is the JsonRpcResponse result
      data.result = result;
    }

    if (callback) {
      wrapResult ? callback(null, data) : callback(null, result);
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
    console.log(`<== ${id} sendError ${error}`);
    let callback = this.callbacks.get(id);
    if (callback) {
      callback(error instanceof Error ? error : new Error(error), null);
      this.callbacks.delete(id);
    }
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
            console.log("Ethereum JSON RPC call result:", result, "for payload:", payload);
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

window["InAppBrowserWeb3Provider"] = InAppBrowserWeb3Provider;