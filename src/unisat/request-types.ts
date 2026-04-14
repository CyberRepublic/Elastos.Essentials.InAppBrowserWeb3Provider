/**
 * Types used to exchange messages with Essentials.
 */

import { DABMessagePayload } from "../dab-message";

export type Request = {
  message: DABMessagePayload;
  resolver: (result: any) => void;
  rejecter: (error: Error) => void;
}

export type SendBitcoinRequestPayload = {
  payAddress: string; // BTC address that receives the payment
  satAmount: number; // Number of sats to pay.
  satPerVB: number; // Integer number (not decimal)
}

export type SignBitcoinDataPayload = {
  rawData: string;
  type: string; // "ecdsa" | "schnorr"
}

/** UniSat-compatible `toSignInputs` entry for `signPsbt`. */
export type UnisatSignPsbtToSignInput = {
  index: number;
  address?: string;
  publicKey?: string;
  sighashTypes?: number[];
  disableTweakSigner?: boolean;
  useTweakedSigner?: boolean;
};

export type UnisatSignPsbtOptions = {
  autoFinalized?: boolean;
  toSignInputs?: UnisatSignPsbtToSignInput[];
};

export type SignBitcoinPsbtPayload = {
  psbtHex: string;
  options?: UnisatSignPsbtOptions;
};

export type PushTxParam = {
  rawtx: string; // rawTx to push
}