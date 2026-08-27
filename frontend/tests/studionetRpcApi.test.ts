import { beforeEach, describe, expect, it, vi } from "vitest";

import handler from "../api/studionet-rpc";

type MockResponse = {
  body: unknown;
  headers: Record<string, string>;
  statusCode: number;
  json: (body: unknown) => void;
  send: (body: string) => void;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockResponse;
};

function response(): MockResponse {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    json(body: unknown) {
      this.body = body;
    },
    send(body: string) {
      this.body = body;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
}

describe("Studionet RPC proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("forwards browser-safe Studionet read calls through the server", async () => {
    vi.stubEnv("STUDIONET_RPC_URL", "https://studio.genlayer.com/api");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xf22f" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })));
    const res = response();

    await handler({ method: "POST", body: { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] } }, res);

    expect(fetch).toHaveBeenCalledWith("https://studio.genlayer.com/api", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toBe(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xf22f" }));
  });

  it("rejects wallet write RPC methods so signing still stays in the wallet provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = response();

    await handler({ method: "POST", body: { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [] } }, res);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "RPC method is not allowed through the read proxy" });
  });

  it("accepts JSON string request bodies from serverless runtimes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 7, result: [] }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })));
    const res = response();
    const body = JSON.stringify({ jsonrpc: "2.0", id: 7, method: "gen_call", params: [{ to: "0xabc" }] });

    await handler({ method: "POST", body }, res);

    expect(fetch).toHaveBeenCalledWith("https://studio.genlayer.com/api", expect.objectContaining({ body }));
    expect(res.statusCode).toBe(200);
  });
});
