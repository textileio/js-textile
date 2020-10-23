import log from 'loglevel'
import { SignupRequest   } from '@textile/hub-grpc/hub_pb'

const logger = log.getLogger('admin')

export class Admin {

  async print() {
    return signUp()
  }
}
