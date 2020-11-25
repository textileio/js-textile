import { protocols } from "multiaddr"

protocols.codes[406] = {
  code: 406,
  size: -1,
  name: "thread",
  resolvable: false,
  path: false,
}

protocols.names["thread"] = {
  code: 406,
  size: -1,
  name: "thread",
  resolvable: false,
  path: false,
}
;(protocols.table as Array<any>).push([406, -1, "thead"])

export { protocols }
