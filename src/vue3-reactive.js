// Vue3 响应式原理

// 源对象 => 代理对象
let toProxy = new WeakMap()
// 代理对象 => 源对象
let toRaw = new WeakMap()
/**
 * @description 判断值类型是否为对象
 * @returns {Boolean}
 * @param {*} value
 */
function isObject(value) {
  return (typeof value === 'object' && value !== null)
}

/**
 * @description 响应式核心方法
 * @param {*} target
 */
function reactive(target) {
  return createReactiveObject(target)
}

/**
 * @description 判断对象是否有指定属性
 * @param {Object} target 源对象
 * @param {String} key 键
 */
function hasKey(target, key) {
  return target.hasOwnProperty(key)
}

/**
 * @description 创建响应式对象
 * @param {*} target
 */
function createReactiveObject(target) {
  if (!isObject(target)) {
    return target
  }
  // 防止同一对象多次代理
  let observed = toProxy.get(target)
  if (observed) {
    return observed
  }
  // 防止代理对象被代理
  if (toRaw.has(target)) {
    return target
  }

  let baseHandler = {
    get(target, key, receiver) {
      let result = Reflect.get(target, key, receiver)
      // console.log('getter')

      // 订阅（依赖收集），收集 key 和对应的 effect
      track(target, key)

      // 按需递归代理多层嵌套对象
      return isObject(result) ? reactive(result) : result
    },
    set(target, key, value, receiver) {
      let isOwn = hasKey(target, key)
      let oldValue = Reflect.get(target, key)
      let result = Reflect.set(target, key, value, receiver)
      if (!isOwn) {
        trigger(target, 'add', key)
        // console.log('setter：新增属性')
      } else if (oldValue !== value) {
        trigger(target, 'set', key)
        // console.log('setter：修改属性')
      }
      return result
    },
    deleteProperty(target, key) {
      let result = Reflect.deleteProperty(target, key)
      console.log('delete')
      return result
    }
  }
  observed = new Proxy(target, baseHandler)
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

// target: {
//   key: [effect, ...]
// }
let activeEffectStack = []

/**
 * @description 副作用
 * @param {Function} fn
 */
function effect(fn) {
  let effect = createReactiveEffect(fn)
  // 默认先执行一次，数据变化再次执行
  effect()
}

/**
 * @description 响应式化 effect() 传入的 callback(),数据变化触发调用
 * @param {Function} fn
 */
function createReactiveEffect(fn) {
  let effect = function () {
    return run(effect, fn)
  }
  return effect
}

/**
 * @description 执行 effect() 传入的 callback(),effect() 传入的 callback() 入栈
 * @param {Function} fn
 */
function run(effect, fn) {
  try {
    activeEffectStack.push(effect)
    // effect() 传入的 callback() 调用，依赖取值触发代理的 getter
    fn()
  } finally {
    activeEffectStack.pop()
  }
}

// targetMap: {
//   target: {
//     key: [effect, ...],
//     ...
//   },
//   ...
// }
// 依赖收集
let targetMap = new WeakMap()

/**
 * @description 订阅（依赖收集），收集 key 和对应的 effect
 * @param {Object} target 原对象
 * @param {String} key 键
 */
function track(target, key) {
  let effect = activeEffectStack[activeEffectStack.length - 1]
  if (effect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, depsMap = new Map())
    }
    let deps = depsMap.get(key)
    if (!deps) {
      depsMap.set(key, deps = new Set())
    }
    if (!deps.has(effect)) {
      deps.add(effect)
    }
  }
}

/**
 * @description 数据改变的时候触发代理的 setter，对应 key 副作用派发更新
 * @param {Object} target 原对象
 * @param {String} key 键
 */
function trigger(target, type, key) {
  let depsMap = targetMap.get(target)
  if (depsMap) {
    let deps = depsMap.get(key)
    if (deps) {
      deps.forEach(effect => {
        effect()
      })
    }
  }
}
