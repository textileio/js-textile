/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as pack from '../package.json'
import { ThreadsConfig } from './ThreadsConfig'
import {Client, Where} from '@textile/threads-client'

export { ThreadsConfig }

export type APIConfig = {
  token: string
  deviceId: string
  dev?: boolean
  scheme?: string
  authApi?: string
  authPort?: number
  threadApiScheme?: string
  threadsApi?: string
  threadsPort?: number
}
export class API {
  /**
   * version is the release version.
   */
  public static version(): string {
    return pack.version
  }

  /**
   * threadsConfig is the (private) threads config.
   */
  private _threadsConfig: ThreadsConfig

  private client?: Client

  constructor(config: APIConfig) {
    // prettier-ignore
    this._threadsConfig =
      config.dev === true
        ? new ThreadsConfig(
          config.token,
          config.deviceId,
          true,
          config.scheme !== (null || undefined) ? config.scheme : 'http',
          config.authApi !== (null || undefined) ? config.authApi : '127.0.0.1',
          config.authPort !== (null || undefined) ? config.authPort : 8006,
          config.threadApiScheme !== (null || undefined) ? config.threadApiScheme : 'http',
          config.threadsApi !== (null || undefined) ? config.threadsApi : '127.0.0.1',
          config.threadsPort !== (null || undefined) ? config.threadsPort : 6007,
        )
        : new ThreadsConfig(
          config.token,
          config.deviceId,
          false,
          config.scheme !== (null || undefined) ? config.scheme : 'https',
          config.authApi !== (null || undefined) ? config.authApi : 'cloud.textile.io',
          config.authPort !== (null || undefined) ? config.authPort : 443,
          config.threadApiScheme !== (null || undefined) ? config.threadApiScheme : 'https',
          config.threadsApi !== (null || undefined) ? config.threadsApi : 'api.textile.io',
          config.threadsPort !== (null || undefined) ? config.threadsPort : 6447,
        )
  }

  async start(sessionId?: string) {
    await this._threadsConfig.start(sessionId)
    this.client = new Client(this._threadsConfig)
    return this
  }

  get sessionId(): string | undefined {
    return this._threadsConfig.sessionId
  }

  get threadsConfig(): ThreadsConfig {
    return this._threadsConfig
  }

  async getConfigValue(name: string, scope: string = "prod") {
    const configStoreId = this._threadsConfig.configStoreId!
    const projectId = this._threadsConfig.projectId!
    console.log("PROJECT ID", projectId, configStoreId)
    const query = new Where("ProjectID").eq(projectId).and("Name").eq("endpoint")

    const result = await this.client!.modelFind(configStoreId, "Config", query)
    return result.entitiesList[0].Values[scope]
  }

  async watchConfigValue(name: string, handler: (value: any) => void, scope: string = "prod") {
    const configStoreId = this._threadsConfig.configStoreId!
    const projectId = this._threadsConfig.projectId!
    console.log("PROJECT ID", projectId, configStoreId)
    const query = new Where("ProjectID").eq(projectId).and("Name").eq("endpoint")

    const result = await this.client!.modelFind(configStoreId, "Config", query)
    const entity = result.entitiesList[0]
    handler(entity.Values[scope])

    return this.client!.listen(configStoreId, "", entity.ID, (data, error) => {
      if (!error) {
        handler(data!.entity.Values[scope])
      }
    })
  }
}

// eslint-disable-next-line import/no-default-export
export default API
