export function promise<U, V, W>(handler: (callback: (error: V | null, resp: U | null) => void) => void, mapper: (resp: U) => W): Promise<W> {
  return new Promise((resolve, reject) => {
    handler((err, resp) => {
      if (err) {
        reject(err)
      }
      if (!resp) {
        reject('empty response')
      } else {
        resolve(mapper(resp))
      }
    })
  })
}