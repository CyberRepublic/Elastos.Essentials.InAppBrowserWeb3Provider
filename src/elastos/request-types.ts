/**
 * Types used to exchange messages with Essentials.
 */

import { DABMessagePayload } from "../dab-message";

export type Request = {
  message: DABMessagePayload;
  resolver: (result: any) => void;
  rejecter: (error: Error) => void;
}

export type GetAddressesRequestPayload = {
  index: number;
  count: number;
  internal: boolean;
}