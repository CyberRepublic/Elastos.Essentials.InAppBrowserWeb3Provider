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
}

export type Request = {
  message: DABMessagePayload;
  resolver: (result: any) => void;
  rejecter: (error: Error) => void;
}

export type GetAddressesRequestPayload = {
  count: number;
  type: AddressType;
  index: number;
}