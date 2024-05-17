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

export type PushTxParam = {
  rawtx: string; // rawTx to push
}