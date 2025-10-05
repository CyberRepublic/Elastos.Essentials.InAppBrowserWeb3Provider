import EventEmitter from 'events';
import isUtf8 from 'isutf8';
import { AbstractProvider } from 'web3-core';
import { JsonRpcPayload, JsonRpcResponse } from 'web3-core-helpers';
import { ProviderRpcError } from '../providerrpcerror';
import { Utils } from '../utils';
import { IdMapping } from './ids';

type JsonRpcCallback = (error: Error | null, result?: JsonRpcResponse) => void;

/**
 * Internal web3 provider injected into Elastos Essentials' in app browser dApps and bridging
 * requests from dApps to Essentials (send transaction, etc).
 *
 * Source code inspired by the Trust Wallet provider (https://github.com/trustwallet/trust-web3-provider/blob/master/src/index.js).
 */
class DappBrowserWeb3Provider extends EventEmitter implements AbstractProvider {
  private address: string = null;
  private ready: boolean = false;
  private idMapping = new IdMapping(); // Helper class to create and retrieve payload IDs for requests and responses.
  private callbacks = new Map<string | number, JsonRpcCallback>();
  private wrapResults = new Map<string | number, boolean>();

  private _chainId: number; // decimal version of the chain ID
  public get chainId(): string {
    return '0x' + this._chainId.toString(16);
  }

  public set chainId(_chainId: string) {
    throw new Error('Property chainId cannot be set');
  }

  private rpcUrls: { [chainID: number]: string } = {
    // List of chainId -> rpcUrl set by Essentials.
  };

  constructor(chainId: number, rpcUrl: string, address: string) {
    super();
    console.log('Creating an Essentials DappBrowserWeb3Provider', chainId, rpcUrl, address);

    this.address = address;
    this._chainId = chainId;
    this.ready = !!(this._chainId && this.address);

    if (chainId) {
      this.setRPCApiEndpoint(chainId, rpcUrl);
    }

    if (this.ready) {
      this.emitConnect(chainId);
    }
  }

  /**
   * Sets the active wallet chain ID and informs listeners about the change.
   */
  public setChainId(chainId: number) {
    this._chainId = chainId;
    this.ready = !!(this._chainId && this.address);

    console.log('Setting chain ID to:', this._chainId);

    // EIP1193 SPEC:
    // - networkChanged will emit the network ID as a decimal string
    // - chainChanged will emit the chain ID as a hexadecimal string
    this.emit('chainChanged', '0x' + Number(this._chainId).toString(16));
    this.emit('networkChanged', Number(this._chainId).toString(10));
  }

  /**
   * Sets the active wallet address and informs listeners about the change.
   */
  public setAddress(address: string) {
    // Handle null/undefined values properly
    const normalizedAddress = address ?? '';
    const lowerAddress = normalizedAddress.toLowerCase();
    const wasConnected = !!(this.address && this.address.trim() !== '');
    const isNowConnected = !!(lowerAddress && lowerAddress.trim() !== '');

    this.address = lowerAddress;
    this.ready = !!(this._chainId && this.address && this.address.trim() !== '');

    console.log('Setting address to:', address, 'normalized to:', lowerAddress);

    // Emit accountsChanged with the appropriate accounts array
    const accounts = this.address && this.address.trim() !== '' ? [this.address] : [];
    this.emit('accountsChanged', accounts);

    // Emit disconnect event if wallet was connected but now disconnected
    if (wasConnected && !isNowConnected) {
      console.log('Wallet disconnected - emitting disconnect event');
      this.emit('disconnect', { code: 4900, message: 'The provider has been disconnected from the wallet' });
    }
  }

  // Backward compatibility with some dapps.
  public get selectedAddress(): string {
    return this.address;
  }

  public setRPCApiEndpoint(chainId: number, rpcUrl: string) {
    this.rpcUrls[chainId] = rpcUrl;
  }

  private getRPCApiEndpoint(): string {
    if (!(this._chainId in this.rpcUrls)) throw new Error('RPC URL not set for chain ID' + this._chainId);

    return this.rpcUrls[this._chainId];
  }

  public isConnected(): boolean {
    console.log('web3 provider isConnected TRUE', this.address);
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
  }

  /**
   * @deprecated Use request() method instead.
   * https://docs.metamask.io/guide/ethereum-provider.html#legacy-methods
   */
  public send(requestOrMethod: JsonRpcPayload | string, callbackOrParams: JsonRpcCallback | Array<any>) {
    if (typeof requestOrMethod === 'string') {
      const method = requestOrMethod;
      const params = Array.isArray(callbackOrParams)
        ? callbackOrParams
        : callbackOrParams !== undefined
        ? [callbackOrParams]
        : [];
      const request: JsonRpcPayload = {
        jsonrpc: '2.0',
        id: 0,
        method,
        params
      };
      // Call _request() to wrap result into a JsonRpcResponse
      return this._request(request).then(res => res.result);
    }
    // send(JSONRPCRequest | JSONRPCRequest[], callback): void
    if (typeof callbackOrParams === 'function') {
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
    if (!(this instanceof DappBrowserWeb3Provider)) {
      that = (window as any).ethereum;
    }

    that
      ._request(payload)
      .then(data => callback(null, data))
      .catch(error => callback(error, null));
  }

  /**
   * Internal request handler that receives JsonRpcPayloads and returns JsonRpcResponses.
   */
  private _request(payload: JsonRpcPayload, wrapResult = true): Promise<JsonRpcResponse> {
    //console.log("InAppBrowserWeb3Provider: _request", payload);

    this.idMapping.tryIntifyId(payload);
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      if (!payload.jsonrpc) {
        payload.jsonrpc = '2.0';
      }
      if (!payload.id) {
        payload.id = Utils.genId();
      }
      this.callbacks.set(payload.id as any, (error, data) => {
        if (error) {
          console.log('InAppBrowserWeb3Provider: _request error', error);
          reject(error);
        } else {
          resolve(data);
        }
      });
      this.wrapResults.set(payload.id, wrapResult);

      switch (payload.method) {
        case 'eth_accounts':
          return this.sendResponse(payload.id, this.eth_accounts());
        case 'eth_coinbase':
          return this.sendResponse(payload.id, this.eth_coinbase());
        case 'net_version':
          return this.sendResponse(payload.id, this.net_version());
        case 'eth_chainId':
          return this.sendResponse(payload.id, this.eth_chainId());
        case 'eth_sign':
          return this.eth_sign(payload);
        case 'personal_sign':
          return this.personal_sign(payload);
        case 'personal_ecRecover':
          return this.personal_ecRecover(payload);
        case 'eth_signTypedData_v3':
          return this.eth_signTypedData(payload, false);
        case 'eth_signTypedData':
        case 'eth_signTypedData_v4':
          return this.eth_signTypedData(payload, true);
        case 'eth_sendTransaction':
          return this.eth_sendTransaction(payload);
        case 'eth_requestAccounts':
          return this.eth_requestAccounts(payload);
        case 'wallet_watchAsset':
          return this.wallet_watchAsset(payload);
        case 'wallet_switchEthereumChain':
          return this.wallet_switchEthereumChain(payload);
        case 'wallet_addEthereumChain':
          return this.wallet_addEthereumChain(payload);
        case 'eth_newFilter':
        case 'eth_newBlockFilter':
        case 'eth_newPendingTransactionFilter':
        case 'eth_uninstallFilter':
        case 'eth_subscribe':
          throw new ProviderRpcError(4200, `Elastos Essentials does not support the ${payload.method} method.`);
        default:
          // call upstream rpc
          this.callbacks.delete(payload.id as any);
          this.wrapResults.delete(payload.id);

          this.callJsonRPC(payload)
            .then(response => {
              wrapResult ? resolve(response) : resolve(response.result);
            })
            .catch(e => {
              console.log('callJsonRPC catched');
              reject(e);
            });
      }
    });
  }

  private emitConnect(chainId: number) {
    console.log('InAppBrowserWeb3Provider: emitting connect', chainId);
    this.emit('connect', { chainId: chainId });
  }

  private eth_accounts(): string[] {
    return this.address && this.address.trim() !== '' ? [this.address] : [];
  }

  private eth_coinbase(): string {
    return this.address && this.address.trim() !== '' ? this.address : null;
  }

  private net_version(): string {
    return this._chainId.toString(10) || null;
  }

  private eth_chainId(): string {
    return '0x' + this._chainId.toString(16);
  }

  private eth_sign(payload: JsonRpcPayload) {
    const buffer = Utils.messageToBuffer(payload.params[1]);
    const hex = Utils.bufferToHex(buffer);

    /**
     * Historically eth_sign can either receive:
     * - a very insecure raw message (hex) - supported by metamask
     * - a prefixed message (utf8) - standardized implementation
     *
     * So we detect the format here:
     * - if that's a utf8 prefixed string -> eth_sign = personal_sign
     * - if that's a buffer (insecure hex that could sign any transaction) -> insecure eth_sign screen
     */
    if (isUtf8(buffer)) {
      this.postMessage('personal_sign', payload.id, { data: hex });
    } else {
      this.postMessage('signInsecureMessage', payload.id, { data: hex });
    }
  }

  private personal_sign(payload: JsonRpcPayload) {
    const message = payload.params[0];
    const buffer = Utils.messageToBuffer(message);
    if (buffer.length === 0) {
      // hex it
      const hex = Utils.bufferToHex(message);
      this.postMessage('personal_sign', payload.id, { data: hex });
    } else {
      this.postMessage('personal_sign', payload.id, { data: message });
    }
  }

  private personal_ecRecover(payload: JsonRpcPayload) {
    this.postMessage('ecRecover', payload.id, {
      signature: payload.params[1],
      message: payload.params[0]
    });
  }

  private eth_signTypedData(payload, useV4) {
    this.postMessage('eth_signTypedData', payload.id, {
      payload: payload.params[1],
      useV4
    });
  }

  private eth_sendTransaction(payload: JsonRpcPayload) {
    this.postMessage('eth_sendTransaction', payload.id, payload.params[0]);
  }

  private eth_requestAccounts(payload: JsonRpcPayload) {
    this.postMessage('eth_requestAccounts', payload.id, {});
  }

  private wallet_watchAsset(payload: /* JsonRpcPayload */ any) {
    let options = payload.params.options;
    this.postMessage('wallet_watchAsset', payload.id, {
      type: payload.type,
      contract: options.address,
      symbol: options.symbol,
      decimals: options.decimals || 0
    });
  }

  private wallet_switchEthereumChain(payload: JsonRpcPayload) {
    this.postMessage('wallet_switchEthereumChain', payload.id, payload.params[0]);
  }

  private wallet_addEthereumChain(payload: JsonRpcPayload) {
    this.postMessage('wallet_addEthereumChain', payload.id, payload.params[0]);
  }

  /**
   * Internal js -> native message handler
   */
  private postMessage(handler: string, id: string | number, data: unknown) {
    //console.log("InAppBrowserWeb3Provider: postMessage", handler, id, data);

    if (this.ready || handler === 'eth_requestAccounts') {
      let object = {
        id: id,
        name: handler,
        object: data
      };
      (window as any).webkit.messageHandlers.essentialsExtractor.postMessage(JSON.stringify(object));
    } else {
      this.sendError(id, new ProviderRpcError(4100, 'Provider is not ready'));
    }
  }

  /**
   * Internal native result -> js
   */
  private sendResponse(id: string | number, result: unknown): void {
    let originId = this.idMapping.tryPopId(id) || id;
    let callback = this.callbacks.get(id);
    let wrapResult = this.wrapResults.get(id);
    let data: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: originId
    };

    data.result = result;

    if (callback) {
      wrapResult ? callback(null, data) : callback(null, result as any);
      this.callbacks.delete(id);
    } else {
      console.log(`callback id: ${id} not found`);
    }
  }

  /**
   * Internal native error -> js
   */
  private sendError(id: string | number, error: Error | string | object) {
    let callback = this.callbacks.get(id);
    if (callback) {
      if (error instanceof Error) callback(error);
      else if (typeof error === 'object' && 'code' in error)
        callback(new ProviderRpcError((error as any)['code'], error['message']));
      else callback(new Error(`${error}`));
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
            console.log('JSON RPC call result:', result, 'for payload:', payload);

            const response = JSON.parse(result) as JsonRpcResponse;
            if (response.error) {
              reject(response.error);
            } else {
              resolve(response);
            }
          } catch (e) {
            console.log('JSON parse error');
            reject('Invalid JSON response returned by the JSON RPC');
          }
        }
      };

      request.ontimeout = function () {
        reject('Timeout');
      };

      request.onerror = function (error) {
        console.error('RPC call error');
        reject(error);
      };

      try {
        request.send(JSON.stringify(payload));
      } catch (error) {
        reject('Connection error');
      }
    });
  }
}

// Expose this class globally to be able to create instances from the browser dApp.
window['DappBrowserWeb3Provider'] = DappBrowserWeb3Provider;
