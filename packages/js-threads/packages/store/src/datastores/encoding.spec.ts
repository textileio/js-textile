import { expect } from "chai"
import { Key, MemoryDatastore } from "interface-datastore"
import {
  CborEncoder,
  Encoder,
  EncodingDatastore,
  JsonEncoder,
} from "./encoding"

const encoders: Record<string, Encoder> = {
  cbor: CborEncoder,
}

describe("EncodingDatastore", () => {
  it("basic", async () => {
    const mStore = new MemoryDatastore()
    const store = new EncodingDatastore(mStore, JsonEncoder)
    const expected = {
      some: "random",
      properties: false,
      that: 123,
      should: Buffer.from("be fine"),
    }
    const key = new Key("test")
    await store.put(key, expected)
    const returned = await store.get(key)
    expect(expected).to.deep.equal(returned)
  })

  for (const [name, encoder] of Object.entries(encoders)) {
    describe(`interface-datastore: ${name}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("interface-datastore/src/tests")({
        setup() {
          return new EncodingDatastore(new MemoryDatastore(), encoder)
        },
        teardown() {
          return
        },
      })
    })
  }
})
