/**
 * Types used to exchange messages with Essentials.
 */

import { DABMessagePayload } from "../dab-message";

export enum AddressType  {
  Normal_external = 'normal-external',
  Normal_internal = 'normal-internal',
  Owner = 'owner',
  CROwnerDeposit = 'cr-owner-deposit',
  OwnerDeposit = 'owner-deposit',
  OwnerStake = 'owner-stake',
  All = 'all'
}

export type Request = {
  message: DABMessagePayload;
  resolver: (result: any) => void;
  rejecter: (error: Error) => void;
}

export type GetMultiAddressesRequestPayload = {
  count: number;
  type: AddressType;
  index: number;
}

export type SignRequestPayload = {
  data: any;
}