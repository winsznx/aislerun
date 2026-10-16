import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { x402ResourceServer } from "@x402/express";

export interface PaymentSettings {
  network: "eip155:8453";
  facilitatorUrl: string;
  receiver: string;
  priceUsd: string;
}

export function createResourceServer(settings: PaymentSettings): x402ResourceServer {
  const facilitator = new HTTPFacilitatorClient({ url: settings.facilitatorUrl });
  return new x402ResourceServer(facilitator).register(settings.network, new ExactEvmScheme());
}

export function paidAccepts(settings: PaymentSettings) {
  return {
    scheme: "exact" as const,
    price: `$${settings.priceUsd}`,
    network: settings.network,
    payTo: settings.receiver,
    maxTimeoutSeconds: 120,
  };
}
