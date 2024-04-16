const FULFILLED = 'fulfilled'
const PENDING = 'pending'
const REJECTED = 'rejected'

type Callback = {
  onFulfilled: Function | undefined
  onRejected: Function | undefined
  resolve: Function
  reject: Function
}

export class MyPromise {
  state: 'pending' | 'fulfilled' | 'rejected' = PENDING
  result = undefined
  private callbacks: Callback[] = []

  constructor(fn: Function) {
    if (typeof fn !== 'function') {
      throw new Error('must be a function')
    }
    try {
      fn(this.resolve.bind(this), this.reject.bind(this))
    } catch (err) {
      this.reject(err)
    }
  }

  resolve(data: any) {
    if (this.state !== PENDING) return
    this.result = data
    this.state = FULFILLED
    this.run()
  }

  reject(reason: any) {
    if (this.state !== PENDING) return
    this.result = reason
    this.state = REJECTED
    this.run()
  }

  private runOne(callback: Callback['onFulfilled'], resolve: Callback['resolve'], reject: Callback['reject']) {
    appendToMicroQueue(() => {
      if (callback) {
        try {
          const data = callback(this.result)
          if (isPromiseLike(data)) {
            data.then(resolve, reject)
          } else {
            resolve(data)
          }
        } catch (error) {
          reject(error)
        }
      } else {
        this.state === FULFILLED ? resolve(this.result) : reject(this.result)
      }
    })
  }

  private run() {
    if (this.state === PENDING) return
    while (this.callbacks.length > 0) {
      const callback = this.callbacks.shift()
      if (!callback) continue

      const { onFulfilled, onRejected, resolve, reject } = callback
      if (this.state === FULFILLED) {
        this.runOne(onFulfilled, resolve, reject)
      } else {
        this.runOne(onRejected, resolve, reject)
      }
    }
  }

  then(onFulfilled?: any, onRejected?: any) {
    return new MyPromise((resolve: Function, reject: Function) => {
      this.callbacks.push({
        onFulfilled: onFulfilled && typeof onFulfilled === 'function' ? onFulfilled : undefined,
        onRejected: onRejected && typeof onRejected === 'function' ? onRejected : undefined,
        resolve,
        reject
      })
      this.run()
    })
  }
}

function isPromiseLike(p: any): boolean {
  return p && typeof p.then === 'function'
}
function appendToMicroQueue(fn: Function) {
  // @ts-ignore
  if (process && typeof process.nextTick === 'function') {
    // @ts-ignore
    process.nextTick(fn)
  } else if (MutationObserver) {
    const m = new MutationObserver(fn as MutationCallback)
    const node = document.createTextNode('1')
    m.observe(node)
    node.data = '2'
    m.disconnect()
  } else {
    setTimeout(fn, 0)
  }
}