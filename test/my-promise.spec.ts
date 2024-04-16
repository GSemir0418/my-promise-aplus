import { assert, describe, expect, it, vi } from 'vitest'
import { MyPromise } from '../src/my-promise'

describe('Promise Constructor', () => {
  it('Promise 实例化时接受一个函数', () => {
    // @ts-ignore
    assert.throw(() => new MyPromise(1))
    // @ts-ignore
    assert.throw(() => new MyPromise())
  })
  it('Promise 实例化传递的函数参数立即执行', () => {
    const fn = vi.fn()
    new MyPromise(fn)
    assert.notEqual(fn.mock.lastCall, undefined)
  })
  it('Promise 接收的函数在执行时，内部接收 resolve 和 reject 两个函数作为参数', () => {
    const fn = vi.fn()
    new MyPromise(fn)
    const args = fn.mock.calls[0]
    assert.isFunction(args[0])
    assert.isFunction(args[1])
  })
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
  it('函数执行时报错（同步错误），则 Promise 的状态改为 rejected', () => {
    const p = new MyPromise(() => {
      throw "error"
    })
    assert.equal(p.state, 'rejected')
    assert.equal(p.result, "error")
  })
  it('Promise 实例的状态一旦确定，不允许再次改变', () => {
    const p = new MyPromise((resolve, reject) => {
      resolve(1)
      reject('error')
    })
    assert.equal(p.state, 'fulfilled')
    assert.equal(p.result, 1)
  })
})

describe('Promise then', () => {
  it('Promise 实例对象具有 then 方法, then 方法接受两个函数作为可选参数', () => {
    const p = new MyPromise(() => { })
    assert.isFunction(p.then)
  })
  it('then 方法的返回值是一个 Promise', () => {
    const p = new MyPromise(() => { })
    assert.instanceOf(p.then(), MyPromise)
  })
  it('[sync]then 方法中的回调会在 resolve 或 reject 被调用后（状态变更后）执行', () => {
    const onFulfilled1 = vi.fn()
    const onRejected1 = vi.fn()
    const p1 = new MyPromise((resolve) => {
      resolve()
    })
    p1.then(onFulfilled1, onRejected1)
    // 放入微队列之后还没有被调用
    // 此时的 MyPromise 还不支持链式调用
    // 所以只能延时大法
    setTimeout(() => {
      assert.isArray(onFulfilled1.mock.lastCall)
      assert.isUndefined(onRejected1.mock.lastCall)
    }, 0)
    const onFulfilled2 = vi.fn()
    const onRejected2 = vi.fn()
    const p2 = new MyPromise((_, reject) => {
      reject()
    })
    p2.then(onFulfilled2, onRejected2)
    setTimeout(() => {
      assert.isUndefined(onFulfilled2.mock.lastCall)
      assert.isArray(onRejected2.mock.lastCall)
    }, 0)
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
    p.then(1, onRejected)
    p.then(onFulfilled4, onRejected)
    setTimeout(() => {
      expect(onFulfilled1).toHaveBeenCalledWith(1)
      expect(onFulfilled2).toHaveBeenCalledWith(1)
      expect(onFulfilled4).toHaveBeenCalledWith(1)
      expect(onRejected).not.toHaveBeenCalled()
    }, 0)
  })
})

describe('Promise then return', () => {
  it('then 方法的 onFulfilled onRejected 参数不是函数时，then 方法返回的新 promise 的结果与当前的 promise 保持一致', () => {
    const p = new MyPromise((resolve) => {
      resolve('p的结果')
    })
    setTimeout(() => {
      expect(p.then(123).result).eql('p的结果')
      expect(p.then(() => { }).result).eq(undefined)
    }, 10)

    p.then(123).then(result => {
      expect(result).eq('p的结果')
    })
    p.then(() => { }).then(result => {
      expect(result).eq(undefined)
    })
  })

  it('当 onFulfilled onRejected 函数执行过程中报错了，则直接 reject', () => {
    const onFulfilled2 = vi.fn()
    const onRejected2 = vi.fn()
    const p = new MyPromise((resolve) => { resolve(1) })
    const errorFulfilled = () => {
      throw 123
    }
    p.then(errorFulfilled).then(onFulfilled2, onRejected2)
    setTimeout(() => {
      expect(onFulfilled2).not.toBeCalled()
      expect(onRejected2).toBeCalledWith(123)
     },0)
  })

  it('当 onFulfilled onRejected 函数有返回结果，则作为下一次链式调用 then 的结果', () => {
    const onFulfilled = (result: number) => {
      return result + 1
    }
    const p = new MyPromise((resolve) => { resolve(1) })
    p.then(onFulfilled).then((result) => {
      expect(result).eq(2)
    })
  })
  
  it('当 onFulfilled onRejected 函数的返回结果是一个 Promise，则当前的 then 成功与失败的结果取决于这个返回的 promise', () => {
    const onFulfilled = (result: number) => {
      return new MyPromise((resolve) => {resolve(result + 1)})
    }
    const p = new MyPromise((resolve) => { resolve(1) })
    return p.then(onFulfilled).then((result) => {
      expect(result).eq(2)
    })
  })
})