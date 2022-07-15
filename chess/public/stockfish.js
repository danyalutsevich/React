var Module = typeof Module !== "undefined" ? Module : {}
var STOCKFISH = (function() {
  function load_stockfish(console, WasmPath) {
    if (
      typeof navigator !== "undefined" &&
      (/MSIE|Trident|Edge/i.test(navigator.userAgent) ||
        (/Safari/i.test(navigator.userAgent) &&
          !/Chrome|CriOS/i.test(navigator.userAgent)))
    ) {
      var dateNow = Date.now
    }
    var Module = { wasmBinaryFile: WasmPath }
    var moduleOverrides = {}
    var key
    for (key in Module) {
      if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key]
      }
    }
    Module["arguments"] = []
    Module["thisProgram"] = "./this.program"
    Module["quit"] = function(status, toThrow) {
      throw toThrow
    }
    Module["preRun"] = []
    Module["postRun"] = []
    var ENVIRONMENT_IS_WEB = false
    var ENVIRONMENT_IS_WORKER = false
    var ENVIRONMENT_IS_NODE = false
    var ENVIRONMENT_HAS_NODE = false
    var ENVIRONMENT_IS_SHELL = false
    ENVIRONMENT_IS_WEB = typeof window === "object"
    ENVIRONMENT_IS_WORKER = typeof importScripts === "function"
    ENVIRONMENT_HAS_NODE =
      typeof process === "object" &&
      typeof process.versions === "object" &&
      typeof process.versions.node === "string"
    ENVIRONMENT_IS_NODE =
      ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER
    ENVIRONMENT_IS_SHELL =
      !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER
    var scriptDirectory = ""
    function locateFile(path) {
      if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
      } else {
        return scriptDirectory + path
      }
    }
    if (ENVIRONMENT_IS_NODE) {
      scriptDirectory = __dirname + "/"
      var nodeFS
      var nodePath
      Module["read"] = function shell_read(filename, binary) {
        var ret
        if (!nodeFS) nodeFS = require("fs")
        if (!nodePath) nodePath = require("path")
        filename = nodePath["normalize"](filename)
        ret = nodeFS["readFileSync"](filename)
        return binary ? ret : ret.toString()
      }
      Module["readBinary"] = function readBinary(filename) {
        var ret = Module["read"](filename, true)
        if (!ret.buffer) {
          ret = new Uint8Array(ret)
        }
        assert(ret.buffer)
        return ret
      }
      if (process["argv"].length > 1) {
        Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
      }
      Module["arguments"] = process["argv"].slice(2)
      if (typeof module !== "undefined") {
        module["exports"] = Module
      }
      process["on"]("uncaughtException", function(ex) {
        if (!(ex instanceof ExitStatus)) {
          throw ex
        }
      })
      process["on"]("unhandledRejection", abort)
      Module["quit"] = function(status) {
        process["exit"](status)
      }
      Module["inspect"] = function() {
        return "[Emscripten Module object]"
      }
    } else if (ENVIRONMENT_IS_SHELL) {
      if (typeof read != "undefined") {
        Module["read"] = function shell_read(f) {
          return read(f)
        }
      }
      Module["readBinary"] = function readBinary(f) {
        var data
        if (typeof readbuffer === "function") {
          return new Uint8Array(readbuffer(f))
        }
        data = read(f, "binary")
        assert(typeof data === "object")
        return data
      }
      if (typeof scriptArgs != "undefined") {
        Module["arguments"] = scriptArgs
      } else if (typeof arguments != "undefined") {
        Module["arguments"] = arguments
      }
      if (typeof quit === "function") {
        Module["quit"] = function(status) {
          quit(status)
        }
      }
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
      } else if (document.currentScript) {
        scriptDirectory = document.currentScript.src
      }
      if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(
          0,
          scriptDirectory.lastIndexOf("/") + 1,
        )
      } else {
        scriptDirectory = ""
      }
      Module["read"] = function shell_read(url) {
        var xhr = new XMLHttpRequest()
        xhr.open("GET", url, false)
        xhr.send(null)
        return xhr.responseText
      }
      if (ENVIRONMENT_IS_WORKER) {
        Module["readBinary"] = function readBinary(url) {
          var xhr = new XMLHttpRequest()
          xhr.open("GET", url, false)
          xhr.responseType = "arraybuffer"
          xhr.send(null)
          return new Uint8Array(xhr.response)
        }
      }
      Module["readAsync"] = function readAsync(url, onload, onerror) {
        var xhr = new XMLHttpRequest()
        xhr.open("GET", url, true)
        xhr.responseType = "arraybuffer"
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
            onload(xhr.response)
            return
          }
          onerror()
        }
        xhr.onerror = onerror
        xhr.send(null)
      }
      Module["setWindowTitle"] = function(title) {
        document.title = title
      }
    } else {
    }
    var out =
      Module["print"] ||
      (typeof console !== "undefined"
        ? console.log.bind(console)
        : typeof print !== "undefined"
        ? print
        : null)
    var err =
      Module["printErr"] ||
      (typeof printErr !== "undefined"
        ? printErr
        : (typeof console !== "undefined" && console.warn.bind(console)) || out)
    for (key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key]
      }
    }
    moduleOverrides = undefined
    function warnOnce(text) {
      if (!warnOnce.shown) warnOnce.shown = {}
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1
        err(text)
      }
    }
    var asm2wasmImports = {
      "f64-rem": function(x, y) {
        return x % y
      },
      debugger: function() {
        debugger
      },
    }
    var functionPointers = new Array(0)
    var funcWrappers = {}
    function getFuncWrapper(func, sig) {
      if (!func) return
      assert(sig)
      if (!funcWrappers[sig]) {
        funcWrappers[sig] = {}
      }
      var sigCache = funcWrappers[sig]
      if (!sigCache[func]) {
        if (sig.length === 1) {
          sigCache[func] = function dynCall_wrapper() {
            return dynCall(sig, func)
          }
        } else if (sig.length === 2) {
          sigCache[func] = function dynCall_wrapper(arg) {
            return dynCall(sig, func, [arg])
          }
        } else {
          sigCache[func] = function dynCall_wrapper() {
            return dynCall(sig, func, Array.prototype.slice.call(arguments))
          }
        }
      }
      return sigCache[func]
    }
    function dynCall(sig, ptr, args) {
      if (args && args.length) {
        return Module["dynCall_" + sig].apply(null, [ptr].concat(args))
      } else {
        return Module["dynCall_" + sig].call(null, ptr)
      }
    }
    var tempRet0 = 0
    var setTempRet0 = function(value) {
      tempRet0 = value
    }
    var getTempRet0 = function() {
      return tempRet0
    }
    if (typeof WebAssembly !== "object") {
      err("no native wasm support detected")
    }
    var wasmMemory
    var wasmTable
    var ABORT = false
    var EXITSTATUS = 0
    function assert(condition, text) {
      if (!condition) {
        abort("Assertion failed: " + text)
      }
    }
    function getCFunc(ident) {
      var func = Module["_" + ident]
      assert(
        func,
        "Cannot call unknown function " + ident + ", make sure it is exported",
      )
      return func
    }
    function ccall(ident, returnType, argTypes, args, opts) {
      var toC = {
        string: function(str) {
          var ret = 0
          if (str !== null && str !== undefined && str !== 0) {
            var len = (str.length << 2) + 1
            ret = stackAlloc(len)
            stringToUTF8(str, ret, len)
          }
          return ret
        },
        array: function(arr) {
          var ret = stackAlloc(arr.length)
          writeArrayToMemory(arr, ret)
          return ret
        },
      }
      function convertReturnValue(ret) {
        if (returnType === "string") return UTF8ToString(ret)
        if (returnType === "boolean") return Boolean(ret)
        return ret
      }
      var func = getCFunc(ident)
      var cArgs = []
      var stack = 0
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]]
          if (converter) {
            if (stack === 0) stack = stackSave()
            cArgs[i] = converter(args[i])
          } else {
            cArgs[i] = args[i]
          }
        }
      }
      var ret = func.apply(null, cArgs)
      ret = convertReturnValue(ret)
      if (stack !== 0) stackRestore(stack)
      return ret
    }
    var UTF8Decoder =
      typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined
    function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
      var endIdx = idx + maxBytesToRead
      var endPtr = idx
      while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr
      if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
      } else {
        var str = ""
        while (idx < endPtr) {
          var u0 = u8Array[idx++]
          if (!(u0 & 128)) {
            str += String.fromCharCode(u0)
            continue
          }
          var u1 = u8Array[idx++] & 63
          if ((u0 & 224) == 192) {
            str += String.fromCharCode(((u0 & 31) << 6) | u1)
            continue
          }
          var u2 = u8Array[idx++] & 63
          if ((u0 & 240) == 224) {
            u0 = ((u0 & 15) << 12) | (u1 << 6) | u2
          } else {
            u0 =
              ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63)
          }
          if (u0 < 65536) {
            str += String.fromCharCode(u0)
          } else {
            var ch = u0 - 65536
            str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023))
          }
        }
      }
      return str
    }
    function UTF8ToString(ptr, maxBytesToRead) {
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
    }
    function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
      if (!(maxBytesToWrite > 0)) return 0
      var startIdx = outIdx
      var endIdx = outIdx + maxBytesToWrite - 1
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i)
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i)
          u = (65536 + ((u & 1023) << 10)) | (u1 & 1023)
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break
          outU8Array[outIdx++] = u
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break
          outU8Array[outIdx++] = 192 | (u >> 6)
          outU8Array[outIdx++] = 128 | (u & 63)
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break
          outU8Array[outIdx++] = 224 | (u >> 12)
          outU8Array[outIdx++] = 128 | ((u >> 6) & 63)
          outU8Array[outIdx++] = 128 | (u & 63)
        } else {
          if (outIdx + 3 >= endIdx) break
          outU8Array[outIdx++] = 240 | (u >> 18)
          outU8Array[outIdx++] = 128 | ((u >> 12) & 63)
          outU8Array[outIdx++] = 128 | ((u >> 6) & 63)
          outU8Array[outIdx++] = 128 | (u & 63)
        }
      }
      outU8Array[outIdx] = 0
      return outIdx - startIdx
    }
    function stringToUTF8(str, outPtr, maxBytesToWrite) {
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
    }
    function lengthBytesUTF8(str) {
      var len = 0
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i)
        if (u >= 55296 && u <= 57343)
          u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023)
        if (u <= 127) ++len
        else if (u <= 2047) len += 2
        else if (u <= 65535) len += 3
        else len += 4
      }
      return len
    }
    var UTF16Decoder =
      typeof TextDecoder !== "undefined"
        ? new TextDecoder("utf-16le")
        : undefined
    function allocateUTF8(str) {
      var size = lengthBytesUTF8(str) + 1
      var ret = _malloc(size)
      if (ret) stringToUTF8Array(str, HEAP8, ret, size)
      return ret
    }
    function allocateUTF8OnStack(str) {
      var size = lengthBytesUTF8(str) + 1
      var ret = stackAlloc(size)
      stringToUTF8Array(str, HEAP8, ret, size)
      return ret
    }
    function writeArrayToMemory(array, buffer) {
      HEAP8.set(array, buffer)
    }
    var WASM_PAGE_SIZE = 65536
    var buffer,
      HEAP8,
      HEAPU8,
      HEAP16,
      HEAPU16,
      HEAP32,
      HEAPU32,
      HEAPF32,
      HEAPF64
    function updateGlobalBufferViews() {
      Module["HEAP8"] = HEAP8 = new Int8Array(buffer)
      Module["HEAP16"] = HEAP16 = new Int16Array(buffer)
      Module["HEAP32"] = HEAP32 = new Int32Array(buffer)
      Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer)
      Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer)
      Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer)
      Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer)
      Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
    }
    var DYNAMIC_BASE = 6360112,
      DYNAMICTOP_PTR = 1117200
    var TOTAL_STACK = 5242880
    var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 67108864
    if (INITIAL_TOTAL_MEMORY < TOTAL_STACK)
      err(
        "TOTAL_MEMORY should be larger than TOTAL_STACK, was " +
          INITIAL_TOTAL_MEMORY +
          "! (TOTAL_STACK=" +
          TOTAL_STACK +
          ")",
      )
    if (Module["wasmMemory"]) {
      wasmMemory = Module["wasmMemory"]
    } else {
      wasmMemory = new WebAssembly.Memory({
        initial: INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE,
        maximum: INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE,
      })
    }
    if (wasmMemory) {
      buffer = wasmMemory.buffer
    }
    INITIAL_TOTAL_MEMORY = buffer.byteLength
    updateGlobalBufferViews()
    HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE
    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift()
        if (typeof callback == "function") {
          callback()
          continue
        }
        var func = callback.func
        if (typeof func === "number") {
          if (callback.arg === undefined) {
            Module["dynCall_v"](func)
          } else {
            Module["dynCall_vi"](func, callback.arg)
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg)
        }
      }
    }
    var __ATPRERUN__ = []
    var __ATINIT__ = []
    var __ATMAIN__ = []
    var __ATPOSTRUN__ = []
    var runtimeInitialized = false
    var runtimeExited = false
    function preRun() {
      if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
          Module["preRun"] = [Module["preRun"]]
        while (Module["preRun"].length) {
          addOnPreRun(Module["preRun"].shift())
        }
      }
      callRuntimeCallbacks(__ATPRERUN__)
    }
    function initRuntime() {
      runtimeInitialized = true
      callRuntimeCallbacks(__ATINIT__)
    }
    function preMain() {
      callRuntimeCallbacks(__ATMAIN__)
    }
    function exitRuntime() {
      runtimeExited = true
    }
    function postRun() {
      if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
          Module["postRun"] = [Module["postRun"]]
        while (Module["postRun"].length) {
          addOnPostRun(Module["postRun"].shift())
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__)
    }
    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb)
    }
    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb)
    }
    var runDependencies = 0
    var runDependencyWatcher = null
    var dependenciesFulfilled = null
    function getUniqueRunDependency(id) {
      return id
    }
    function addRunDependency(id) {
      runDependencies++
      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
      }
    }
    function removeRunDependency(id) {
      runDependencies--
      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
      }
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher)
          runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled
          dependenciesFulfilled = null
          callback()
        }
      }
    }
    Module["preloadedImages"] = {}
    Module["preloadedAudios"] = {}
    var dataURIPrefix = "data:application/octet-stream;base64,"
    function isDataURI(filename) {
      return String.prototype.startsWith
        ? filename.startsWith(dataURIPrefix)
        : filename.indexOf(dataURIPrefix) === 0
    }
    var wasmBinaryFile = Module.wasmBinaryFile || "stockfish.wasm"
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = Module.wasmBinaryFile || locateFile(wasmBinaryFile)
    }
    function getBinary() {
      try {
        if (Module["wasmBinary"]) {
          return new Uint8Array(Module["wasmBinary"])
        }
        if (Module["readBinary"]) {
          return Module["readBinary"](wasmBinaryFile)
        } else {
          throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)"
        }
      } catch (err) {
        abort(err)
      }
    }
    function createWasm(env) {
      var info = {
        env: env,
        global: { NaN: NaN, Infinity: Infinity },
        "global.Math": Math,
        asm2wasm: asm2wasmImports,
      }
      function receiveInstance(instance, module) {
        var exports = instance.exports
        Module["asm"] = exports
        removeRunDependency("wasm-instantiate")
      }
      addRunDependency("wasm-instantiate")
      function instantiateSync() {
        var instance
        var module
        var binary
        try {
          binary = getBinary()
          module = new WebAssembly.Module(binary)
          instance = new WebAssembly.Instance(module, info)
        } catch (e) {
          err("failed to compile wasm module: " + e)
          if (
            e.toString().indexOf("imported Memory with incompatible size") >= 0
          ) {
            err(
              "Memory size incompatibility issues may be due to changing TOTAL_MEMORY at runtime to something too large. Use ALLOW_MEMORY_GROWTH to allow any size memory (and also make sure not to set TOTAL_MEMORY at runtime to something smaller than it was at compile time).",
            )
          }
          return false
        }
        receiveInstance(instance, module)
      }
      if (Module["instantiateWasm"]) {
        try {
          return Module["instantiateWasm"](info, receiveInstance)
        } catch (e) {
          err("Module.instantiateWasm callback failed with error: " + e)
          return false
        }
      }
      instantiateSync()
      return Module["asm"]
    }
    Module["asm"] = function(global, env, providedBuffer) {
      env["memory"] = wasmMemory
      env["table"] = wasmTable = new WebAssembly.Table({
        initial: 734,
        maximum: 734,
        element: "anyfunc",
      })
      env["__memory_base"] = 1024
      env["__table_base"] = 0
      var exports = createWasm(env)
      return exports
    }
    __ATINIT__.push({
      func: function() {
        globalCtors()
      },
    })
    function ___atomic_fetch_add_8(ptr, vall, valh, memmodel) {
      var l = HEAP32[ptr >> 2]
      var h = HEAP32[(ptr + 4) >> 2]
      HEAP32[ptr >> 2] = _i64Add(l, h, vall, valh)
      HEAP32[(ptr + 4) >> 2] = getTempRet0()
      return (setTempRet0(h), l) | 0
    }
    function ___cxa_uncaught_exception() {
      err("missing function: __cxa_uncaught_exception")
      abort(-1)
    }
    function ___lock() {}
    function ___setErrNo(value) {
      if (Module["___errno_location"])
        HEAP32[Module["___errno_location"]() >> 2] = value
      return value
    }
    function ___map_file(pathname, size) {
      ___setErrNo(1)
      return -1
    }
    var PATH = {
      splitPath: function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
        return splitPathRe.exec(filename).slice(1)
      },
      normalizeArray: function(parts, allowAboveRoot) {
        var up = 0
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i]
          if (last === ".") {
            parts.splice(i, 1)
          } else if (last === "..") {
            parts.splice(i, 1)
            up++
          } else if (up) {
            parts.splice(i, 1)
            up--
          }
        }
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift("..")
          }
        }
        return parts
      },
      normalize: function(path) {
        var isAbsolute = path.charAt(0) === "/",
          trailingSlash = path.substr(-1) === "/"
        path = PATH.normalizeArray(
          path.split("/").filter(function(p) {
            return !!p
          }),
          !isAbsolute,
        ).join("/")
        if (!path && !isAbsolute) {
          path = "."
        }
        if (path && trailingSlash) {
          path += "/"
        }
        return (isAbsolute ? "/" : "") + path
      },
      dirname: function(path) {
        var result = PATH.splitPath(path),
          root = result[0],
          dir = result[1]
        if (!root && !dir) {
          return "."
        }
        if (dir) {
          dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
      },
      basename: function(path) {
        if (path === "/") return "/"
        var lastSlash = path.lastIndexOf("/")
        if (lastSlash === -1) return path
        return path.substr(lastSlash + 1)
      },
      extname: function(path) {
        return PATH.splitPath(path)[3]
      },
      join: function() {
        var paths = Array.prototype.slice.call(arguments, 0)
        return PATH.normalize(paths.join("/"))
      },
      join2: function(l, r) {
        return PATH.normalize(l + "/" + r)
      },
    }
    var SYSCALLS = {
      buffers: [null, [], []],
      printChar: function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream]
        if (curr === 0 || curr === 10) {
          ;(stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0))
          buffer.length = 0
        } else {
          buffer.push(curr)
        }
      },
      varargs: 0,
      get: function(varargs) {
        SYSCALLS.varargs += 4
        var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2]
        return ret
      },
      getStr: function() {
        var ret = UTF8ToString(SYSCALLS.get())
        return ret
      },
      get64: function() {
        var low = SYSCALLS.get(),
          high = SYSCALLS.get()
        return low
      },
      getZero: function() {
        SYSCALLS.get()
      },
    }
    function ___syscall140(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        var stream = SYSCALLS.getStreamFromFD(),
          offset_high = SYSCALLS.get(),
          offset_low = SYSCALLS.get(),
          result = SYSCALLS.get(),
          whence = SYSCALLS.get()
        return 0
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___syscall145(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        var stream = SYSCALLS.getStreamFromFD(),
          iov = SYSCALLS.get(),
          iovcnt = SYSCALLS.get()
        return SYSCALLS.doReadv(stream, iov, iovcnt)
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___syscall146(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        var stream = SYSCALLS.get(),
          iov = SYSCALLS.get(),
          iovcnt = SYSCALLS.get()
        var ret = 0
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(iov + i * 8) >> 2]
          var len = HEAP32[(iov + (i * 8 + 4)) >> 2]
          for (var j = 0; j < len; j++) {
            SYSCALLS.printChar(stream, HEAPU8[ptr + j])
          }
          ret += len
        }
        return ret
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___syscall221(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        return 0
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___syscall5(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        var pathname = SYSCALLS.getStr(),
          flags = SYSCALLS.get(),
          mode = SYSCALLS.get()
        var stream = FS.open(pathname, flags, mode)
        return stream.fd
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___syscall54(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        return 0
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___syscall6(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        var stream = SYSCALLS.getStreamFromFD()
        return 0
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function __emscripten_syscall_munmap(addr, len) {
      if (addr == -1 || len == 0) {
        return -22
      }
      var info = SYSCALLS.mappings[addr]
      if (!info) return 0
      if (len === info.len) {
        var stream = FS.getStream(info.fd)
        SYSCALLS.doMsync(addr, stream, len, info.flags)
        FS.munmap(stream)
        SYSCALLS.mappings[addr] = null
        if (info.allocated) {
          _free(info.malloc)
        }
      }
      return 0
    }
    function ___syscall91(which, varargs) {
      SYSCALLS.varargs = varargs
      try {
        var addr = SYSCALLS.get(),
          len = SYSCALLS.get()
        return __emscripten_syscall_munmap(addr, len)
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e)
        return -e.errno
      }
    }
    function ___unlock() {}
    function _abort() {
      Module["abort"]()
    }
    function _emscripten_get_now() {
      abort()
    }
    function _emscripten_get_now_is_monotonic() {
      return (
        0 ||
        ENVIRONMENT_IS_NODE ||
        typeof dateNow !== "undefined" ||
        (typeof performance === "object" &&
          performance &&
          typeof performance["now"] === "function")
      )
    }
    function _clock_gettime(clk_id, tp) {
      var now
      if (clk_id === 0) {
        now = Date.now()
      } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
        now = _emscripten_get_now()
      } else {
        ___setErrNo(22)
        return -1
      }
      HEAP32[tp >> 2] = (now / 1e3) | 0
      HEAP32[(tp + 4) >> 2] = ((now % 1e3) * 1e3 * 1e3) | 0
      return 0
    }
    function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode
      Browser.mainLoop.timingValue = value
      if (!Browser.mainLoop.func) {
        return 1
      }
      if (mode == 0) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick =
            Math.max(
              0,
              Browser.mainLoop.tickStartTime + value - _emscripten_get_now(),
            ) | 0
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
        }
        Browser.mainLoop.method = "timeout"
      } else if (mode == 1) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner)
        }
        Browser.mainLoop.method = "rAF"
      } else if (mode == 2) {
        if (typeof setImmediate === "undefined") {
          var setImmediates = []
          var emscriptenMainLoopMessageId = "setimmediate"
          var Browser_setImmediate_messageHandler = function(event) {
            if (
              event.data === emscriptenMainLoopMessageId ||
              event.data.target === emscriptenMainLoopMessageId
            ) {
              event.stopPropagation()
              setImmediates.shift()()
            }
          }
          addEventListener("message", Browser_setImmediate_messageHandler, true)
          setImmediate = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func)
            if (ENVIRONMENT_IS_WORKER) {
              if (Module["setImmediates"] === undefined)
                Module["setImmediates"] = []
              Module["setImmediates"].push(func)
              postMessage({ target: emscriptenMainLoopMessageId })
            } else postMessage(emscriptenMainLoopMessageId, "*")
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          setImmediate(Browser.mainLoop.runner)
        }
        Browser.mainLoop.method = "immediate"
      }
      return 0
    }
    function _emscripten_set_main_loop(
      func,
      fps,
      simulateInfiniteLoop,
      arg,
      noSetTiming,
    ) {
      Module["noExitRuntime"] = true
      assert(
        !Browser.mainLoop.func,
        "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.",
      )
      Browser.mainLoop.func = func
      Browser.mainLoop.arg = arg
      var browserIterationFunc
      if (typeof arg !== "undefined") {
        browserIterationFunc = function() {
          Module["dynCall_vi"](func, arg)
        }
      } else {
        browserIterationFunc = function() {
          Module["dynCall_v"](func)
        }
      }
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now()
          var blocker = Browser.mainLoop.queue.shift()
          blocker.func(blocker.arg)
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers
            var next =
              remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining)
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next
            } else {
              next = next + 0.5
              Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
            }
          }
          console.log(
            'main loop blocker "' +
              blocker.name +
              '" took ' +
              (Date.now() - start) +
              " ms",
          )
          Browser.mainLoop.updateStatus()
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return
          setTimeout(Browser.mainLoop.runner, 0)
          return
        }
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return
        Browser.mainLoop.currentFrameNumber =
          (Browser.mainLoop.currentFrameNumber + 1) | 0
        if (
          Browser.mainLoop.timingMode == 1 &&
          Browser.mainLoop.timingValue > 1 &&
          Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue !=
            0
        ) {
          Browser.mainLoop.scheduler()
          return
        } else if (Browser.mainLoop.timingMode == 0) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now()
        }
        if (Browser.mainLoop.method === "timeout" && Module.ctx) {
          err(
            "Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!",
          )
          Browser.mainLoop.method = ""
        }
        Browser.mainLoop.runIter(browserIterationFunc)
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return
        if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData)
          SDL.audio.queueNewAudioData()
        Browser.mainLoop.scheduler()
      }
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps)
        else _emscripten_set_main_loop_timing(1, 1)
        Browser.mainLoop.scheduler()
      }
      if (simulateInfiniteLoop) {
        throw "SimulateInfiniteLoop"
      }
    }
    var Browser = {
      mainLoop: {
        scheduler: null,
        method: "",
        currentlyRunningMainloop: 0,
        func: null,
        arg: 0,
        timingMode: 0,
        timingValue: 0,
        currentFrameNumber: 0,
        queue: [],
        pause: function() {
          Browser.mainLoop.scheduler = null
          Browser.mainLoop.currentlyRunningMainloop++
        },
        resume: function() {
          Browser.mainLoop.currentlyRunningMainloop++
          var timingMode = Browser.mainLoop.timingMode
          var timingValue = Browser.mainLoop.timingValue
          var func = Browser.mainLoop.func
          Browser.mainLoop.func = null
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true)
          _emscripten_set_main_loop_timing(timingMode, timingValue)
          Browser.mainLoop.scheduler()
        },
        updateStatus: function() {
          if (Module["setStatus"]) {
            var message = Module["statusMessage"] || "Please wait..."
            var remaining = Browser.mainLoop.remainingBlockers
            var expected = Browser.mainLoop.expectedBlockers
            if (remaining) {
              if (remaining < expected) {
                Module["setStatus"](
                  message +
                    " (" +
                    (expected - remaining) +
                    "/" +
                    expected +
                    ")",
                )
              } else {
                Module["setStatus"](message)
              }
            } else {
              Module["setStatus"]("")
            }
          }
        },
        runIter: function(func) {
          if (ABORT) return
          if (Module["preMainLoop"]) {
            var preRet = Module["preMainLoop"]()
            if (preRet === false) {
              return
            }
          }
          try {
            func()
          } catch (e) {
            if (e instanceof ExitStatus) {
              return
            } else {
              if (e && typeof e === "object" && e.stack)
                err("exception thrown: " + [e, e.stack])
              throw e
            }
          }
          if (Module["postMainLoop"]) Module["postMainLoop"]()
        },
      },
      isFullscreen: false,
      pointerLock: false,
      moduleContextCreatedCallbacks: [],
      workers: [],
      init: function() {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []
        if (Browser.initted) return
        Browser.initted = true
        try {
          new Blob()
          Browser.hasBlobConstructor = true
        } catch (e) {
          Browser.hasBlobConstructor = false
          console.log(
            "warning: no blob constructor, cannot create blobs with mimetypes",
          )
        }
        Browser.BlobBuilder =
          typeof MozBlobBuilder != "undefined"
            ? MozBlobBuilder
            : typeof WebKitBlobBuilder != "undefined"
            ? WebKitBlobBuilder
            : !Browser.hasBlobConstructor
            ? console.log("warning: no BlobBuilder")
            : null
        Browser.URLObject =
          typeof window != "undefined"
            ? window.URL
              ? window.URL
              : window.webkitURL
            : undefined
        if (
          !Module.noImageDecoding &&
          typeof Browser.URLObject === "undefined"
        ) {
          console.log(
            "warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.",
          )
          Module.noImageDecoding = true
        }
        var imagePlugin = {}
        imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
        }
        imagePlugin["handle"] = function imagePlugin_handle(
          byteArray,
          name,
          onload,
          onerror,
        ) {
          var b = null
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) })
              if (b.size !== byteArray.length) {
                b = new Blob([new Uint8Array(byteArray).buffer], {
                  type: Browser.getMimetype(name),
                })
              }
            } catch (e) {
              warnOnce(
                "Blob constructor present but fails: " +
                  e +
                  "; falling back to blob builder",
              )
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder()
            bb.append(new Uint8Array(byteArray).buffer)
            b = bb.getBlob()
          }
          var url = Browser.URLObject.createObjectURL(b)
          var img = new Image()
          img.onload = function img_onload() {
            assert(img.complete, "Image " + name + " could not be decoded")
            var canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            var ctx = canvas.getContext("2d")
            ctx.drawImage(img, 0, 0)
            Module["preloadedImages"][name] = canvas
            Browser.URLObject.revokeObjectURL(url)
            if (onload) onload(byteArray)
          }
          img.onerror = function img_onerror(event) {
            console.log("Image " + url + " could not be decoded")
            if (onerror) onerror()
          }
          img.src = url
        }
        Module["preloadPlugins"].push(imagePlugin)
        var audioPlugin = {}
        audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
          return (
            !Module.noAudioDecoding &&
            name.substr(-4) in { ".ogg": 1, ".wav": 1, ".mp3": 1 }
          )
        }
        audioPlugin["handle"] = function audioPlugin_handle(
          byteArray,
          name,
          onload,
          onerror,
        ) {
          var done = false
          function finish(audio) {
            if (done) return
            done = true
            Module["preloadedAudios"][name] = audio
            if (onload) onload(byteArray)
          }
          function fail() {
            if (done) return
            done = true
            Module["preloadedAudios"][name] = new Audio()
            if (onerror) onerror()
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) })
            } catch (e) {
              return fail()
            }
            var url = Browser.URLObject.createObjectURL(b)
            var audio = new Audio()
            audio.addEventListener(
              "canplaythrough",
              function() {
                finish(audio)
              },
              false,
            )
            audio.onerror = function audio_onerror(event) {
              if (done) return
              console.log(
                "warning: browser could not fully decode audio " +
                  name +
                  ", trying slower base64 approach",
              )
              function encode64(data) {
                var BASE =
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
                var PAD = "="
                var ret = ""
                var leftchar = 0
                var leftbits = 0
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i]
                  leftbits += 8
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits - 6)) & 63
                    leftbits -= 6
                    ret += BASE[curr]
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar & 3) << 4]
                  ret += PAD + PAD
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar & 15) << 2]
                  ret += PAD
                }
                return ret
              }
              audio.src =
                "data:audio/x-" +
                name.substr(-3) +
                ";base64," +
                encode64(byteArray)
              finish(audio)
            }
            audio.src = url
            Browser.safeSetTimeout(function() {
              finish(audio)
            }, 1e4)
          } else {
            return fail()
          }
        }
        Module["preloadPlugins"].push(audioPlugin)
        function pointerLockChange() {
          Browser.pointerLock =
            document["pointerLockElement"] === Module["canvas"] ||
            document["mozPointerLockElement"] === Module["canvas"] ||
            document["webkitPointerLockElement"] === Module["canvas"] ||
            document["msPointerLockElement"] === Module["canvas"]
        }
        var canvas = Module["canvas"]
        if (canvas) {
          canvas.requestPointerLock =
            canvas["requestPointerLock"] ||
            canvas["mozRequestPointerLock"] ||
            canvas["webkitRequestPointerLock"] ||
            canvas["msRequestPointerLock"] ||
            function() {}
          canvas.exitPointerLock =
            document["exitPointerLock"] ||
            document["mozExitPointerLock"] ||
            document["webkitExitPointerLock"] ||
            document["msExitPointerLock"] ||
            function() {}
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document)
          document.addEventListener(
            "pointerlockchange",
            pointerLockChange,
            false,
          )
          document.addEventListener(
            "mozpointerlockchange",
            pointerLockChange,
            false,
          )
          document.addEventListener(
            "webkitpointerlockchange",
            pointerLockChange,
            false,
          )
          document.addEventListener(
            "mspointerlockchange",
            pointerLockChange,
            false,
          )
          if (Module["elementPointerLock"]) {
            canvas.addEventListener(
              "click",
              function(ev) {
                if (
                  !Browser.pointerLock &&
                  Module["canvas"].requestPointerLock
                ) {
                  Module["canvas"].requestPointerLock()
                  ev.preventDefault()
                }
              },
              false,
            )
          }
        }
      },
      createContext: function(
        canvas,
        useWebGL,
        setInModule,
        webGLContextAttributes,
      ) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx
        var ctx
        var contextHandle
        if (useWebGL) {
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 1,
          }
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute]
            }
          }
          if (typeof GL !== "undefined") {
            contextHandle = GL.createContext(canvas, contextAttributes)
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx
            }
          }
        } else {
          ctx = canvas.getContext("2d")
        }
        if (!ctx) return null
        if (setInModule) {
          if (!useWebGL)
            assert(
              typeof GLctx === "undefined",
              "cannot set in module if GLctx is used, but we are a non-GL context that would replace it",
            )
          Module.ctx = ctx
          if (useWebGL) GL.makeContextCurrent(contextHandle)
          Module.useWebGL = useWebGL
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
            callback()
          })
          Browser.init()
        }
        return ctx
      },
      destroyContext: function(canvas, useWebGL, setInModule) {},
      fullscreenHandlersInstalled: false,
      lockPointer: undefined,
      resizeCanvas: undefined,
      requestFullscreen: function(lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer
        Browser.resizeCanvas = resizeCanvas
        Browser.vrDevice = vrDevice
        if (typeof Browser.lockPointer === "undefined")
          Browser.lockPointer = true
        if (typeof Browser.resizeCanvas === "undefined")
          Browser.resizeCanvas = false
        if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null
        var canvas = Module["canvas"]
        function fullscreenChange() {
          Browser.isFullscreen = false
          var canvasContainer = canvas.parentNode
          if (
            (document["fullscreenElement"] ||
              document["mozFullScreenElement"] ||
              document["msFullscreenElement"] ||
              document["webkitFullscreenElement"] ||
              document["webkitCurrentFullScreenElement"]) === canvasContainer
          ) {
            canvas.exitFullscreen = Browser.exitFullscreen
            if (Browser.lockPointer) canvas.requestPointerLock()
            Browser.isFullscreen = true
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize()
            } else {
              Browser.updateCanvasDimensions(canvas)
            }
          } else {
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer)
            canvasContainer.parentNode.removeChild(canvasContainer)
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize()
            } else {
              Browser.updateCanvasDimensions(canvas)
            }
          }
          if (Module["onFullScreen"])
            Module["onFullScreen"](Browser.isFullscreen)
          if (Module["onFullscreen"])
            Module["onFullscreen"](Browser.isFullscreen)
        }
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true
          document.addEventListener("fullscreenchange", fullscreenChange, false)
          document.addEventListener(
            "mozfullscreenchange",
            fullscreenChange,
            false,
          )
          document.addEventListener(
            "webkitfullscreenchange",
            fullscreenChange,
            false,
          )
          document.addEventListener(
            "MSFullscreenChange",
            fullscreenChange,
            false,
          )
        }
        var canvasContainer = document.createElement("div")
        canvas.parentNode.insertBefore(canvasContainer, canvas)
        canvasContainer.appendChild(canvas)
        canvasContainer.requestFullscreen =
          canvasContainer["requestFullscreen"] ||
          canvasContainer["mozRequestFullScreen"] ||
          canvasContainer["msRequestFullscreen"] ||
          (canvasContainer["webkitRequestFullscreen"]
            ? function() {
                canvasContainer["webkitRequestFullscreen"](
                  Element["ALLOW_KEYBOARD_INPUT"],
                )
              }
            : null) ||
          (canvasContainer["webkitRequestFullScreen"]
            ? function() {
                canvasContainer["webkitRequestFullScreen"](
                  Element["ALLOW_KEYBOARD_INPUT"],
                )
              }
            : null)
        if (vrDevice) {
          canvasContainer.requestFullscreen({ vrDisplay: vrDevice })
        } else {
          canvasContainer.requestFullscreen()
        }
      },
      requestFullScreen: function(lockPointer, resizeCanvas, vrDevice) {
        err(
          "Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.",
        )
        Browser.requestFullScreen = function(
          lockPointer,
          resizeCanvas,
          vrDevice,
        ) {
          return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
        }
        return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
      },
      exitFullscreen: function() {
        if (!Browser.isFullscreen) {
          return false
        }
        var CFS =
          document["exitFullscreen"] ||
          document["cancelFullScreen"] ||
          document["mozCancelFullScreen"] ||
          document["msExitFullscreen"] ||
          document["webkitCancelFullScreen"] ||
          function() {}
        CFS.apply(document, [])
        return true
      },
      nextRAF: 0,
      fakeRequestAnimationFrame: function(func) {
        var now = Date.now()
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1e3 / 60
        } else {
          while (now + 2 >= Browser.nextRAF) {
            Browser.nextRAF += 1e3 / 60
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0)
        setTimeout(func, delay)
      },
      requestAnimationFrame: function(func) {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(func)
          return
        }
        var RAF = Browser.fakeRequestAnimationFrame
        RAF(func)
      },
      safeCallback: function(func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments)
        }
      },
      allowAsyncCallbacks: true,
      queuedAsyncCallbacks: [],
      pauseAsyncCallbacks: function() {
        Browser.allowAsyncCallbacks = false
      },
      resumeAsyncCallbacks: function() {
        Browser.allowAsyncCallbacks = true
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks
          Browser.queuedAsyncCallbacks = []
          callbacks.forEach(function(func) {
            func()
          })
        }
      },
      safeRequestAnimationFrame: function(func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return
          if (Browser.allowAsyncCallbacks) {
            func()
          } else {
            Browser.queuedAsyncCallbacks.push(func)
          }
        })
      },
      safeSetTimeout: function(func, timeout) {
        Module["noExitRuntime"] = true
        return setTimeout(function() {
          if (ABORT) return
          if (Browser.allowAsyncCallbacks) {
            func()
          } else {
            Browser.queuedAsyncCallbacks.push(func)
          }
        }, timeout)
      },
      safeSetInterval: function(func, timeout) {
        Module["noExitRuntime"] = true
        return setInterval(function() {
          if (ABORT) return
          if (Browser.allowAsyncCallbacks) {
            func()
          }
        }, timeout)
      },
      getMimetype: function(name) {
        return {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          bmp: "image/bmp",
          ogg: "audio/ogg",
          wav: "audio/wav",
          mp3: "audio/mpeg",
        }[name.substr(name.lastIndexOf(".") + 1)]
      },
      getUserMedia: function(func) {
        if (!window.getUserMedia) {
          window.getUserMedia =
            navigator["getUserMedia"] || navigator["mozGetUserMedia"]
        }
        window.getUserMedia(func)
      },
      getMovementX: function(event) {
        return (
          event["movementX"] ||
          event["mozMovementX"] ||
          event["webkitMovementX"] ||
          0
        )
      },
      getMovementY: function(event) {
        return (
          event["movementY"] ||
          event["mozMovementY"] ||
          event["webkitMovementY"] ||
          0
        )
      },
      getMouseWheelDelta: function(event) {
        var delta = 0
        switch (event.type) {
          case "DOMMouseScroll":
            delta = event.detail / 3
            break
          case "mousewheel":
            delta = event.wheelDelta / 120
            break
          case "wheel":
            delta = event.deltaY
            switch (event.deltaMode) {
              case 0:
                delta /= 100
                break
              case 1:
                delta /= 3
                break
              case 2:
                delta *= 80
                break
              default:
                throw "unrecognized mouse wheel delta mode: " + event.deltaMode
            }
            break
          default:
            throw "unrecognized mouse wheel event: " + event.type
        }
        return delta
      },
      mouseX: 0,
      mouseY: 0,
      mouseMovementX: 0,
      mouseMovementY: 0,
      touches: {},
      lastTouches: {},
      calculateMouseEvent: function(event) {
        if (Browser.pointerLock) {
          if (event.type != "mousemove" && "mozMovementX" in event) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event)
            Browser.mouseMovementY = Browser.getMovementY(event)
          }
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
          } else {
            Browser.mouseX += Browser.mouseMovementX
            Browser.mouseY += Browser.mouseMovementY
          }
        } else {
          var rect = Module["canvas"].getBoundingClientRect()
          var cw = Module["canvas"].width
          var ch = Module["canvas"].height
          var scrollX =
            typeof window.scrollX !== "undefined"
              ? window.scrollX
              : window.pageXOffset
          var scrollY =
            typeof window.scrollY !== "undefined"
              ? window.scrollY
              : window.pageYOffset
          if (
            event.type === "touchstart" ||
            event.type === "touchend" ||
            event.type === "touchmove"
          ) {
            var touch = event.touch
            if (touch === undefined) {
              return
            }
            var adjustedX = touch.pageX - (scrollX + rect.left)
            var adjustedY = touch.pageY - (scrollY + rect.top)
            adjustedX = adjustedX * (cw / rect.width)
            adjustedY = adjustedY * (ch / rect.height)
            var coords = { x: adjustedX, y: adjustedY }
            if (event.type === "touchstart") {
              Browser.lastTouches[touch.identifier] = coords
              Browser.touches[touch.identifier] = coords
            } else if (
              event.type === "touchend" ||
              event.type === "touchmove"
            ) {
              var last = Browser.touches[touch.identifier]
              if (!last) last = coords
              Browser.lastTouches[touch.identifier] = last
              Browser.touches[touch.identifier] = coords
            }
            return
          }
          var x = event.pageX - (scrollX + rect.left)
          var y = event.pageY - (scrollY + rect.top)
          x = x * (cw / rect.width)
          y = y * (ch / rect.height)
          Browser.mouseMovementX = x - Browser.mouseX
          Browser.mouseMovementY = y - Browser.mouseY
          Browser.mouseX = x
          Browser.mouseY = y
        }
      },
      asyncLoad: function(url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency("al " + url) : ""
        Module["readAsync"](
          url,
          function(arrayBuffer) {
            assert(
              arrayBuffer,
              'Loading data file "' + url + '" failed (no arrayBuffer).',
            )
            onload(new Uint8Array(arrayBuffer))
            if (dep) removeRunDependency(dep)
          },
          function(event) {
            if (onerror) {
              onerror()
            } else {
              throw 'Loading data file "' + url + '" failed.'
            }
          },
        )
        if (dep) addRunDependency(dep)
      },
      resizeListeners: [],
      updateResizeListeners: function() {
        var canvas = Module["canvas"]
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height)
        })
      },
      setCanvasSize: function(width, height, noUpdates) {
        var canvas = Module["canvas"]
        Browser.updateCanvasDimensions(canvas, width, height)
        if (!noUpdates) Browser.updateResizeListeners()
      },
      windowedWidth: 0,
      windowedHeight: 0,
      setFullscreenCanvasSize: function() {
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[SDL.screen >> 2]
          flags = flags | 8388608
          HEAP32[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module["canvas"])
        Browser.updateResizeListeners()
      },
      setWindowedCanvasSize: function() {
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[SDL.screen >> 2]
          flags = flags & ~8388608
          HEAP32[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module["canvas"])
        Browser.updateResizeListeners()
      },
      updateCanvasDimensions: function(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative
          canvas.heightNative = hNative
        } else {
          wNative = canvas.widthNative
          hNative = canvas.heightNative
        }
        var w = wNative
        var h = hNative
        if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
          if (w / h < Module["forcedAspectRatio"]) {
            w = Math.round(h * Module["forcedAspectRatio"])
          } else {
            h = Math.round(w / Module["forcedAspectRatio"])
          }
        }
        if (
          (document["fullscreenElement"] ||
            document["mozFullScreenElement"] ||
            document["msFullscreenElement"] ||
            document["webkitFullscreenElement"] ||
            document["webkitCurrentFullScreenElement"]) === canvas.parentNode &&
          typeof screen != "undefined"
        ) {
          var factor = Math.min(screen.width / w, screen.height / h)
          w = Math.round(w * factor)
          h = Math.round(h * factor)
        }
        if (Browser.resizeCanvas) {
          if (canvas.width != w) canvas.width = w
          if (canvas.height != h) canvas.height = h
          if (typeof canvas.style != "undefined") {
            canvas.style.removeProperty("width")
            canvas.style.removeProperty("height")
          }
        } else {
          if (canvas.width != wNative) canvas.width = wNative
          if (canvas.height != hNative) canvas.height = hNative
          if (typeof canvas.style != "undefined") {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty("width", w + "px", "important")
              canvas.style.setProperty("height", h + "px", "important")
            } else {
              canvas.style.removeProperty("width")
              canvas.style.removeProperty("height")
            }
          }
        }
      },
      wgetRequests: {},
      nextWgetRequestHandle: 0,
      getNextWgetRequestHandle: function() {
        var handle = Browser.nextWgetRequestHandle
        Browser.nextWgetRequestHandle++
        return handle
      },
    }
    function _emscripten_async_call(func, arg, millis) {
      Module["noExitRuntime"] = true
      function wrapper() {
        getFuncWrapper(func, "vi")(arg)
      }
      if (millis >= 0) {
        Browser.safeSetTimeout(wrapper, millis)
      } else {
        Browser.safeRequestAnimationFrame(wrapper)
      }
    }
    function _emscripten_get_heap_size() {
      return HEAP8.length
    }
    function _exit(status) {
      exit(status)
    }
    var ENV = {}
    function _getenv(name) {
      if (name === 0) return 0
      name = UTF8ToString(name)
      if (!ENV.hasOwnProperty(name)) return 0
      if (_getenv.ret) _free(_getenv.ret)
      _getenv.ret = allocateUTF8(ENV[name])
      return _getenv.ret
    }
    function _llvm_stackrestore(p) {
      var self = _llvm_stacksave
      var ret = self.LLVM_SAVEDSTACKS[p]
      self.LLVM_SAVEDSTACKS.splice(p, 1)
      stackRestore(ret)
    }
    function _llvm_stacksave() {
      var self = _llvm_stacksave
      if (!self.LLVM_SAVEDSTACKS) {
        self.LLVM_SAVEDSTACKS = []
      }
      self.LLVM_SAVEDSTACKS.push(stackSave())
      return self.LLVM_SAVEDSTACKS.length - 1
    }
    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
    }
    function _pthread_attr_init(attr) {
      return 0
    }
    function _pthread_attr_setstacksize() {}
    function _pthread_cond_destroy() {
      return 0
    }
    function _pthread_cond_signal() {
      return 0
    }
    function _pthread_cond_wait() {
      return 0
    }
    function _pthread_create() {
      return 11
    }
    function _pthread_join() {}
    function abortOnCannotGrowMemory(requestedSize) {
      abort("OOM")
    }
    function _emscripten_resize_heap(requestedSize) {
      abortOnCannotGrowMemory(requestedSize)
    }
    function __isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    }
    function __arraySum(array, index) {
      var sum = 0
      for (var i = 0; i <= index; sum += array[i++]);
      return sum
    }
    var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    function __addDays(date, days) {
      var newDate = new Date(date.getTime())
      while (days > 0) {
        var leap = __isLeapYear(newDate.getFullYear())
        var currentMonth = newDate.getMonth()
        var daysInCurrentMonth = (leap
          ? __MONTH_DAYS_LEAP
          : __MONTH_DAYS_REGULAR)[currentMonth]
        if (days > daysInCurrentMonth - newDate.getDate()) {
          days -= daysInCurrentMonth - newDate.getDate() + 1
          newDate.setDate(1)
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth + 1)
          } else {
            newDate.setMonth(0)
            newDate.setFullYear(newDate.getFullYear() + 1)
          }
        } else {
          newDate.setDate(newDate.getDate() + days)
          return newDate
        }
      }
      return newDate
    }
    function _strftime(s, maxsize, format, tm) {
      var tm_zone = HEAP32[(tm + 40) >> 2]
      var date = {
        tm_sec: HEAP32[tm >> 2],
        tm_min: HEAP32[(tm + 4) >> 2],
        tm_hour: HEAP32[(tm + 8) >> 2],
        tm_mday: HEAP32[(tm + 12) >> 2],
        tm_mon: HEAP32[(tm + 16) >> 2],
        tm_year: HEAP32[(tm + 20) >> 2],
        tm_wday: HEAP32[(tm + 24) >> 2],
        tm_yday: HEAP32[(tm + 28) >> 2],
        tm_isdst: HEAP32[(tm + 32) >> 2],
        tm_gmtoff: HEAP32[(tm + 36) >> 2],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : "",
      }
      var pattern = UTF8ToString(format)
      var EXPANSION_RULES_1 = {
        "%c": "%a %b %d %H:%M:%S %Y",
        "%D": "%m/%d/%y",
        "%F": "%Y-%m-%d",
        "%h": "%b",
        "%r": "%I:%M:%S %p",
        "%R": "%H:%M",
        "%T": "%H:%M:%S",
        "%x": "%m/%d/%y",
        "%X": "%H:%M:%S",
        "%Ec": "%c",
        "%EC": "%C",
        "%Ex": "%m/%d/%y",
        "%EX": "%H:%M:%S",
        "%Ey": "%y",
        "%EY": "%Y",
        "%Od": "%d",
        "%Oe": "%e",
        "%OH": "%H",
        "%OI": "%I",
        "%Om": "%m",
        "%OM": "%M",
        "%OS": "%S",
        "%Ou": "%u",
        "%OU": "%U",
        "%OV": "%V",
        "%Ow": "%w",
        "%OW": "%W",
        "%Oy": "%y",
      }
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(
          new RegExp(rule, "g"),
          EXPANSION_RULES_1[rule],
        )
      }
      var WEEKDAYS = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ]
      var MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ]
      function leadingSomething(value, digits, character) {
        var str = typeof value === "number" ? value.toString() : value || ""
        while (str.length < digits) {
          str = character[0] + str
        }
        return str
      }
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, "0")
      }
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : value > 0 ? 1 : 0
        }
        var compare
        if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
            compare = sgn(date1.getDate() - date2.getDate())
          }
        }
        return compare
      }
      function getFirstWeekStartDate(janFourth) {
        switch (janFourth.getDay()) {
          case 0:
            return new Date(janFourth.getFullYear() - 1, 11, 29)
          case 1:
            return janFourth
          case 2:
            return new Date(janFourth.getFullYear(), 0, 3)
          case 3:
            return new Date(janFourth.getFullYear(), 0, 2)
          case 4:
            return new Date(janFourth.getFullYear(), 0, 1)
          case 5:
            return new Date(janFourth.getFullYear() - 1, 11, 31)
          case 6:
            return new Date(janFourth.getFullYear() - 1, 11, 30)
        }
      }
      function getWeekBasedYear(date) {
        var thisDate = __addDays(
          new Date(date.tm_year + 1900, 0, 1),
          date.tm_yday,
        )
        var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4)
        var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4)
        var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear)
        var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear)
        if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
          if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
            return thisDate.getFullYear() + 1
          } else {
            return thisDate.getFullYear()
          }
        } else {
          return thisDate.getFullYear() - 1
        }
      }
      var EXPANSION_RULES_2 = {
        "%a": function(date) {
          return WEEKDAYS[date.tm_wday].substring(0, 3)
        },
        "%A": function(date) {
          return WEEKDAYS[date.tm_wday]
        },
        "%b": function(date) {
          return MONTHS[date.tm_mon].substring(0, 3)
        },
        "%B": function(date) {
          return MONTHS[date.tm_mon]
        },
        "%C": function(date) {
          var year = date.tm_year + 1900
          return leadingNulls((year / 100) | 0, 2)
        },
        "%d": function(date) {
          return leadingNulls(date.tm_mday, 2)
        },
        "%e": function(date) {
          return leadingSomething(date.tm_mday, 2, " ")
        },
        "%g": function(date) {
          return getWeekBasedYear(date)
            .toString()
            .substring(2)
        },
        "%G": function(date) {
          return getWeekBasedYear(date)
        },
        "%H": function(date) {
          return leadingNulls(date.tm_hour, 2)
        },
        "%I": function(date) {
          var twelveHour = date.tm_hour
          if (twelveHour == 0) twelveHour = 12
          else if (twelveHour > 12) twelveHour -= 12
          return leadingNulls(twelveHour, 2)
        },
        "%j": function(date) {
          return leadingNulls(
            date.tm_mday +
              __arraySum(
                __isLeapYear(date.tm_year + 1900)
                  ? __MONTH_DAYS_LEAP
                  : __MONTH_DAYS_REGULAR,
                date.tm_mon - 1,
              ),
            3,
          )
        },
        "%m": function(date) {
          return leadingNulls(date.tm_mon + 1, 2)
        },
        "%M": function(date) {
          return leadingNulls(date.tm_min, 2)
        },
        "%n": function() {
          return "\n"
        },
        "%p": function(date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return "AM"
          } else {
            return "PM"
          }
        },
        "%S": function(date) {
          return leadingNulls(date.tm_sec, 2)
        },
        "%t": function() {
          return "\t"
        },
        "%u": function(date) {
          return date.tm_wday || 7
        },
        "%U": function(date) {
          var janFirst = new Date(date.tm_year + 1900, 0, 1)
          var firstSunday =
            janFirst.getDay() === 0
              ? janFirst
              : __addDays(janFirst, 7 - janFirst.getDay())
          var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday)
          if (compareByDay(firstSunday, endDate) < 0) {
            var februaryFirstUntilEndMonth =
              __arraySum(
                __isLeapYear(endDate.getFullYear())
                  ? __MONTH_DAYS_LEAP
                  : __MONTH_DAYS_REGULAR,
                endDate.getMonth() - 1,
              ) - 31
            var firstSundayUntilEndJanuary = 31 - firstSunday.getDate()
            var days =
              firstSundayUntilEndJanuary +
              februaryFirstUntilEndMonth +
              endDate.getDate()
            return leadingNulls(Math.ceil(days / 7), 2)
          }
          return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
        },
        "%V": function(date) {
          var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4)
          var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4)
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear)
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear)
          var endDate = __addDays(
            new Date(date.tm_year + 1900, 0, 1),
            date.tm_yday,
          )
          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            return "53"
          }
          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            return "01"
          }
          var daysDifference
          if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
            daysDifference =
              date.tm_yday + 32 - firstWeekStartThisYear.getDate()
          } else {
            daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
          }
          return leadingNulls(Math.ceil(daysDifference / 7), 2)
        },
        "%w": function(date) {
          return date.tm_wday
        },
        "%W": function(date) {
          var janFirst = new Date(date.tm_year, 0, 1)
          var firstMonday =
            janFirst.getDay() === 1
              ? janFirst
              : __addDays(
                  janFirst,
                  janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1,
                )
          var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday)
          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth =
              __arraySum(
                __isLeapYear(endDate.getFullYear())
                  ? __MONTH_DAYS_LEAP
                  : __MONTH_DAYS_REGULAR,
                endDate.getMonth() - 1,
              ) - 31
            var firstMondayUntilEndJanuary = 31 - firstMonday.getDate()
            var days =
              firstMondayUntilEndJanuary +
              februaryFirstUntilEndMonth +
              endDate.getDate()
            return leadingNulls(Math.ceil(days / 7), 2)
          }
          return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
        },
        "%y": function(date) {
          return (date.tm_year + 1900).toString().substring(2)
        },
        "%Y": function(date) {
          return date.tm_year + 1900
        },
        "%z": function(date) {
          var off = date.tm_gmtoff
          var ahead = off >= 0
          off = Math.abs(off) / 60
          off = (off / 60) * 100 + (off % 60)
          return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
        },
        "%Z": function(date) {
          return date.tm_zone
        },
        "%%": function() {
          return "%"
        },
      }
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.indexOf(rule) >= 0) {
          pattern = pattern.replace(
            new RegExp(rule, "g"),
            EXPANSION_RULES_2[rule](date),
          )
        }
      }
      var bytes = intArrayFromString(pattern, false)
      if (bytes.length > maxsize) {
        return 0
      }
      writeArrayToMemory(bytes, s)
      return bytes.length - 1
    }
    function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm)
    }
    if (ENVIRONMENT_IS_NODE) {
      _emscripten_get_now = function _emscripten_get_now_actual() {
        var t = process["hrtime"]()
        return t[0] * 1e3 + t[1] / 1e6
      }
    } else if (typeof dateNow !== "undefined") {
      _emscripten_get_now = dateNow
    } else if (
      typeof performance === "object" &&
      performance &&
      typeof performance["now"] === "function"
    ) {
      _emscripten_get_now = function() {
        return performance["now"]()
      }
    } else {
      _emscripten_get_now = Date.now
    }
    Module["requestFullScreen"] = function Module_requestFullScreen(
      lockPointer,
      resizeCanvas,
      vrDevice,
    ) {
      err(
        "Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.",
      )
      Module["requestFullScreen"] = Module["requestFullscreen"]
      Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
    }
    Module["requestFullscreen"] = function Module_requestFullscreen(
      lockPointer,
      resizeCanvas,
      vrDevice,
    ) {
      Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
    }
    Module["requestAnimationFrame"] = function Module_requestAnimationFrame(
      func,
    ) {
      Browser.requestAnimationFrame(func)
    }
    Module["setCanvasSize"] = function Module_setCanvasSize(
      width,
      height,
      noUpdates,
    ) {
      Browser.setCanvasSize(width, height, noUpdates)
    }
    Module["pauseMainLoop"] = function Module_pauseMainLoop() {
      Browser.mainLoop.pause()
    }
    Module["resumeMainLoop"] = function Module_resumeMainLoop() {
      Browser.mainLoop.resume()
    }
    Module["getUserMedia"] = function Module_getUserMedia() {
      Browser.getUserMedia()
    }
    Module["createContext"] = function Module_createContext(
      canvas,
      useWebGL,
      setInModule,
      webGLContextAttributes,
    ) {
      return Browser.createContext(
        canvas,
        useWebGL,
        setInModule,
        webGLContextAttributes,
      )
    }
    function intArrayFromString(stringy, dontAddNull, length) {
      var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1
      var u8array = new Array(len)
      var numBytesWritten = stringToUTF8Array(
        stringy,
        u8array,
        0,
        u8array.length,
      )
      if (dontAddNull) u8array.length = numBytesWritten
      return u8array
    }
    var asmGlobalArg = {}
    var asmLibraryArg = {
      c: abort,
      p: setTempRet0,
      u: getTempRet0,
      t: ___atomic_fetch_add_8,
      F: ___cxa_uncaught_exception,
      l: ___lock,
      s: ___map_file,
      k: ___setErrNo,
      r: ___syscall140,
      q: ___syscall145,
      j: ___syscall146,
      g: ___syscall221,
      K: ___syscall5,
      o: ___syscall54,
      n: ___syscall6,
      J: ___syscall91,
      f: ___unlock,
      b: _abort,
      I: _clock_gettime,
      i: _emscripten_async_call,
      H: _emscripten_get_heap_size,
      G: _emscripten_memcpy_big,
      E: _emscripten_resize_heap,
      D: _exit,
      h: _getenv,
      e: _llvm_stackrestore,
      d: _llvm_stacksave,
      C: _pthread_attr_init,
      B: _pthread_attr_setstacksize,
      A: _pthread_cond_destroy,
      z: _pthread_cond_signal,
      m: _pthread_cond_wait,
      y: _pthread_create,
      x: _pthread_join,
      w: _strftime_l,
      v: abortOnCannotGrowMemory,
      a: DYNAMICTOP_PTR,
    }
    var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer)
    var _free = (Module["_free"] = asm["L"])
    var _i64Add = (Module["_i64Add"] = asm["M"])
    var _init = (Module["_init"] = asm["N"])
    var _malloc = (Module["_malloc"] = asm["O"])
    var _uci_command = (Module["_uci_command"] = asm["P"])
    var globalCtors = (Module["globalCtors"] = asm["ja"])
    var stackAlloc = (Module["stackAlloc"] = asm["ka"])
    var stackRestore = (Module["stackRestore"] = asm["la"])
    var stackSave = (Module["stackSave"] = asm["ma"])
    var dynCall_ii = (Module["dynCall_ii"] = asm["Q"])
    var dynCall_iidiiii = (Module["dynCall_iidiiii"] = asm["R"])
    var dynCall_iii = (Module["dynCall_iii"] = asm["S"])
    var dynCall_iiii = (Module["dynCall_iiii"] = asm["T"])
    var dynCall_iiiii = (Module["dynCall_iiiii"] = asm["U"])
    var dynCall_iiiiid = (Module["dynCall_iiiiid"] = asm["V"])
    var dynCall_iiiiii = (Module["dynCall_iiiiii"] = asm["W"])
    var dynCall_iiiiiid = (Module["dynCall_iiiiiid"] = asm["X"])
    var dynCall_iiiiiii = (Module["dynCall_iiiiiii"] = asm["Y"])
    var dynCall_iiiiiiii = (Module["dynCall_iiiiiiii"] = asm["Z"])
    var dynCall_iiiiiiiii = (Module["dynCall_iiiiiiiii"] = asm["_"])
    var dynCall_iiiiij = (Module["dynCall_iiiiij"] = asm["$"])
    var dynCall_jiji = (Module["dynCall_jiji"] = asm["aa"])
    var dynCall_v = (Module["dynCall_v"] = asm["ba"])
    var dynCall_vi = (Module["dynCall_vi"] = asm["ca"])
    var dynCall_vii = (Module["dynCall_vii"] = asm["da"])
    var dynCall_viii = (Module["dynCall_viii"] = asm["ea"])
    var dynCall_viiii = (Module["dynCall_viiii"] = asm["fa"])
    var dynCall_viiiii = (Module["dynCall_viiiii"] = asm["ga"])
    var dynCall_viiiiii = (Module["dynCall_viiiiii"] = asm["ha"])
    var dynCall_viijii = (Module["dynCall_viijii"] = asm["ia"])
    Module["asm"] = asm
    Module["ccall"] = ccall
    function ExitStatus(status) {
      this.name = "ExitStatus"
      this.message = "Program terminated with exit(" + status + ")"
      this.status = status
    }
    ExitStatus.prototype = new Error()
    ExitStatus.prototype.constructor = ExitStatus
    var calledMain = false
    dependenciesFulfilled = function runCaller() {
      if (!Module["calledRun"]) run()
      if (!Module["calledRun"]) dependenciesFulfilled = runCaller
    }
    Module["callMain"] = function callMain(args) {
      args = args || []
      var argc = args.length + 1
      var argv = stackAlloc((argc + 1) * 4)
      HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"])
      for (var i = 1; i < argc; i++) {
        HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
      }
      HEAP32[(argv >> 2) + argc] = 0
      try {
        var ret = Module["_main"](argc, argv, 0)
        exit(ret, true)
      } catch (e) {
        if (e instanceof ExitStatus) {
          return
        } else if (e == "SimulateInfiniteLoop") {
          Module["noExitRuntime"] = true
          return
        } else {
          var toLog = e
          if (e && typeof e === "object" && e.stack) {
            toLog = [e, e.stack]
          }
          err("exception thrown: " + toLog)
          Module["quit"](1, e)
        }
      } finally {
        calledMain = true
      }
    }
    function run(args) {
      args = args || Module["arguments"]
      if (runDependencies > 0) {
        return
      }
      preRun()
      if (runDependencies > 0) return
      if (Module["calledRun"]) return
      function doRun() {
        if (Module["calledRun"]) return
        Module["calledRun"] = true
        if (ABORT) return
        initRuntime()
        preMain()
        if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]()
        if (Module["_main"] && shouldRunNow) Module["callMain"](args)
        postRun()
      }
      if (Module["setStatus"]) {
        Module["setStatus"]("Running...")
        setTimeout(function() {
          setTimeout(function() {
            Module["setStatus"]("")
          }, 1)
          doRun()
        }, 1)
      } else {
        doRun()
      }
    }
    Module["run"] = run
    function exit(status, implicit) {
      if (implicit && Module["noExitRuntime"] && status === 0) {
        return
      }
      if (Module["noExitRuntime"]) {
      } else {
        ABORT = true
        EXITSTATUS = status
        exitRuntime()
        if (Module["onExit"]) Module["onExit"](status)
      }
      Module["quit"](status, new ExitStatus(status))
    }
    function abort(what) {
      if (Module["onAbort"]) {
        Module["onAbort"](what)
      }
      if (what !== undefined) {
        out(what)
        err(what)
        what = '"' + what + '"'
      } else {
        what = ""
      }
      ABORT = true
      EXITSTATUS = 1
      throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
    }
    Module["abort"] = abort
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]]
      while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
      }
    }
    var shouldRunNow = true
    if (Module["noInitialRun"]) {
      shouldRunNow = false
    }
    Module["noExitRuntime"] = true
    run()
    var ourSetImmediate = (function(global, undefined) {
      "use strict"
      if (global.setImmediate) {
        try {
          return global.setImmediate.bind(global)
        } catch (e) {
          return global.setImmediate
        }
      }
      var nextHandle = 1
      var tasksByHandle = {}
      var currentlyRunningATask = false
      var doc = global.document
      var setImmediate
      function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args)
        return nextHandle++
      }
      function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1)
        return function() {
          if (typeof handler === "function") {
            handler.apply(undefined, args)
          } else {
            new Function("" + handler)()
          }
        }
      }
      function runIfPresent(handle) {
        if (currentlyRunningATask) {
          setTimeout(partiallyApplied(runIfPresent, handle), 0)
        } else {
          var task = tasksByHandle[handle]
          if (task) {
            currentlyRunningATask = true
            try {
              task()
            } finally {
              clearImmediate(handle)
              currentlyRunningATask = false
            }
          }
        }
      }
      function clearImmediate(handle) {
        delete tasksByHandle[handle]
      }
      function installNextTickImplementation() {
        setImmediate = function() {
          var handle = addFromSetImmediateArguments(arguments)
          process.nextTick(partiallyApplied(runIfPresent, handle))
          return handle
        }
      }
      function canUsePostMessage() {
        if (global.postMessage && !global.importScripts) {
          var postMessageIsAsynchronous = true
          var oldOnMessage = global.onmessage
          global.onmessage = function() {
            postMessageIsAsynchronous = false
          }
          global.postMessage("", "*")
          global.onmessage = oldOnMessage
          return postMessageIsAsynchronous
        }
      }
      function installPostMessageImplementation() {
        var messagePrefix = "setImmediate$" + Math.random() + "$"
        var onGlobalMessage = function(event) {
          if (
            event.source === global &&
            typeof event.data === "string" &&
            event.data.indexOf(messagePrefix) === 0
          ) {
            runIfPresent(+event.data.slice(messagePrefix.length))
          }
        }
        if (global.addEventListener) {
          global.addEventListener("message", onGlobalMessage, false)
        } else {
          global.attachEvent("onmessage", onGlobalMessage)
        }
        setImmediate = function() {
          var handle = addFromSetImmediateArguments(arguments)
          global.postMessage(messagePrefix + handle, "*")
          return handle
        }
      }
      function installMessageChannelImplementation() {
        var channel = new MessageChannel()
        channel.port1.onmessage = function(event) {
          var handle = event.data
          runIfPresent(handle)
        }
        setImmediate = function() {
          var handle = addFromSetImmediateArguments(arguments)
          channel.port2.postMessage(handle)
          return handle
        }
      }
      function installReadyStateChangeImplementation() {
        var html = doc.documentElement
        setImmediate = function() {
          var handle = addFromSetImmediateArguments(arguments)
          var script = doc.createElement("script")
          script.onreadystatechange = function() {
            runIfPresent(handle)
            script.onreadystatechange = null
            html.removeChild(script)
            script = null
          }
          html.appendChild(script)
          return handle
        }
      }
      function installSetTimeoutImplementation() {
        setImmediate = function() {
          var handle = addFromSetImmediateArguments(arguments)
          setTimeout(partiallyApplied(runIfPresent, handle), 0)
          return handle
        }
      }
      if ({}.toString.call(global.process) === "[object process]") {
        installNextTickImplementation()
      } else if (canUsePostMessage()) {
        installPostMessageImplementation()
      } else if (global.MessageChannel) {
        installMessageChannelImplementation()
      } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        installReadyStateChangeImplementation()
      } else {
        installSetTimeoutImplementation()
      }
      return setImmediate
    })(
      typeof self === "undefined"
        ? typeof global === "undefined"
          ? this
          : global
        : self,
    )
    Browser.requestAnimationFrame = ourSetImmediate
    return Module
  }
  return function(WasmPath) {
    var myConsole,
      Module,
      workerObj,
      cmds = [],
      wait = typeof setImmediate === "function" ? setImmediate : setTimeout
    myConsole = {
      log: function log(line) {
        if (workerObj.onmessage) {
          workerObj.onmessage(line)
        } else {
          console.error("You must set onmessage")
          console.info(line)
        }
      },
      time: function time(s) {
        if (typeof console !== "undefined" && console.time) console.time(s)
      },
      timeEnd: function timeEnd(s) {
        if (typeof console !== "undefined" && console.timeEnd)
          console.timeEnd(s)
      },
    }
    myConsole.warn = myConsole.log
    workerObj = {
      postMessage: function sendMessage(str, sync) {
        function ccall() {
          if (Module) {
            Module.ccall("uci_command", "number", ["string"], [cmds.shift()])
          } else {
            setTimeout(ccall, 100)
          }
        }
        cmds.push(str)
        if (sync) {
          ccall()
        } else {
          wait(ccall, 1)
        }
      },
    }
    wait(function() {
      Module = load_stockfish(myConsole, WasmPath)
      if (Module.print) {
        Module.print = myConsole.log
      }
      if (Module.printErr) {
        Module.printErr = myConsole.log
      }
      Module.ccall("init", "number", [], [])
    }, 1)
    return workerObj
  }
})()
;(function() {
  var isNode, stockfish
  function completer(line) {
    var completions = [
      "d",
      "eval",
      "exit",
      "flip",
      "go",
      "isready",
      "ponderhit",
      "position fen ",
      "position startpos",
      "position startpos moves",
      "quit",
      "setoption name Clear Hash value ",
      "setoption name Contempt value ",
      "setoption name Hash value ",
      "setoption name Minimum Thinking Time value ",
      "setoption name Move Overhead value ",
      "setoption name MultiPV value ",
      "setoption name Ponder value ",
      "setoption name Skill Level Maximum Error value ",
      "setoption name Skill Level Probability value ",
      "setoption name Skill Level value ",
      "setoption name Slow Mover value ",
      "setoption name Threads value ",
      "setoption name UCI_Chess960 value false",
      "setoption name UCI_Chess960 value true",
      "setoption name UCI_Variant value chess",
      "setoption name UCI_Variant value atomic",
      "setoption name UCI_Variant value crazyhouse",
      "setoption name UCI_Variant value giveaway",
      "setoption name UCI_Variant value horde",
      "setoption name UCI_Variant value kingofthehill",
      "setoption name UCI_Variant value racingkings",
      "setoption name UCI_Variant value relay",
      "setoption name UCI_Variant value threecheck",
      "setoption name nodestime value ",
      "stop",
      "uci",
      "ucinewgame",
    ]
    var completionsMid = [
      "binc ",
      "btime ",
      "confidence ",
      "depth ",
      "infinite ",
      "mate ",
      "maxdepth ",
      "maxtime ",
      "mindepth ",
      "mintime ",
      "moves ",
      "movestogo ",
      "movetime ",
      "ponder ",
      "searchmoves ",
      "shallow ",
      "winc ",
      "wtime ",
    ]
    function filter(c) {
      return c.indexOf(line) === 0
    }
    var hits = completions.filter(filter)
    if (!hits.length) {
      line = line.replace(/^.*\s/, "")
      if (line) {
        hits = completionsMid.filter(filter)
      } else {
        hits = completionsMid
      }
    }
    return [hits, line]
  }
  isNode =
    typeof global !== "undefined" &&
    Object.prototype.toString.call(global.process) === "[object process]"
  if (isNode) {
    if (require.main === module) {
      stockfish = STOCKFISH(require("path").join(__dirname, "stockfish.wasm"))
      stockfish.onmessage = function onlog(line) {
        console.log(line)
      }
      require("readline")
        .createInterface({
          input: process.stdin,
          output: process.stdout,
          completer: completer,
          historySize: 100,
        })
        .on("line", function online(line) {
          if (line) {
            if (line === "quit" || line === "exit") {
              process.exit()
            }
            stockfish.postMessage(line, true)
          }
        })
        .setPrompt("")
      process.stdin.on("end", function onend() {
        process.exit()
      })
    } else {
      module.exports = function SF(WasmPath) {
        return STOCKFISH(
          WasmPath || require("path").join(__dirname, "stockfish.wasm"),
        )
      }
    }
  } else if (
    typeof onmessage !== "undefined" &&
    (typeof window === "undefined" || typeof window.document === "undefined")
  ) {
    if (self && self.location && self.location.hash) {
      stockfish = STOCKFISH(self.location.hash.substr(1))
    } else {
      stockfish = STOCKFISH()
    }
    onmessage = function(event) {
      stockfish.postMessage(event.data, true)
    }
    stockfish.onmessage = function onlog(line) {
      postMessage(line)
    }
  }
})()