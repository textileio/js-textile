/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from "chai";
import { getToken, getTokenChallenge } from "./grpc";
import { PrivateKey } from "@textile/crypto";

const opts = {
  serviceHost: "http://127.0.0.1:6007",
};

describe("grpc", function () {
  describe("authenticate", async function () {
    it("should return a valid token from getToken", async function () {
      const privateKey = PrivateKey.fromRandom();
      const token = await getToken(privateKey, opts);
      expect(token).to.not.be.undefined;
    });

    it("should return a valid token from getTokenChallenge", async function () {
      const privateKey = PrivateKey.fromRandom();
      const token = await getTokenChallenge(
        privateKey.public.toString(),
        async (challenge: Uint8Array) => {
          return privateKey.sign(challenge);
        },
        opts
      );
      expect(token).to.not.be.undefined;
    });
  });
});
