# 手写 Promise

> https://promisesaplus.com/
> https://vitest.dev/guide/

使用 TDD 的模式，基于 Promise 规范与具体功能点，实现简化版本的 MyPromise

## 1 什么是 Promise

解决回调地狱和异步处理不统一的问题

Promise A+ 规范定义：**一个对象或函数，具有符合 Promise A+ 规范的 then 方法，就是一个 Promise**

ES6 的 Promise 在满足 Promise A+ 规范的基础上，提供了额外的例如 `.catch`、`.finnally`、`Promise.all`、`Promise.resolve` 等功能

## 2 构造函数

### 2.1 功能点

- Promise 实例化时接受一个函数

```js
it('Promise 实例化时接受一个函数', () => {
  assert.throw(() => new MyPromise(1))
  assert.throw(() => new MyPromise())
})
```

- Promise 实例化传递的函数参数立即执行

```js
it('Promise 实例化传递的函数参数立即执行', () => {
  const fn = vi.fn()
  new MyPromise(fn)
  assert.notEqual(fn.mock.lastCall, undefined)
})
```

- Promise 实例对象在执行时，接收 resolve 和 reject 两个函数作为参数

```js
it('Promise 接收的函数在执行时，内部接收 resolve 和 reject 两个函数作为参数', () => {
  const fn = vi.fn()
  new MyPromise(fn)
  const args = fn.mock.calls[0]
  assert.isFunction(args[0])
  assert.isFunction(args[1])
})
```

- resolve 和 rejected 函数接收返回值并修改 Promise 的状态
  - 注意 resolve 和 rejected 的 this 指向

```js
it('resolve 和 rejected 函数接收返回值并修改 Promise 的状态', () => {
  const p1 = new MyPromise((resolve) => {
    resolve(1)
  })
  assert.equal(p1.state, 'fulfilled')
  assert.equal(p1.result, 1)
  const p2 = new MyPromise((_, reject) => {
    reject("reason")
  })
  assert.equal(p2.state, 'rejected')
  assert.equal(p2.result, "reason")
})
```

- 函数执行时报错（同步错误），则 Promise 的状态改为 rejected

```js
 it('函数执行时报错（同步错误），则 Promise 的状态改为 rejected', () => {
  const p = new MyPromise(() => {
    throw "error"
  })
  assert.equal(p.state, 'rejected')
  assert.equal(p.result, "error")
})
```

- Promise 实例的状态一旦确定，不允许再次改变

```js
it('Promise 实例的状态一旦确定，不允许再次改变', () => {
  const p = new MyPromise((resolve, reject) => {
    resolve(1)
    reject('error')
  })
  assert.equal(p.state, 'fulfilled')
  assert.equal(p.result, 1)
})
```

### 2.2 实现

```ts
const FULFILLED = 'fulfilled'
const PENDING = 'pending'
const REJECTED = 'rejected'

export class MyPromise {
  state: 'pending' | 'fulfilled' | 'rejected' = PENDING
  result = undefined
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
  }
  reject(reason: any) {
    if (this.state !== PENDING) return
    this.result = reason
    this.state = REJECTED
  }
}
```

## 3 then 实现逻辑

### 3.1 功能点

- Promise 实例对象具有 then 方法，then 方法接受两个函数作为可选参数

```js
it('Promise 实例对象具有 then 方法, then 方法接受两个函数作为可选参数', () => {
  const p = new MyPromise(() => { })
  assert.isFunction(p.then)
})
```

- then 方法的返回值是一个 Promise

```js
it('then 方法的返回值是一个 Promise', () => {
  const p = new MyPromise(() => { })
  assert.instanceOf(p.then(), MyPromise)
})
```

- then 方法中的回调会在 resolve 或 reject 被调用后（状态变更后）执行
  - 当方法为异步执行时，需要将状态处理函数 onFulfilled 与 onRejected 以及当前 then 返回的 Promise 中的 resolve 和 reject 单独维护起来
  - 当方法一段时间后获取到了结果，再取出四个处理函数，按状态逻辑调用即可
  - 将以上执行 onFulfilled 与 onRejected 的过程抽离到另外一个函数 run 中，在状态发生变更时使用
  - 所以 then 方法只负责记录四个状态处理函数，并手动调用一次 run 方法

```js
it('[sync]then 方法中的回调会在 resolve 或 reject 被调用后（状态变更后）执行', () => {
  const onFulfilled1 = vi.fn()
  const onRejected1 = vi.fn()
  const p1 = new MyPromise((resolve) => {
    resolve()
  })
  p1.then(onFulfilled1, onRejected1)
  assert.isArray(onFulfilled1.mock.lastCall)
  assert.isUndefined(onRejected1.mock.lastCall)
  const onFulfilled2 = vi.fn()
  const onRejected2 = vi.fn()
  const p2 = new MyPromise((_, reject) => {
    reject()
  })
  p2.then(onFulfilled2, onRejected2)
  assert.isUndefined(onFulfilled2.mock.lastCall)
  assert.isArray(onRejected2.mock.lastCall)
})
it('[async]then 方法中的回调会在 resolve 或 reject 被调用后（状态变更后）执行', async () => {
  const onFulfilled1 = vi.fn()
  const onRejected1 = vi.fn()
  const p1 = new MyPromise((resolve) => {
    setTimeout(() => {
      resolve(1)
    }, 100)
  })
  p1.then(onFulfilled1, onRejected1);
  await new Promise(resolve => setTimeout(resolve, 200))
  expect(onFulfilled1).toHaveBeenCalled()
  expect(onFulfilled1).toHaveBeenCalledWith(1) 
  expect(onRejected1).not.toHaveBeenCalled()
})
```

- 如果 then 的参数不是函数，则忽略

```js
it('如果 then 的参数不是函数，则忽略', () => {
  const p = new MyPromise((resolve) => {
    resolve(1)
  })
  // @ts-ignore
  p.then(1, 2)
})
```

- then 可以在同一个 promise 中多次调用，且依据 then 的顺序调用
  - 所以负责记录状态处理函数的变量，应该采用数组，每调用一次 then，就将处理函数放入数组中

```js
it('then 可以在同一个 promise 中多次调用，且依据 then 的顺序调用', () => {
  const onFulfilled1 = vi.fn()
  const onFulfilled2 = vi.fn()
  const onFulfilled4 = vi.fn()
  const onRejected = vi.fn()
  const p = new MyPromise((resolve) => {
    resolve(1)
  })
  p.then(onFulfilled1, onRejected)
  p.then(onFulfilled2, onRejected)
  // @ts-ignore
  p.then(1, onRejected)
  p.then(onFulfilled4, onRejected)

  expect(onFulfilled1).toHaveBeenCalledWith(1)  
  expect(onFulfilled2).toHaveBeenCalledWith(1)
  expect(onFulfilled4).toHaveBeenCalledWith(1)
  expect(onRejected).not.toHaveBeenCalled()
})
```

### 3.2 实现

```ts
const FULFILLED = 'fulfilled'
const PENDING = 'pending'
const REJECTED = 'rejected'

export class MyPromise {
  state: 'pending' | 'fulfilled' | 'rejected' = PENDING
  result = undefined
  callbacks: {
    onFulfilled?: Function
    onRejected?: Function
    resolve?: Function
    reject?: Function
  }[] = []

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

  run() {
    if (this.state === PENDING) return
    while (this.callbacks.length) {
      const { onFulfilled, onRejected, resolve, reject } = this.callbacks.shift()
      if (this.state === FULFILLED) {
        onFulfilled?.(this.result)
      } else {
        onRejected?.(this.result)
      }
    }
  }

  then(onFulfilled?: Function, onRejected?: Function) {
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
```

## 4 then 返回值

下面开始处理 then 方法的 resolve 和 reject 执行逻辑，以及一些特殊情况

### 4.1 功能点

- 当 onFulfilled onRejected 回调不是函数时
  - 暗含的意思是对当前 promise 不做处理，可能会留给下一次？
  - 所以此时 then 方法返回的新 promise 直接使用当前 promise 的结果 
  - 即直接调用新 promise 的 resolve 或 reject ，以当前 promise 实例的数据来更新新的 promise 状态

```js
it('then 方法的 onFulfilled onRejected 参数不是函数时，then 方法返回的新 promise 的结果与当前的 promise 保持一致', () => {
  const p = new MyPromise((resolve) => {
    resolve('p的结果')
  })
  // expect(p.then(123).result).eql('p的结果')
  // expect(p.then(() => { }).result).eq(undefined)

  p.then(123).then(result => {
    expect(result).eq('p的结果')
  })
  p.then(() => { }).then(result => {
    expect(result).eq(undefined)
  })
})
```

- 当 onFulfilled onRejected 函数执行过程中报错了，则直接 reject

```js
it('当 onFulfilled onRejected 回调是函数时，如果执行报错了，则直接 reject', () => {
  const onFulfilled2 = vi.fn()
  const onRejected2 = vi.fn()
  const p = new MyPromise((resolve) => { resolve(1) })
  const errorFulfilled = () => {
    throw 123
  }
  p.then(errorFulfilled).then(onFulfilled2, onRejected2)
  expect(onFulfilled2).not.toBeCalled()
  expect(onRejected2).toBeCalledWith(123)
})
```

- 当 onFulfilled onRejected 函数有返回结果，则将新的结果作为下一次链式调用 then 的结果
  - 即将新的结果作为本次 then 返回的 promise 的结果

```ts
it('当 onFulfilled onRejected 函数有返回结果，则作为下一次链式调用 then 的结果', () => {
  const onFulfilled = (result: number) => {
    return result + 1
  }
  const p = new MyPromise((resolve) => { resolve(1) })
  return p.then(onFulfilled).then((result) => {
    expect(result).eq(2)
  })
})
```

- 当 onFulfilled onRejected 函数的返回结果是一个 Promise，则当前的 then 成功与失败的结果取决于这个返回的 promise
  - 将 reject 和 resolve 直接作为这个 promise 的 then 的处理函数

```ts
it('当 onFulfilled onRejected 函数的返回结果是一个 Promise，则当前的 then 成功与失败的结果取决于这个返回的 promise', () => {
  const onFulfilled = (result: number) => {
    return new MyPromise((resolve) => {resolve(result + 1)})
  }
  const p = new MyPromise((resolve) => { resolve(1) })
  return p.then(onFulfilled).then((result) => {
    expect(result).eq(2)
  })
})
```

### 4.2 实现

```ts
const FULFILLED = 'fulfilled'
const PENDING = 'pending'
const REJECTED = 'rejected'

export class MyPromise {
  state: 'pending' | 'fulfilled' | 'rejected' = PENDING
  result = undefined
  callbacks: {
    onFulfilled: Function | undefined
    onRejected: Function | undefined
    resolve: Function
    reject: Function
  }[] = []

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

  run() {
    if (this.state === PENDING) return
    while (this.callbacks.length > 0) {
      const callback = this.callbacks.shift()
      if (!callback) continue
      const { onFulfilled, onRejected, resolve, reject } = callback

      if (this.state === FULFILLED) {
        if (onFulfilled) {
          try {
            const data = onFulfilled(this.result)
            if (isPromiseLike(data)) {
              data.then(resolve, reject)
            } else {
              resolve(data)
            }
          } catch (error) {
            reject(error)
          }
        } else {
          resolve(this.result)
        }
      } else {
        if (onRejected) {
          try {
            const data = onRejected(this.result)
            if (isPromiseLike(data)) {
              data.then(resolve, reject)
            } else {
              resolve(data)
            }
          } catch (error) {
            reject(error)
          }
        } else {
          reject(this.result)
        }
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
```

### 4.3 优化

- 代码逻辑抽离，将 runOne 逻辑放入微队列中执行

- 将状态等变量私有化

```ts
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
  private state: 'pending' | 'fulfilled' | 'rejected' = PENDING
  private result = undefined
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
```

## 5 辅助函数

### 5.1 PromiseLike

根据 Promise A+ 规范，一行代码搞定

```ts
function isPromiseLike(p: any): boolean {
  return p && typeof p.then === 'function'
}
```

### 5.2 函数进入微队列

区分不同环境与不同浏览器版本

```ts
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
```

在运行函数放入微队列后，我们在测试中的代码涉及到异步的断言都要使用延时大法重写，以保证在微队列任务执行完毕后再断言
