import { MemoryDatastore } from "interface-datastore"
import { ShimDatastore } from "./shim"

describe("ShimDatastore", () => {
  describe("interface-datastore", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("interface-datastore/src/tests")({
      setup() {
        return new ShimDatastore(new MemoryDatastore())
      },
      teardown() {
        return
      },
    })
  })
})
