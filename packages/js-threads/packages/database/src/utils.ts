import {
  ThreadInfo,
  EventHeader,
  ThreadID,
  Multiaddr,
  ThreadRecord,
  ThreadKey,
} from '@textile/threads-core'
import { Network } from '@textile/threads-network'
import { decodeBlock } from '@textile/threads-encoding'
import { keys } from 'libp2p-crypto'

const ed25519 = keys.supportedKeys.ed25519

export function decodeRecord<T = any>(rec: ThreadRecord, info: ThreadInfo) {
  if (!info.key || !rec.record) return // Don't have the right keys!
  const event = rec.record.block
  if (info.key.read === undefined) return
  const decodedHeader = decodeBlock<EventHeader>(event.header, info.key.read)
  const header = decodedHeader.decodeUnsafe()
  if (!header.key) return
  const decodedBody = decodeBlock<T>(event.body, header.key)
  return decodedBody.decode()
}

export async function createThread(
  network: Network,
  id: ThreadID = ThreadID.fromRandom(ThreadID.Variant.Raw, 32),
) {
  const threadKey = ThreadKey.fromRandom(true)
  // @todo: Let users/developers provide their own keys here.
  const logKey = await ed25519.generateKeyPair()
  return network.createThread(id, { threadKey, logKey })
}

export function threadAddr(hostAddr: Multiaddr, hostID: string, threadID: string) {
  const pa = new Multiaddr(`/p2p/${hostID}`)
  const ta = new Multiaddr(`/thread/${threadID}`)
  return hostAddr.encapsulate(pa.encapsulate(ta))
}

export interface CacheOptions {
  duration?: number
}

export function Cache(params: CacheOptions = {}) {
  const defaultValues: Partial<CacheOptions> = {
    duration: 3000,
  }

  params = {
    ...defaultValues,
    ...params,
  }

  let originalFunc: Function
  let value: any
  let cacheUntil: Date | undefined

  let funcType: string

  const cacheValue = (val: any, now: Date) => {
    cacheUntil = params.duration ? new Date(now.getTime() + params.duration) : undefined
    value = val
  }

  return function(_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    originalFunc = descriptor.value

    descriptor.value = function() {
      const now = new Date()
      if (value && cacheUntil && cacheUntil > now) {
        switch (funcType) {
          case 'promise':
            return Promise.resolve(value)
          default:
            return value
        }
      }

      const result = originalFunc.apply(this)

      if (result instanceof Promise) {
        funcType = 'promise'
        return result.then(value => {
          cacheValue(value, now)
          return value
        })
      } else {
        funcType = 'value'
        cacheValue(result, now)
        return result
      }
    }
  }
}
