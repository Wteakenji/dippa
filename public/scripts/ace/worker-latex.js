"no use strict";

var console = {
    log: function(msg) {
        postMessage({type: "log", data: msg});
    }
};
var window = {
    console: console
};

var normalizeModule = function(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return normalizeModule(parentId, chunks[0]) + "!" + normalizeModule(parentId, chunks[1]);
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
        var base = parentId.split("/").slice(0, -1).join("/");
        var moduleName = base + "/" + moduleName;

        while(moduleName.indexOf(".") !== -1 && previous != moduleName) {
            var previous = moduleName;
            var moduleName = moduleName.replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }

    return moduleName;
};

var require = function(parentId, id) {
    var id = normalizeModule(parentId, id);

    var module = require.modules[id];
    if (module) {
        if (!module.initialized) {
            module.exports = module.factory().exports;
            module.initialized = true;
        }
        return module.exports;
    }

    var chunks = id.split("/");
    chunks[0] = require.tlns[chunks[0]] || chunks[0];
    var path = chunks.join("/") + ".js";

    require.id = id;
    throw "trying to REQUIRE path " + path;
    importScripts(path);
    return require(parentId, id);
};

require.modules = {};
require.tlns = {};

var define = function(id, deps, factory) {
    if (arguments.length == 2) {
        factory = deps;
    } else if (arguments.length == 1) {
        factory = id;
        id = require.id;
    }

    if (id.indexOf("text!") === 0)
        return;

    var req = function(deps, factory) {
        return require(id, deps, factory);
    };

    require.modules[id] = {
        factory: function() {
            var module = {
                exports: {}
            };
            var returnExports = factory(req, module.exports, module);
            if (returnExports)
                module.exports = returnExports;
            return module;
        }
    };
};

function initBaseUrls(topLevelNamespaces) {
    require.tlns = topLevelNamespaces;
}

function initSender() {

    var EventEmitter = require(null, "ace/lib/event_emitter").EventEmitter;
    var oop = require(null, "ace/lib/oop");

    var Sender = function() {};

    (function() {

        oop.implement(this, EventEmitter);

        this.callback = function(data, callbackId) {
            postMessage({
                type: "call",
                id: callbackId,
                data: data
            });
        };

        this.emit = function(name, data) {
            postMessage({
                type: "event",
                name: name,
                data: data
            });
        };

    }).call(Sender.prototype);

    return new Sender();
}

var main;
var sender;

onmessage = function(e) {
    var msg = e.data;
    // throw JSON.stringify({'message': 'onmessage', 'msg': msg});
    if (msg.command) {
        main[msg.command].apply(main, msg.args);
    }
    else if (msg.init) {
        initBaseUrls(msg.tlns);
        require(null, "ace/lib/fixoldbrowsers");
        sender = initSender();
        var clazz = require(null, msg.module)[msg.classname];
        main = new clazz(sender);
    }
    else if (msg.event && sender) {
        sender._emit(msg.event, msg.data);
    }
};
// vim:set ts=4 sts=4 sw=4 st:
// -- kriskowal Kris Kowal Copyright (C) 2009-2010 MIT License
// -- tlrobinson Tom Robinson Copyright (C) 2009-2010 MIT License (Narwhal Project)
// -- dantman Daniel Friesen Copyright(C) 2010 XXX No License Specified
// -- fschaefer Florian Schäfer Copyright (C) 2010 MIT License
// -- Irakli Gozalishvili Copyright (C) 2010 MIT License

/*!
 Copyright (c) 2009, 280 North Inc. http://280north.com/
 MIT License. http://github.com/280north/narwhal/blob/master/README.md
 */

define('ace/lib/fixoldbrowsers', ['require', 'exports', 'module' , 'ace/lib/regexp', 'ace/lib/es5-shim'], function(require, exports, module) {
    "use strict";

    require("./regexp");
    require("./es5-shim");

});/**
 *  Based on code from:
 *
 * XRegExp 1.5.0
 * (c) 2007-2010 Steven Levithan
 * MIT License
 * <http://xregexp.com>
 * Provides an augmented, extensible, cross-browser implementation of regular expressions,
 * including support for additional syntax, flags, and methods
 */

define('ace/lib/regexp', ['require', 'exports', 'module' ], function(require, exports, module) {
    "use strict";

    //---------------------------------
    //  Private variables
    //---------------------------------

    var real = {
        exec: RegExp.prototype.exec,
        test: RegExp.prototype.test,
        match: String.prototype.match,
        replace: String.prototype.replace,
        split: String.prototype.split
    },
        compliantExecNpcg = real.exec.call(/()??/, "")[1] === undefined, // check `exec` handling of nonparticipating capturing groups
        compliantLastIndexIncrement = function () {
            var x = /^/g;
            real.test.call(x, "");
            return !x.lastIndex;
        }();

    //---------------------------------
    //  Overriden native methods
    //---------------------------------

    // Adds named capture support (with backreferences returned as `result.name`), and fixes two
    // cross-browser issues per ES3:
    // - Captured values for nonparticipating capturing groups should be returned as `undefined`,
    //   rather than the empty string.
    // - `lastIndex` should not be incremented after zero-length matches.
    RegExp.prototype.exec = function (str) {
        var match = real.exec.apply(this, arguments),
            name, r2;
        if ( typeof(str) == 'string' && match) {
            // Fix browsers whose `exec` methods don't consistently return `undefined` for
            // nonparticipating capturing groups
            if (!compliantExecNpcg && match.length > 1 && indexOf(match, "") > -1) {
                r2 = RegExp(this.source, real.replace.call(getNativeFlags(this), "g", ""));
                // Using `str.slice(match.index)` rather than `match[0]` in case lookahead allowed
                // matching due to characters outside the match
                real.replace.call(str.slice(match.index), r2, function () {
                    for (var i = 1; i < arguments.length - 2; i++) {
                        if (arguments[i] === undefined)
                            match[i] = undefined;
                    }
                });
            }
            // Attach named capture properties
            if (this._xregexp && this._xregexp.captureNames) {
                for (var i = 1; i < match.length; i++) {
                    name = this._xregexp.captureNames[i - 1];
                    if (name)
                        match[name] = match[i];
                }
            }
            // Fix browsers that increment `lastIndex` after zero-length matches
            if (!compliantLastIndexIncrement && this.global && !match[0].length && (this.lastIndex > match.index))
                this.lastIndex--;
        }
        return match;
    };

    // Don't override `test` if it won't change anything
    if (!compliantLastIndexIncrement) {
        // Fix browser bug in native method
        RegExp.prototype.test = function (str) {
            // Use the native `exec` to skip some processing overhead, even though the overriden
            // `exec` would take care of the `lastIndex` fix
            var match = real.exec.call(this, str);
            // Fix browsers that increment `lastIndex` after zero-length matches
            if (match && this.global && !match[0].length && (this.lastIndex > match.index))
                this.lastIndex--;
            return !!match;
        };
    }

    //---------------------------------
    //  Private helper functions
    //---------------------------------

    function getNativeFlags (regex) {
        return (regex.global     ? "g" : "") +
            (regex.ignoreCase ? "i" : "") +
            (regex.multiline  ? "m" : "") +
            (regex.extended   ? "x" : "") + // Proposed for ES4; included in AS3
            (regex.sticky     ? "y" : "");
    };

    function indexOf (array, item, from) {
        if (Array.prototype.indexOf) // Use the native array method if available
            return array.indexOf(item, from);
        for (var i = from || 0; i < array.length; i++) {
            if (array[i] === item)
                return i;
        }
        return -1;
    };

});
// vim: ts=4 sts=4 sw=4 expandtab
// -- kriskowal Kris Kowal Copyright (C) 2009-2011 MIT License
// -- tlrobinson Tom Robinson Copyright (C) 2009-2010 MIT License (Narwhal Project)
// -- dantman Daniel Friesen Copyright (C) 2010 XXX TODO License or CLA
// -- fschaefer Florian Schäfer Copyright (C) 2010 MIT License
// -- Gozala Irakli Gozalishvili Copyright (C) 2010 MIT License
// -- kitcambridge Kit Cambridge Copyright (C) 2011 MIT License
// -- kossnocorp Sasha Koss XXX TODO License or CLA
// -- bryanforbes Bryan Forbes XXX TODO License or CLA
// -- killdream Quildreen Motta Copyright (C) 2011 MIT Licence
// -- michaelficarra Michael Ficarra Copyright (C) 2011 3-clause BSD License
// -- sharkbrainguy Gerard Paapu Copyright (C) 2011 MIT License
// -- bbqsrc Brendan Molloy (C) 2011 Creative Commons Zero (public domain)
// -- iwyg XXX TODO License or CLA
// -- DomenicDenicola Domenic Denicola Copyright (C) 2011 MIT License
// -- xavierm02 Montillet Xavier XXX TODO License or CLA
// -- Raynos Raynos XXX TODO License or CLA
// -- samsonjs Sami Samhuri Copyright (C) 2010 MIT License
// -- rwldrn Rick Waldron Copyright (C) 2011 MIT License
// -- lexer Alexey Zakharov XXX TODO License or CLA

/*!
 Copyright (c) 2009, 280 North Inc. http://280north.com/
 MIT License. http://github.com/280north/narwhal/blob/master/README.md
 */

define('ace/lib/es5-shim', ['require', 'exports', 'module' ], function(require, exports, module) {

    /**
     * Brings an environment as close to ECMAScript 5 compliance
     * as is possible with the facilities of erstwhile engines.
     *
     * Annotated ES5: http://es5.github.com/ (specific links below)
     * ES5 Spec: http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf
     *
     * @module
     */

    /*whatsupdoc*/

//
// Function
// ========
//

// ES-5 15.3.4.5
// http://es5.github.com/#x15.3.4.5

    if (!Function.prototype.bind) {
        Function.prototype.bind = function bind(that) { // .length is 1
            // 1. Let Target be the this value.
            var target = this;
            // 2. If IsCallable(Target) is false, throw a TypeError exception.
            if (typeof target != "function")
                throw new TypeError(); // TODO message
            // 3. Let A be a new (possibly empty) internal list of all of the
            //   argument values provided after thisArg (arg1, arg2 etc), in order.
            // XXX slicedArgs will stand in for "A" if used
            var args = slice.call(arguments, 1); // for normal call
            // 4. Let F be a new native ECMAScript object.
            // 11. Set the [[Prototype]] internal property of F to the standard
            //   built-in Function prototype object as specified in 15.3.3.1.
            // 12. Set the [[Call]] internal property of F as described in
            //   15.3.4.5.1.
            // 13. Set the [[Construct]] internal property of F as described in
            //   15.3.4.5.2.
            // 14. Set the [[HasInstance]] internal property of F as described in
            //   15.3.4.5.3.
            var bound = function () {

                if (this instanceof bound) {
                    // 15.3.4.5.2 [[Construct]]
                    // When the [[Construct]] internal method of a function object,
                    // F that was created using the bind function is called with a
                    // list of arguments ExtraArgs, the following steps are taken:
                    // 1. Let target be the value of F's [[TargetFunction]]
                    //   internal property.
                    // 2. If target has no [[Construct]] internal method, a
                    //   TypeError exception is thrown.
                    // 3. Let boundArgs be the value of F's [[BoundArgs]] internal
                    //   property.
                    // 4. Let args be a new list containing the same values as the
                    //   list boundArgs in the same order followed by the same
                    //   values as the list ExtraArgs in the same order.
                    // 5. Return the result of calling the [[Construct]] internal
                    //   method of target providing args as the arguments.

                    var F = function(){};
                    F.prototype = target.prototype;
                    var self = new F;

                    var result = target.apply(
                        self,
                        args.concat(slice.call(arguments))
                    );
                    if (result !== null && Object(result) === result)
                        return result;
                    return self;

                } else {
                    // 15.3.4.5.1 [[Call]]
                    // When the [[Call]] internal method of a function object, F,
                    // which was created using the bind function is called with a
                    // this value and a list of arguments ExtraArgs, the following
                    // steps are taken:
                    // 1. Let boundArgs be the value of F's [[BoundArgs]] internal
                    //   property.
                    // 2. Let boundThis be the value of F's [[BoundThis]] internal
                    //   property.
                    // 3. Let target be the value of F's [[TargetFunction]] internal
                    //   property.
                    // 4. Let args be a new list containing the same values as the
                    //   list boundArgs in the same order followed by the same
                    //   values as the list ExtraArgs in the same order.
                    // 5. Return the result of calling the [[Call]] internal method
                    //   of target providing boundThis as the this value and
                    //   providing args as the arguments.

                    // equiv: target.call(this, ...boundArgs, ...args)
                    return target.apply(
                        that,
                        args.concat(slice.call(arguments))
                    );

                }

            };
            // XXX bound.length is never writable, so don't even try
            //
            // 15. If the [[Class]] internal property of Target is "Function", then
            //     a. Let L be the length property of Target minus the length of A.
            //     b. Set the length own property of F to either 0 or L, whichever is
            //       larger.
            // 16. Else set the length own property of F to 0.
            // 17. Set the attributes of the length own property of F to the values
            //   specified in 15.3.5.1.

            // TODO
            // 18. Set the [[Extensible]] internal property of F to true.

            // TODO
            // 19. Let thrower be the [[ThrowTypeError]] function Object (13.2.3).
            // 20. Call the [[DefineOwnProperty]] internal method of F with
            //   arguments "caller", PropertyDescriptor {[[Get]]: thrower, [[Set]]:
            //   thrower, [[Enumerable]]: false, [[Configurable]]: false}, and
            //   false.
            // 21. Call the [[DefineOwnProperty]] internal method of F with
            //   arguments "arguments", PropertyDescriptor {[[Get]]: thrower,
            //   [[Set]]: thrower, [[Enumerable]]: false, [[Configurable]]: false},
            //   and false.

            // TODO
            // NOTE Function objects created using Function.prototype.bind do not
            // have a prototype property or the [[Code]], [[FormalParameters]], and
            // [[Scope]] internal properties.
            // XXX can't delete prototype in pure-js.

            // 22. Return F.
            return bound;
        };
    }

// Shortcut to an often accessed properties, in order to avoid multiple
// dereference that costs universally.
// _Please note: Shortcuts are defined after `Function.prototype.bind` as we
// us it in defining shortcuts.
    var call = Function.prototype.call;
    var prototypeOfArray = Array.prototype;
    var prototypeOfObject = Object.prototype;
    var slice = prototypeOfArray.slice;
    var toString = call.bind(prototypeOfObject.toString);
    var owns = call.bind(prototypeOfObject.hasOwnProperty);

// If JS engine supports accessors creating shortcuts.
    var defineGetter;
    var defineSetter;
    var lookupGetter;
    var lookupSetter;
    var supportsAccessors;
    if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
        defineGetter = call.bind(prototypeOfObject.__defineGetter__);
        defineSetter = call.bind(prototypeOfObject.__defineSetter__);
        lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
        lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
    }

//
// Array
// =====
//

// ES5 15.4.3.2
// http://es5.github.com/#x15.4.3.2
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/isArray
    if (!Array.isArray) {
        Array.isArray = function isArray(obj) {
            return toString(obj) == "[object Array]";
        };
    }

// The IsCallable() check in the Array functions
// has been replaced with a strict check on the
// internal class of the object to trap cases where
// the provided function was actually a regular
// expression literal, which in V8 and
// JavaScriptCore is a typeof "function".  Only in
// V8 are regular expression literals permitted as
// reduce parameters, so it is desirable in the
// general case for the shim to match the more
// strict and common behavior of rejecting regular
// expressions.

// ES5 15.4.4.18
// http://es5.github.com/#x15.4.4.18
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/array/forEach
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function forEach(fun /*, thisp*/) {
            var self = toObject(this),
                thisp = arguments[1],
                i = 0,
                length = self.length >>> 0;

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            while (i < length) {
                if (i in self) {
                    // Invoke the callback function with call, passing arguments:
                    // context, property value, property key, thisArg object context
                    fun.call(thisp, self[i], i, self);
                }
                i++;
            }
        };
    }

// ES5 15.4.4.19
// http://es5.github.com/#x15.4.4.19
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/map
    if (!Array.prototype.map) {
        Array.prototype.map = function map(fun /*, thisp*/) {
            var self = toObject(this),
                length = self.length >>> 0,
                result = Array(length),
                thisp = arguments[1];

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            for (var i = 0; i < length; i++) {
                if (i in self)
                    result[i] = fun.call(thisp, self[i], i, self);
            }
            return result;
        };
    }

// ES5 15.4.4.20
// http://es5.github.com/#x15.4.4.20
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/filter
    if (!Array.prototype.filter) {
        Array.prototype.filter = function filter(fun /*, thisp */) {
            var self = toObject(this),
                length = self.length >>> 0,
                result = [],
                thisp = arguments[1];

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            for (var i = 0; i < length; i++) {
                if (i in self && fun.call(thisp, self[i], i, self))
                    result.push(self[i]);
            }
            return result;
        };
    }

// ES5 15.4.4.16
// http://es5.github.com/#x15.4.4.16
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/every
    if (!Array.prototype.every) {
        Array.prototype.every = function every(fun /*, thisp */) {
            var self = toObject(this),
                length = self.length >>> 0,
                thisp = arguments[1];

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            for (var i = 0; i < length; i++) {
                if (i in self && !fun.call(thisp, self[i], i, self))
                    return false;
            }
            return true;
        };
    }

// ES5 15.4.4.17
// http://es5.github.com/#x15.4.4.17
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some
    if (!Array.prototype.some) {
        Array.prototype.some = function some(fun /*, thisp */) {
            var self = toObject(this),
                length = self.length >>> 0,
                thisp = arguments[1];

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            for (var i = 0; i < length; i++) {
                if (i in self && fun.call(thisp, self[i], i, self))
                    return true;
            }
            return false;
        };
    }

// ES5 15.4.4.21
// http://es5.github.com/#x15.4.4.21
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduce
    if (!Array.prototype.reduce) {
        Array.prototype.reduce = function reduce(fun /*, initial*/) {
            var self = toObject(this),
                length = self.length >>> 0;

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            // no value to return if no initial value and an empty array
            if (!length && arguments.length == 1)
                throw new TypeError(); // TODO message

            var i = 0;
            var result;
            if (arguments.length >= 2) {
                result = arguments[1];
            } else {
                do {
                    if (i in self) {
                        result = self[i++];
                        break;
                    }

                    // if array contains no values, no initial value to return
                    if (++i >= length)
                        throw new TypeError(); // TODO message
                } while (true);
            }

            for (; i < length; i++) {
                if (i in self)
                    result = fun.call(void 0, result, self[i], i, self);
            }

            return result;
        };
    }

// ES5 15.4.4.22
// http://es5.github.com/#x15.4.4.22
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduceRight
    if (!Array.prototype.reduceRight) {
        Array.prototype.reduceRight = function reduceRight(fun /*, initial*/) {
            var self = toObject(this),
                length = self.length >>> 0;

            // If no callback function or if callback is not a callable function
            if (toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            // no value to return if no initial value, empty array
            if (!length && arguments.length == 1)
                throw new TypeError(); // TODO message

            var result, i = length - 1;
            if (arguments.length >= 2) {
                result = arguments[1];
            } else {
                do {
                    if (i in self) {
                        result = self[i--];
                        break;
                    }

                    // if array contains no values, no initial value to return
                    if (--i < 0)
                        throw new TypeError(); // TODO message
                } while (true);
            }

            do {
                if (i in this)
                    result = fun.call(void 0, result, self[i], i, self);
            } while (i--);

            return result;
        };
    }

// ES5 15.4.4.14
// http://es5.github.com/#x15.4.4.14
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function indexOf(sought /*, fromIndex */ ) {
            var self = toObject(this),
                length = self.length >>> 0;

            if (!length)
                return -1;

            var i = 0;
            if (arguments.length > 1)
                i = toInteger(arguments[1]);

            // handle negative indices
            i = i >= 0 ? i : Math.max(0, length + i);
            for (; i < length; i++) {
                if (i in self && self[i] === sought) {
                    return i;
                }
            }
            return -1;
        };
    }

// ES5 15.4.4.15
// http://es5.github.com/#x15.4.4.15
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/lastIndexOf
    if (!Array.prototype.lastIndexOf) {
        Array.prototype.lastIndexOf = function lastIndexOf(sought /*, fromIndex */) {
            var self = toObject(this),
                length = self.length >>> 0;

            if (!length)
                return -1;
            var i = length - 1;
            if (arguments.length > 1)
                i = Math.min(i, toInteger(arguments[1]));
            // handle negative indices
            i = i >= 0 ? i : length - Math.abs(i);
            for (; i >= 0; i--) {
                if (i in self && sought === self[i])
                    return i;
            }
            return -1;
        };
    }

//
// Object
// ======
//

// ES5 15.2.3.2
// http://es5.github.com/#x15.2.3.2
    if (!Object.getPrototypeOf) {
        // https://github.com/kriskowal/es5-shim/issues#issue/2
        // http://ejohn.org/blog/objectgetprototypeof/
        // recommended by fschaefer on github
        Object.getPrototypeOf = function getPrototypeOf(object) {
            return object.__proto__ || (
                object.constructor ?
                    object.constructor.prototype :
                    prototypeOfObject
                );
        };
    }

// ES5 15.2.3.3
// http://es5.github.com/#x15.2.3.3
    if (!Object.getOwnPropertyDescriptor) {
        var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a " +
            "non-object: ";
        Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
            if ((typeof object != "object" && typeof object != "function") || object === null)
                throw new TypeError(ERR_NON_OBJECT + object);
            // If object does not owns property return undefined immediately.
            if (!owns(object, property))
                return;

            var descriptor, getter, setter;

            // If object has a property then it's for sure both `enumerable` and
            // `configurable`.
            descriptor =  { enumerable: true, configurable: true };

            // If JS engine supports accessor properties then property may be a
            // getter or setter.
            if (supportsAccessors) {
                // Unfortunately `__lookupGetter__` will return a getter even
                // if object has own non getter property along with a same named
                // inherited getter. To avoid misbehavior we temporary remove
                // `__proto__` so that `__lookupGetter__` will return getter only
                // if it's owned by an object.
                var prototype = object.__proto__;
                object.__proto__ = prototypeOfObject;

                var getter = lookupGetter(object, property);
                var setter = lookupSetter(object, property);

                // Once we have getter and setter we can put values back.
                object.__proto__ = prototype;

                if (getter || setter) {
                    if (getter) descriptor.get = getter;
                    if (setter) descriptor.set = setter;

                    // If it was accessor property we're done and return here
                    // in order to avoid adding `value` to the descriptor.
                    return descriptor;
                }
            }

            // If we got this far we know that object has an own property that is
            // not an accessor so we set it as a value and return descriptor.
            descriptor.value = object[property];
            return descriptor;
        };
    }

// ES5 15.2.3.4
// http://es5.github.com/#x15.2.3.4
    if (!Object.getOwnPropertyNames) {
        Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
            return Object.keys(object);
        };
    }

// ES5 15.2.3.5
// http://es5.github.com/#x15.2.3.5
    if (!Object.create) {
        Object.create = function create(prototype, properties) {
            var object;
            if (prototype === null) {
                object = { "__proto__": null };
            } else {
                if (typeof prototype != "object")
                    throw new TypeError("typeof prototype["+(typeof prototype)+"] != 'object'");
                var Type = function () {};
                Type.prototype = prototype;
                object = new Type();
                // IE has no built-in implementation of `Object.getPrototypeOf`
                // neither `__proto__`, but this manually setting `__proto__` will
                // guarantee that `Object.getPrototypeOf` will work as expected with
                // objects created using `Object.create`
                object.__proto__ = prototype;
            }
            if (properties !== void 0)
                Object.defineProperties(object, properties);
            return object;
        };
    }

// ES5 15.2.3.6
// http://es5.github.com/#x15.2.3.6

// Patch for WebKit and IE8 standard mode
// Designed by hax <hax.github.com>
// related issue: https://github.com/kriskowal/es5-shim/issues#issue/5
// IE8 Reference:
//     http://msdn.microsoft.com/en-us/library/dd282900.aspx
//     http://msdn.microsoft.com/en-us/library/dd229916.aspx
// WebKit Bugs:
//     https://bugs.webkit.org/show_bug.cgi?id=36423

    function doesDefinePropertyWork(object) {
        try {
            Object.defineProperty(object, "sentinel", {});
            return "sentinel" in object;
        } catch (exception) {
            // returns falsy
        }
    }

// check whether defineProperty works if it's given. Otherwise,
// shim partially.
    if (Object.defineProperty) {
        var definePropertyWorksOnObject = doesDefinePropertyWork({});
        var definePropertyWorksOnDom = typeof document == "undefined" ||
            doesDefinePropertyWork(document.createElement("div"));
        if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
            var definePropertyFallback = Object.defineProperty;
        }
    }

    if (!Object.defineProperty || definePropertyFallback) {
        var ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
        var ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: "
        var ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
            "on this javascript engine";

        Object.defineProperty = function defineProperty(object, property, descriptor) {
            if ((typeof object != "object" && typeof object != "function") || object === null)
                throw new TypeError(ERR_NON_OBJECT_TARGET + object);
            if ((typeof descriptor != "object" && typeof descriptor != "function") || descriptor === null)
                throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);

            // make a valiant attempt to use the real defineProperty
            // for I8's DOM elements.
            if (definePropertyFallback) {
                try {
                    return definePropertyFallback.call(Object, object, property, descriptor);
                } catch (exception) {
                    // try the shim if the real one doesn't work
                }
            }

            // If it's a data property.
            if (owns(descriptor, "value")) {
                // fail silently if "writable", "enumerable", or "configurable"
                // are requested but not supported
                /*
                 // alternate approach:
                 if ( // can't implement these features; allow false but not true
                 !(owns(descriptor, "writable") ? descriptor.writable : true) ||
                 !(owns(descriptor, "enumerable") ? descriptor.enumerable : true) ||
                 !(owns(descriptor, "configurable") ? descriptor.configurable : true)
                 )
                 throw new RangeError(
                 "This implementation of Object.defineProperty does not " +
                 "support configurable, enumerable, or writable."
                 );
                 */

                if (supportsAccessors && (lookupGetter(object, property) ||
                    lookupSetter(object, property)))
                {
                    // As accessors are supported only on engines implementing
                    // `__proto__` we can safely override `__proto__` while defining
                    // a property to make sure that we don't hit an inherited
                    // accessor.
                    var prototype = object.__proto__;
                    object.__proto__ = prototypeOfObject;
                    // Deleting a property anyway since getter / setter may be
                    // defined on object itself.
                    delete object[property];
                    object[property] = descriptor.value;
                    // Setting original `__proto__` back now.
                    object.__proto__ = prototype;
                } else {
                    object[property] = descriptor.value;
                }
            } else {
                if (!supportsAccessors)
                    throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
                // If we got that far then getters and setters can be defined !!
                if (owns(descriptor, "get"))
                    defineGetter(object, property, descriptor.get);
                if (owns(descriptor, "set"))
                    defineSetter(object, property, descriptor.set);
            }

            return object;
        };
    }

// ES5 15.2.3.7
// http://es5.github.com/#x15.2.3.7
    if (!Object.defineProperties) {
        Object.defineProperties = function defineProperties(object, properties) {
            for (var property in properties) {
                if (owns(properties, property))
                    Object.defineProperty(object, property, properties[property]);
            }
            return object;
        };
    }

// ES5 15.2.3.8
// http://es5.github.com/#x15.2.3.8
    if (!Object.seal) {
        Object.seal = function seal(object) {
            // this is misleading and breaks feature-detection, but
            // allows "securable" code to "gracefully" degrade to working
            // but insecure code.
            return object;
        };
    }

// ES5 15.2.3.9
// http://es5.github.com/#x15.2.3.9
    if (!Object.freeze) {
        Object.freeze = function freeze(object) {
            // this is misleading and breaks feature-detection, but
            // allows "securable" code to "gracefully" degrade to working
            // but insecure code.
            return object;
        };
    }

// detect a Rhino bug and patch it
    try {
        Object.freeze(function () {});
    } catch (exception) {
        Object.freeze = (function freeze(freezeObject) {
            return function freeze(object) {
                if (typeof object == "function") {
                    return object;
                } else {
                    return freezeObject(object);
                }
            };
        })(Object.freeze);
    }

// ES5 15.2.3.10
// http://es5.github.com/#x15.2.3.10
    if (!Object.preventExtensions) {
        Object.preventExtensions = function preventExtensions(object) {
            // this is misleading and breaks feature-detection, but
            // allows "securable" code to "gracefully" degrade to working
            // but insecure code.
            return object;
        };
    }

// ES5 15.2.3.11
// http://es5.github.com/#x15.2.3.11
    if (!Object.isSealed) {
        Object.isSealed = function isSealed(object) {
            return false;
        };
    }

// ES5 15.2.3.12
// http://es5.github.com/#x15.2.3.12
    if (!Object.isFrozen) {
        Object.isFrozen = function isFrozen(object) {
            return false;
        };
    }

// ES5 15.2.3.13
// http://es5.github.com/#x15.2.3.13
    if (!Object.isExtensible) {
        Object.isExtensible = function isExtensible(object) {
            // 1. If Type(O) is not Object throw a TypeError exception.
            if (Object(object) === object) {
                throw new TypeError(); // TODO message
            }
            // 2. Return the Boolean value of the [[Extensible]] internal property of O.
            var name = '';
            while (owns(object, name)) {
                name += '?';
            }
            object[name] = true;
            var returnValue = owns(object, name);
            delete object[name];
            return returnValue;
        };
    }

// ES5 15.2.3.14
// http://es5.github.com/#x15.2.3.14
    if (!Object.keys) {
        // http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
        var hasDontEnumBug = true,
            dontEnums = [
                "toString",
                "toLocaleString",
                "valueOf",
                "hasOwnProperty",
                "isPrototypeOf",
                "propertyIsEnumerable",
                "constructor"
            ],
            dontEnumsLength = dontEnums.length;

        for (var key in {"toString": null})
            hasDontEnumBug = false;

        Object.keys = function keys(object) {

            if ((typeof object != "object" && typeof object != "function") || object === null)
                throw new TypeError("Object.keys called on a non-object");

            var keys = [];
            for (var name in object) {
                if (owns(object, name)) {
                    keys.push(name);
                }
            }

            if (hasDontEnumBug) {
                for (var i = 0, ii = dontEnumsLength; i < ii; i++) {
                    var dontEnum = dontEnums[i];
                    if (owns(object, dontEnum)) {
                        keys.push(dontEnum);
                    }
                }
            }

            return keys;
        };

    }

//
// Date
// ====
//

// ES5 15.9.5.43
// http://es5.github.com/#x15.9.5.43
// This function returns a String value represent the instance in time
// represented by this Date object. The format of the String is the Date Time
// string format defined in 15.9.1.15. All fields are present in the String.
// The time zone is always UTC, denoted by the suffix Z. If the time value of
// this object is not a finite Number a RangeError exception is thrown.
    if (!Date.prototype.toISOString || (new Date(-62198755200000).toISOString().indexOf('-000001') === -1)) {
        Date.prototype.toISOString = function toISOString() {
            var result, length, value, year;
            if (!isFinite(this))
                throw new RangeError;

            // the date time string format is specified in 15.9.1.15.
            result = [this.getUTCMonth() + 1, this.getUTCDate(),
                this.getUTCHours(), this.getUTCMinutes(), this.getUTCSeconds()];
            year = this.getUTCFullYear();
            year = (year < 0 ? '-' : (year > 9999 ? '+' : '')) + ('00000' + Math.abs(year)).slice(0 <= year && year <= 9999 ? -4 : -6);

            length = result.length;
            while (length--) {
                value = result[length];
                // pad months, days, hours, minutes, and seconds to have two digits.
                if (value < 10)
                    result[length] = "0" + value;
            }
            // pad milliseconds to have three digits.
            return year + "-" + result.slice(0, 2).join("-") + "T" + result.slice(2).join(":") + "." +
                ("000" + this.getUTCMilliseconds()).slice(-3) + "Z";
        }
    }

// ES5 15.9.4.4
// http://es5.github.com/#x15.9.4.4
    if (!Date.now) {
        Date.now = function now() {
            return new Date().getTime();
        };
    }

// ES5 15.9.5.44
// http://es5.github.com/#x15.9.5.44
// This function provides a String representation of a Date object for use by
// JSON.stringify (15.12.3).
    if (!Date.prototype.toJSON) {
        Date.prototype.toJSON = function toJSON(key) {
            // When the toJSON method is called with argument key, the following
            // steps are taken:

            // 1.  Let O be the result of calling ToObject, giving it the this
            // value as its argument.
            // 2. Let tv be ToPrimitive(O, hint Number).
            // 3. If tv is a Number and is not finite, return null.
            // XXX
            // 4. Let toISO be the result of calling the [[Get]] internal method of
            // O with argument "toISOString".
            // 5. If IsCallable(toISO) is false, throw a TypeError exception.
            if (typeof this.toISOString != "function")
                throw new TypeError(); // TODO message
            // 6. Return the result of calling the [[Call]] internal method of
            //  toISO with O as the this value and an empty argument list.
            return this.toISOString();

            // NOTE 1 The argument is ignored.

            // NOTE 2 The toJSON function is intentionally generic; it does not
            // require that its this value be a Date object. Therefore, it can be
            // transferred to other kinds of objects for use as a method. However,
            // it does require that any such object have a toISOString method. An
            // object is free to use the argument key to filter its
            // stringification.
        };
    }

// ES5 15.9.4.2
// http://es5.github.com/#x15.9.4.2
// based on work shared by Daniel Friesen (dantman)
// http://gist.github.com/303249
    if (Date.parse("+275760-09-13T00:00:00.000Z") !== 8.64e15) {
        // XXX global assignment won't work in embeddings that use
        // an alternate object for the context.
        Date = (function(NativeDate) {

            // Date.length === 7
            var Date = function Date(Y, M, D, h, m, s, ms) {
                var length = arguments.length;
                if (this instanceof NativeDate) {
                    var date = length == 1 && String(Y) === Y ? // isString(Y)
                        // We explicitly pass it through parse:
                        new NativeDate(Date.parse(Y)) :
                        // We have to manually make calls depending on argument
                        // length here
                        length >= 7 ? new NativeDate(Y, M, D, h, m, s, ms) :
                            length >= 6 ? new NativeDate(Y, M, D, h, m, s) :
                                length >= 5 ? new NativeDate(Y, M, D, h, m) :
                                    length >= 4 ? new NativeDate(Y, M, D, h) :
                                        length >= 3 ? new NativeDate(Y, M, D) :
                                            length >= 2 ? new NativeDate(Y, M) :
                                                length >= 1 ? new NativeDate(Y) :
                                                    new NativeDate();
                    // Prevent mixups with unfixed Date object
                    date.constructor = Date;
                    return date;
                }
                return NativeDate.apply(this, arguments);
            };

            // 15.9.1.15 Date Time String Format.
            var isoDateExpression = new RegExp("^" +
                "(\\d{4}|[\+\-]\\d{6})" + // four-digit year capture or sign + 6-digit extended year
                "(?:-(\\d{2})" + // optional month capture
                "(?:-(\\d{2})" + // optional day capture
                "(?:" + // capture hours:minutes:seconds.milliseconds
                "T(\\d{2})" + // hours capture
                ":(\\d{2})" + // minutes capture
                "(?:" + // optional :seconds.milliseconds
                ":(\\d{2})" + // seconds capture
                "(?:\\.(\\d{3}))?" + // milliseconds capture
                ")?" +
                "(?:" + // capture UTC offset component
                "Z|" + // UTC capture
                "(?:" + // offset specifier +/-hours:minutes
                "([-+])" + // sign capture
                "(\\d{2})" + // hours offset capture
                ":(\\d{2})" + // minutes offset capture
                ")" +
                ")?)?)?)?" +
                "$");

            // Copy any custom methods a 3rd party library may have added
            for (var key in NativeDate)
                Date[key] = NativeDate[key];

            // Copy "native" methods explicitly; they may be non-enumerable
            Date.now = NativeDate.now;
            Date.UTC = NativeDate.UTC;
            Date.prototype = NativeDate.prototype;
            Date.prototype.constructor = Date;

            // Upgrade Date.parse to handle simplified ISO 8601 strings
            Date.parse = function parse(string) {
                var match = isoDateExpression.exec(string);
                if (match) {
                    match.shift(); // kill match[0], the full match
                    // parse months, days, hours, minutes, seconds, and milliseconds
                    for (var i = 1; i < 7; i++) {
                        // provide default values if necessary
                        match[i] = +(match[i] || (i < 3 ? 1 : 0));
                        // match[1] is the month. Months are 0-11 in JavaScript
                        // `Date` objects, but 1-12 in ISO notation, so we
                        // decrement.
                        if (i == 1)
                            match[i]--;
                    }

                    // parse the UTC offset component
                    var minuteOffset = +match.pop(), hourOffset = +match.pop(), sign = match.pop();

                    // compute the explicit time zone offset if specified
                    var offset = 0;
                    if (sign) {
                        // detect invalid offsets and return early
                        if (hourOffset > 23 || minuteOffset > 59)
                            return NaN;

                        // express the provided time zone offset in minutes. The offset is
                        // negative for time zones west of UTC; positive otherwise.
                        offset = (hourOffset * 60 + minuteOffset) * 6e4 * (sign == "+" ? -1 : 1);
                    }

                    // Date.UTC for years between 0 and 99 converts year to 1900 + year
                    // The Gregorian calendar has a 400-year cycle, so
                    // to Date.UTC(year + 400, .... ) - 12622780800000 == Date.UTC(year, ...),
                    // where 12622780800000 - number of milliseconds in Gregorian calendar 400 years
                    var year = +match[0];
                    if (0 <= year && year <= 99) {
                        match[0] = year + 400;
                        return NativeDate.UTC.apply(this, match) + offset - 12622780800000;
                    }

                    // compute a new UTC date value, accounting for the optional offset
                    return NativeDate.UTC.apply(this, match) + offset;
                }
                return NativeDate.parse.apply(this, arguments);
            };

            return Date;
        })(Date);
    }

//
// String
// ======
//

// ES5 15.5.4.20
// http://es5.github.com/#x15.5.4.20
    var ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
        "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
        "\u2029\uFEFF";
    if (!String.prototype.trim || ws.trim()) {
        // http://blog.stevenlevithan.com/archives/faster-trim-javascript
        // http://perfectionkills.com/whitespace-deviations/
        ws = "[" + ws + "]";
        var trimBeginRegexp = new RegExp("^" + ws + ws + "*"),
            trimEndRegexp = new RegExp(ws + ws + "*$");
        String.prototype.trim = function trim() {
            return String(this).replace(trimBeginRegexp, "").replace(trimEndRegexp, "");
        };
    }

//
// Util
// ======
//

// ES5 9.4
// http://es5.github.com/#x9.4
// http://jsperf.com/to-integer
    var toInteger = function (n) {
        n = +n;
        if (n !== n) // isNaN
            n = 0;
        else if (n !== 0 && n !== (1/0) && n !== -(1/0))
            n = (n > 0 || -1) * Math.floor(Math.abs(n));
        return n;
    };

    var prepareString = "a"[0] != "a",
        // ES5 9.9
        // http://es5.github.com/#x9.9
        toObject = function (o) {
            if (o == null) { // this matches both null and undefined
                throw new TypeError(); // TODO message
            }
            // If the implementation doesn't support by-index access of
            // string characters (ex. IE < 7), split the string
            if (prepareString && typeof o == "string" && o) {
                return o.split("");
            }
            return Object(o);
        };
});/* vim:ts=4:sts=4:sw=4:
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *      Irakli Gozalishvili <rfobic@gmail.com> (http://jeditoolkit.com)
 *      Mike de Boer <mike AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('ace/lib/event_emitter', ['require', 'exports', 'module' ], function(require, exports, module) {
    "use strict";

    var EventEmitter = {};

    EventEmitter._emit =
        EventEmitter._dispatchEvent = function(eventName, e) {
            this._eventRegistry = this._eventRegistry || {};
            this._defaultHandlers = this._defaultHandlers || {};

            var listeners = this._eventRegistry[eventName] || [];
            var defaultHandler = this._defaultHandlers[eventName];
            if (!listeners.length && !defaultHandler)
                return;

            e = e || {};
            e.type = eventName;

            if (!e.stopPropagation) {
                e.stopPropagation = function() {
                    this.propagationStopped = true;
                };
            }

            if (!e.preventDefault) {
                e.preventDefault = function() {
                    this.defaultPrevented = true;
                };
            }

            for (var i=0; i<listeners.length; i++) {
                listeners[i](e);
                if (e.propagationStopped)
                    break;
            }

            if (defaultHandler && !e.defaultPrevented)
                defaultHandler(e);
        };

    EventEmitter.setDefaultHandler = function(eventName, callback) {
        this._defaultHandlers = this._defaultHandlers || {};

        if (this._defaultHandlers[eventName])
            throw new Error("The default handler for '" + eventName + "' is already set");

        this._defaultHandlers[eventName] = callback;
    };

    EventEmitter.on =
        EventEmitter.addEventListener = function(eventName, callback) {
            this._eventRegistry = this._eventRegistry || {};

            var listeners = this._eventRegistry[eventName];
            if (!listeners)
                var listeners = this._eventRegistry[eventName] = [];

            if (listeners.indexOf(callback) == -1)
                listeners.push(callback);
        };

    EventEmitter.removeListener =
        EventEmitter.removeEventListener = function(eventName, callback) {
            this._eventRegistry = this._eventRegistry || {};

            var listeners = this._eventRegistry[eventName];
            if (!listeners)
                return;

            var index = listeners.indexOf(callback);
            if (index !== -1)
                listeners.splice(index, 1);
        };

    EventEmitter.removeAllListeners = function(eventName) {
        if (this._eventRegistry) this._eventRegistry[eventName] = [];
    };

    exports.EventEmitter = EventEmitter;

});/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('ace/lib/oop', ['require', 'exports', 'module' ], function(require, exports, module) {
    "use strict";

    exports.inherits = (function() {
        var tempCtor = function() {};
        return function(ctor, superCtor) {
            tempCtor.prototype = superCtor.prototype;
            ctor.super_ = superCtor.prototype;
            ctor.prototype = new tempCtor();
            ctor.prototype.constructor = ctor;
        };
    }());

    exports.mixin = function(obj, mixin) {
        for (var key in mixin) {
            obj[key] = mixin[key];
        }
    };

    exports.implement = function(proto, mixin) {
        exports.mixin(proto, mixin);
    };

});
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('latex-parser', function(){
  /*
   * Generated by PEG.js 0.7.0.
   *
   * http://pegjs.majda.cz/
   */

  function quote(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
     * string literal except for the closing quote character, backslash,
     * carriage return, line separator, paragraph separator, and line feed.
     * Any character may appear in the form of an escape sequence.
     *
     * For portability, we also escape escape all control and non-ASCII
     * characters. Note that "\0" and "\v" escape sequences are not used
     * because JSHint does not like the first and IE the second.
     */
     return '"' + s
      .replace(/\\/g, '\\\\')  // backslash
      .replace(/"/g, '\\"')    // closing quote character
      .replace(/\x08/g, '\\b') // backspace
      .replace(/\t/g, '\\t')   // horizontal tab
      .replace(/\n/g, '\\n')   // line feed
      .replace(/\f/g, '\\f')   // form feed
      .replace(/\r/g, '\\r')   // carriage return
      .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
      + '"';
  }

  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      var parseFunctions = {
        "start": parse_start,
        "Document": parse_Document,
        "SourceElements": parse_SourceElements,
        "SourceElement": parse_SourceElement,
        "SourceCharacter": parse_SourceCharacter,
        "TextCharacters": parse_TextCharacters,
        "TextCharacter": parse_TextCharacter,
        "EscapedCharacter": parse_EscapedCharacter,
        "SingleLineComment": parse_SingleLineComment,
        "LineTerminator": parse_LineTerminator,
        "Command": parse_Command,
        "CommandArgument": parse_CommandArgument,
        "CurlyBlock": parse_CurlyBlock,
        "SquareCharacters": parse_SquareCharacters,
        "SquareCharacter": parse_SquareCharacter,
        "CurlyCharacters": parse_CurlyCharacters,
        "CurlyCharacter": parse_CurlyCharacter,
        "CommandName": parse_CommandName,
        "_": parse__,
        "__": parse___,
        "WhiteSpace": parse_WhiteSpace,
        "Zs": parse_Zs,
        "LineTerminatorSequence": parse_LineTerminatorSequence
      };

      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "start";
      }

      var pos = { offset: 0, line: 1, column: 1, seenCR: false };
      var reportFailures = 0;
      var rightmostFailuresPos = { offset: 0, line: 1, column: 1, seenCR: false };
      var rightmostFailuresExpected = [];

      function padLeft(input, padding, length) {
        var result = input;

        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }

        return result;
      }

      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;

        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }

        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }

      function clone(object) {
        var result = {};
        for (var key in object) {
          result[key] = object[key];
        }
        return result;
      }

      function advance(pos, n) {
        var endOffset = pos.offset + n;

        for (var offset = pos.offset; offset < endOffset; offset++) {
          var ch = input.charAt(offset);
          if (ch === "\n") {
            if (!pos.seenCR) { pos.line++; }
            pos.column = 1;
            pos.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            pos.line++;
            pos.column = 1;
            pos.seenCR = true;
          } else {
            pos.column++;
            pos.seenCR = false;
          }
        }

        pos.offset += n;
      }

      function matchFailed(failure) {
        if (pos.offset < rightmostFailuresPos.offset) {
          return;
        }

        if (pos.offset > rightmostFailuresPos.offset) {
          rightmostFailuresPos = clone(pos);
          rightmostFailuresExpected = [];
        }

        rightmostFailuresExpected.push(failure);
      }

      function parse_start() {
        var result0, result1, result2;
        var pos0, pos1;

        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse___();
        if (result0 !== null) {
          result1 = parse_Document();
          if (result1 !== null) {
            result2 = parse___();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, document) { return document; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_Document() {
        var result0;
        var pos0;

        pos0 = clone(pos);
        result0 = parse_SourceElements();
        result0 = result0 !== null ? result0 : "";
        if (result0 !== null) {
          result0 = (function(offset, line, column, elements) {
              return {
                type:     "Document",
                elements: elements !== "" ? elements : []
              };
            })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_SourceElements() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;

        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_SourceElement();
        if (result0 !== null) {
          result1 = [];
          pos2 = clone(pos);
          result2 = parse___();
          if (result2 !== null) {
            result3 = parse_SourceElement();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = clone(pos2);
            }
          } else {
            result2 = null;
            pos = clone(pos2);
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = clone(pos);
            result2 = parse___();
            if (result2 !== null) {
              result3 = parse_SourceElement();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = clone(pos2);
              }
            } else {
              result2 = null;
              pos = clone(pos2);
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, head, tail) {
              var result = [head];
              for (var i = 0; i < tail.length; i++) {
                result.push(tail[i][1]);
              }
              return result;
            })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_SourceElement() {
        var result0;
        var pos0;

        pos0 = clone(pos);
        result0 = parse_Command();
        if (result0 !== null) {
          result0 = (function(offset, line, column, command) { return {command : command} })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          result0 = parse_TextCharacters();
          if (result0 !== null) {
            result0 = (function(offset, line, column, text) { return {text : text} })(pos0.offset, pos0.line, pos0.column, result0);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }

      function parse_SourceCharacter() {
        var result0;

        if (input.length > pos.offset) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("any character");
          }
        }
        return result0;
      }

      function parse_TextCharacters() {
        var result0, result1;
        var pos0;

        pos0 = clone(pos);
        result1 = parse_TextCharacter();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_TextCharacter();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, chars) {
            return {
              content: chars.join(""),
              line: line,
              column: column
            }
          })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_TextCharacter() {
        var result0, result1;
        var pos0, pos1, pos2;

        pos0 = clone(pos);
        pos1 = clone(pos);
        pos2 = clone(pos);
        reportFailures++;
        if (input.charCodeAt(pos.offset) === 92) {
          result0 = "\\";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\\\\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos.offset) === 37) {
            result0 = "%";
            advance(pos, 1);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"%\"");
            }
          }
        }
        reportFailures--;
        if (result0 === null) {
          result0 = "";
        } else {
          result0 = null;
          pos = clone(pos2);
        }
        if (result0 !== null) {
          result1 = parse_SourceCharacter();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, char_) { return char_; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          if (input.substr(pos.offset, 7) === "\\LaTeX\\") {
            result0 = "\\LaTeX\\";
            advance(pos, 7);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"\\\\LaTeX\\\\\"");
            }
          }
          if (result0 === null) {
            if (input.substr(pos.offset, 2) === "\\\\") {
              result0 = "\\\\";
              advance(pos, 2);
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"\\\\\\\\\"");
              }
            }
            if (result0 === null) {
              pos0 = clone(pos);
              if (input.charCodeAt(pos.offset) === 92) {
                result0 = "\\";
                advance(pos, 1);
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"\\\\\"");
                }
              }
              if (result0 !== null) {
                result1 = parse_EscapedCharacter();
                if (result1 !== null) {
                  result0 = [result0, result1];
                } else {
                  result0 = null;
                  pos = clone(pos0);
                }
              } else {
                result0 = null;
                pos = clone(pos0);
              }
            }
          }
        }
        return result0;
      }

      function parse_EscapedCharacter() {
        var result0;

        if (input.charCodeAt(pos.offset) === 123) {
          result0 = "{";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"{\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos.offset) === 125) {
            result0 = "}";
            advance(pos, 1);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"}\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos.offset) === 91) {
              result0 = "[";
              advance(pos, 1);
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"[\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos.offset) === 93) {
                result0 = "]";
                advance(pos, 1);
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"]\"");
                }
              }
            }
          }
        }
        return result0;
      }

      function parse_SingleLineComment() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;

        pos0 = clone(pos);
        if (input.charCodeAt(pos.offset) === 37) {
          result0 = "%";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"%\"");
          }
        }
        if (result0 !== null) {
          result1 = [];
          pos1 = clone(pos);
          pos2 = clone(pos);
          reportFailures++;
          result2 = parse_LineTerminator();
          reportFailures--;
          if (result2 === null) {
            result2 = "";
          } else {
            result2 = null;
            pos = clone(pos2);
          }
          if (result2 !== null) {
            result3 = parse_SourceCharacter();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = clone(pos1);
            }
          } else {
            result2 = null;
            pos = clone(pos1);
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = clone(pos);
            pos2 = clone(pos);
            reportFailures++;
            result2 = parse_LineTerminator();
            reportFailures--;
            if (result2 === null) {
              result2 = "";
            } else {
              result2 = null;
              pos = clone(pos2);
            }
            if (result2 !== null) {
              result3 = parse_SourceCharacter();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = clone(pos1);
              }
            } else {
              result2 = null;
              pos = clone(pos1);
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos0);
          }
        } else {
          result0 = null;
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_LineTerminator() {
        var result0;

        if (input.charCodeAt(pos.offset) === 10) {
          result0 = "\n";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\n\"");
          }
        }
        return result0;
      }

      function parse_Command() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;

        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 92) {
          result0 = "\\";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\\\\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_CommandName();
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 42) {
              result2 = "*";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"*\"");
              }
            }
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = [];
              result4 = parse_CommandArgument();
              while (result4 !== null) {
                result3.push(result4);
                result4 = parse_CommandArgument();
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, cname, args) {
              return {
                name: cname,
                args: args.join(""),
                line: line,
                column: column
              }
            })(pos0.offset, pos0.line, pos0.column, result0[1], result0[3]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_CommandArgument() {
        var result0, result1, result2;
        var pos0, pos1;

        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 91) {
          result0 = "[";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"[\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_SquareCharacters();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 93) {
              result2 = "]";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"]\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, squareArg) { return "[" + squareArg + "]" })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          if (input.charCodeAt(pos.offset) === 123) {
            result0 = "{";
            advance(pos, 1);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"{\"");
            }
          }
          if (result0 !== null) {
            result1 = parse_CurlyCharacters();
            result1 = result1 !== null ? result1 : "";
            if (result1 !== null) {
              if (input.charCodeAt(pos.offset) === 125) {
                result2 = "}";
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"}\"");
                }
              }
              if (result2 !== null) {
                result0 = [result0, result1, result2];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, curlyArg) { return "{" + curlyArg + "}" })(pos0.offset, pos0.line, pos0.column, result0[1]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }

      function parse_CurlyBlock() {
        var result0, result1, result2;
        var pos0;

        pos0 = clone(pos);
        if (input.charCodeAt(pos.offset) === 123) {
          result0 = "{";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"{\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_CurlyCharacters();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 125) {
              result2 = "}";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"}\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos0);
            }
          } else {
            result0 = null;
            pos = clone(pos0);
          }
        } else {
          result0 = null;
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_SquareCharacters() {
        var result0, result1;
        var pos0;

        pos0 = clone(pos);
        result1 = parse_SquareCharacter();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_SquareCharacter();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, chars) { return chars.join(""); })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_SquareCharacter() {
        var result0, result1;
        var pos0, pos1, pos2;

        pos0 = clone(pos);
        pos1 = clone(pos);
        pos2 = clone(pos);
        reportFailures++;
        if (input.charCodeAt(pos.offset) === 93) {
          result0 = "]";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"]\"");
          }
        }
        reportFailures--;
        if (result0 === null) {
          result0 = "";
        } else {
          result0 = null;
          pos = clone(pos2);
        }
        if (result0 !== null) {
          result1 = parse_SourceCharacter();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, char_) { return char_; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_CurlyCharacters() {
        var result0, result1;
        var pos0;

        pos0 = clone(pos);
        result1 = parse_CurlyCharacter();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_CurlyCharacter();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, chars) { return chars.join(""); })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse_CurlyCharacter() {
        var result0, result1;
        var pos0, pos1, pos2;

        pos0 = clone(pos);
        pos1 = clone(pos);
        pos2 = clone(pos);
        reportFailures++;
        if (input.charCodeAt(pos.offset) === 123) {
          result0 = "{";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"{\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos.offset) === 125) {
            result0 = "}";
            advance(pos, 1);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"}\"");
            }
          }
        }
        reportFailures--;
        if (result0 === null) {
          result0 = "";
        } else {
          result0 = null;
          pos = clone(pos2);
        }
        if (result0 !== null) {
          result1 = parse_SourceCharacter();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, char_) { return char_; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          result0 = parse_CurlyBlock();
        }
        return result0;
      }

      function parse_CommandName() {
        var result0, result1;
        var pos0;

        pos0 = clone(pos);
        if (/^[a-zA-Z]/.test(input.charAt(pos.offset))) {
          result1 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[a-zA-Z]/.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, cname) { return cname.join(""); })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }

      function parse__() {
        var result0, result1;

        result0 = [];
        result1 = parse_WhiteSpace();
        if (result1 === null) {
          result1 = parse_SingleLineComment();
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_WhiteSpace();
          if (result1 === null) {
            result1 = parse_SingleLineComment();
          }
        }
        return result0;
      }

      function parse___() {
        var result0, result1;

        result0 = [];
        result1 = parse_WhiteSpace();
        if (result1 === null) {
          result1 = parse_LineTerminatorSequence();
          if (result1 === null) {
            result1 = parse_SingleLineComment();
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_WhiteSpace();
          if (result1 === null) {
            result1 = parse_LineTerminatorSequence();
            if (result1 === null) {
              result1 = parse_SingleLineComment();
            }
          }
        }
        return result0;
      }

      function parse_WhiteSpace() {
        var result0;

        reportFailures++;
        if (/^[\t\x0B\f \xA0\uFEFF]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[\\t\\x0B\\f \\xA0\\uFEFF]");
          }
        }
        if (result0 === null) {
          result0 = parse_Zs();
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("whitespace");
        }
        return result0;
      }

      function parse_Zs() {
        var result0;

        if (/^[ \xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[ \\xA0\\u1680\\u180E\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u202F\\u205F\\u3000]");
          }
        }
        return result0;
      }

      function parse_LineTerminatorSequence() {
        var result0;

        reportFailures++;
        if (input.charCodeAt(pos.offset) === 10) {
          result0 = "\n";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\n\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos.offset, 2) === "\r\n") {
            result0 = "\r\n";
            advance(pos, 2);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"\\r\\n\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos.offset) === 13) {
              result0 = "\r";
              advance(pos, 1);
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"\\r\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos.offset) === 8232) {
                result0 = "\u2028";
                advance(pos, 1);
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"\\u2028\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos.offset) === 8233) {
                  result0 = "\u2029";
                  advance(pos, 1);
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"\\u2029\"");
                  }
                }
              }
            }
          }
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("end of line");
        }
        return result0;
      }


      function cleanupExpected(expected) {
        expected.sort();

        var lastExpected = null;
        var cleanExpected = [];
        for (var i = 0; i < expected.length; i++) {
          if (expected[i] !== lastExpected) {
            cleanExpected.push(expected[i]);
            lastExpected = expected[i];
          }
        }
        return cleanExpected;
      }



      var result = parseFunctions[startRule]();

      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos.offset === input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos.offset < input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos.offset === 0|
       *   - |rightmostFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos.offset !== input.length) {
        var offset = Math.max(pos.offset, rightmostFailuresPos.offset);
        var found = offset < input.length ? input.charAt(offset) : null;
        var errorPosition = pos.offset > rightmostFailuresPos.offset ? pos : rightmostFailuresPos;

        throw new this.SyntaxError(
          cleanupExpected(rightmostFailuresExpected),
          found,
          offset,
          errorPosition.line,
          errorPosition.column
        );
      }

      return result;
    },

    /* Returns the parser source code. */
    toSource: function() { return this._source; }
  };

  /* Thrown when a parser encounters a syntax error. */

  result.SyntaxError = function(expected, found, offset, line, column) {
    function buildMessage(expected, found) {
      var expectedHumanized, foundHumanized;

      switch (expected.length) {
        case 0:
          expectedHumanized = "end of input";
          break;
        case 1:
          expectedHumanized = expected[0];
          break;
        default:
          expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
            + " or "
            + expected[expected.length - 1];
      }

      foundHumanized = found ? quote(found) : "end of input";

      return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
    }

    this.name = "SyntaxError";
    this.expected = expected;
    this.found = found;
    this.message = buildMessage(expected, found);
    this.offset = offset;
    this.line = line;
    this.column = column;
  };

  result.SyntaxError.prototype = Error.prototype;

  return result;
});


define('ace/mode/latex_worker', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/worker/mirror', "latex-parser"], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var Mirror = require("../worker/mirror").Mirror;

    var parser = require("latex-parser");

    var LatexWorker = exports.LatexWorker = function(sender) {
        Mirror.call(this, sender);
        this.setTimeout(200);
    };

    oop.inherits(LatexWorker, Mirror);

    (function() {

        this.onUpdate = function() {
            var value = this.doc.getValue();

            debugger;

            if(!value) {
                return;
            }

            var parseResult = parser.parse(value);

            if(parseResult) {
                this.sender.emit("parsed", parseResult);
            }
        };

    }).call(LatexWorker.prototype);

});
define('ace/worker/mirror', ['require', 'exports', 'module' , 'ace/document', 'ace/lib/lang'], function(require, exports, module) {
    "use strict";

    var Document = require("../document").Document;
    var lang = require("../lib/lang");

    var Mirror = exports.Mirror = function(sender) {
        this.sender = sender;
        var doc = this.doc = new Document("");

        var deferredUpdate = this.deferredUpdate = lang.deferredCall(this.onUpdate.bind(this));

        var _self = this;
        sender.on("change", function(e) {
            doc.applyDeltas([e.data]);
            deferredUpdate.schedule(_self.$timeout);
        });
    };

    (function() {

        this.$timeout = 500;

        this.setTimeout = function(timeout) {
            this.$timeout = timeout;
        };

        this.setValue = function(value) {
            this.doc.setValue(value);
            this.deferredUpdate.schedule(this.$timeout);
        };

        this.getValue = function(callbackId) {
            this.sender.callback(this.doc.getValue(), callbackId);
        };

        this.onUpdate = function() {
            // abstract method
        };

    }).call(Mirror.prototype);

});/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('ace/document', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/lib/event_emitter', 'ace/range', 'ace/anchor'], function(require, exports, module) {
    "use strict";

    var oop = require("./lib/oop");
    var EventEmitter = require("./lib/event_emitter").EventEmitter;
    var Range = require("./range").Range;
    var Anchor = require("./anchor").Anchor;

    var Document = function(text) {
        this.$lines = [];

        if (Array.isArray(text)) {
            this.insertLines(0, text);
        }
        // There has to be one line at least in the document. If you pass an empty
        // string to the insert function, nothing will happen. Workaround.
        else if (text.length == 0) {
            this.$lines = [""];
        } else {
            this.insert({row: 0, column:0}, text);
        }
    };

    (function() {

        oop.implement(this, EventEmitter);

        this.setValue = function(text) {
            var len = this.getLength();
            this.remove(new Range(0, 0, len, this.getLine(len-1).length));
            this.insert({row: 0, column:0}, text);
        };

        this.getValue = function() {
            return this.getAllLines().join(this.getNewLineCharacter());
        };

        this.createAnchor = function(row, column) {
            return new Anchor(this, row, column);
        };

        // check for IE split bug
        if ("aaa".split(/a/).length == 0)
            this.$split = function(text) {
                return text.replace(/\r\n|\r/g, "\n").split("\n");
            }
        else
            this.$split = function(text) {
                return text.split(/\r\n|\r|\n/);
            };


        this.$detectNewLine = function(text) {
            var match = text.match(/^.*?(\r\n|\r|\n)/m);
            if (match) {
                this.$autoNewLine = match[1];
            } else {
                this.$autoNewLine = "\n";
            }
        };

        this.getNewLineCharacter = function() {
            switch (this.$newLineMode) {
                case "windows":
                    return "\r\n";

                case "unix":
                    return "\n";

                case "auto":
                    return this.$autoNewLine;
            }
        };

        this.$autoNewLine = "\n";
        this.$newLineMode = "auto";
        this.setNewLineMode = function(newLineMode) {
            if (this.$newLineMode === newLineMode)
                return;

            this.$newLineMode = newLineMode;
        };

        this.getNewLineMode = function() {
            return this.$newLineMode;
        };

        this.isNewLine = function(text) {
            return (text == "\r\n" || text == "\r" || text == "\n");
        };

        /**
         * Get a verbatim copy of the given line as it is in the document
         */
        this.getLine = function(row) {
            return this.$lines[row] || "";
        };

        this.getLines = function(firstRow, lastRow) {
            return this.$lines.slice(firstRow, lastRow + 1);
        };

        /**
         * Returns all lines in the document as string array. Warning: The caller
         * should not modify this array!
         */
        this.getAllLines = function() {
            return this.getLines(0, this.getLength());
        };

        this.getLength = function() {
            return this.$lines.length;
        };

        this.getTextRange = function(range) {
            if (range.start.row == range.end.row) {
                return this.$lines[range.start.row].substring(range.start.column,
                    range.end.column);
            }
            else {
                var lines = [];
                lines.push(this.$lines[range.start.row].substring(range.start.column));
                lines.push.apply(lines, this.getLines(range.start.row+1, range.end.row-1));
                lines.push(this.$lines[range.end.row].substring(0, range.end.column));
                return lines.join(this.getNewLineCharacter());
            }
        };

        this.$clipPosition = function(position) {
            var length = this.getLength();
            if (position.row >= length) {
                position.row = Math.max(0, length - 1);
                position.column = this.getLine(length-1).length;
            }
            return position;
        };

        this.insert = function(position, text) {
            if (!text || text.length === 0)
                return position;

            position = this.$clipPosition(position);

            // only detect new lines if the document has no line break yet
            if (this.getLength() <= 1)
                this.$detectNewLine(text);

            var lines = this.$split(text);
            var firstLine = lines.splice(0, 1)[0];
            var lastLine = lines.length == 0 ? null : lines.splice(lines.length - 1, 1)[0];

            position = this.insertInLine(position, firstLine);
            if (lastLine !== null) {
                position = this.insertNewLine(position); // terminate first line
                position = this.insertLines(position.row, lines);
                position = this.insertInLine(position, lastLine || "");
            }
            return position;
        };

        this.insertLines = function(row, lines) {
            if (lines.length == 0)
                return {row: row, column: 0};

            var args = [row, 0];
            args.push.apply(args, lines);
            this.$lines.splice.apply(this.$lines, args);

            var range = new Range(row, 0, row + lines.length, 0);
            var delta = {
                action: "insertLines",
                range: range,
                lines: lines
            };
            this._emit("change", { data: delta });
            return range.end;
        };

        this.insertNewLine = function(position) {
            position = this.$clipPosition(position);
            var line = this.$lines[position.row] || "";

            this.$lines[position.row] = line.substring(0, position.column);
            this.$lines.splice(position.row + 1, 0, line.substring(position.column, line.length));

            var end = {
                row : position.row + 1,
                column : 0
            };

            var delta = {
                action: "insertText",
                range: Range.fromPoints(position, end),
                text: this.getNewLineCharacter()
            };
            this._emit("change", { data: delta });

            return end;
        };

        this.insertInLine = function(position, text) {
            if (text.length == 0)
                return position;

            var line = this.$lines[position.row] || "";

            this.$lines[position.row] = line.substring(0, position.column) + text
                + line.substring(position.column);

            var end = {
                row : position.row,
                column : position.column + text.length
            };

            var delta = {
                action: "insertText",
                range: Range.fromPoints(position, end),
                text: text
            };
            this._emit("change", { data: delta });

            return end;
        };

        this.remove = function(range) {
            // clip to document
            range.start = this.$clipPosition(range.start);
            range.end = this.$clipPosition(range.end);

            if (range.isEmpty())
                return range.start;

            var firstRow = range.start.row;
            var lastRow = range.end.row;

            if (range.isMultiLine()) {
                var firstFullRow = range.start.column == 0 ? firstRow : firstRow + 1;
                var lastFullRow = lastRow - 1;

                if (range.end.column > 0)
                    this.removeInLine(lastRow, 0, range.end.column);

                if (lastFullRow >= firstFullRow)
                    this.removeLines(firstFullRow, lastFullRow);

                if (firstFullRow != firstRow) {
                    this.removeInLine(firstRow, range.start.column, this.getLine(firstRow).length);
                    this.removeNewLine(range.start.row);
                }
            }
            else {
                this.removeInLine(firstRow, range.start.column, range.end.column);
            }
            return range.start;
        };

        this.removeInLine = function(row, startColumn, endColumn) {
            if (startColumn == endColumn)
                return;

            var range = new Range(row, startColumn, row, endColumn);
            var line = this.getLine(row);
            var removed = line.substring(startColumn, endColumn);
            var newLine = line.substring(0, startColumn) + line.substring(endColumn, line.length);
            this.$lines.splice(row, 1, newLine);

            var delta = {
                action: "removeText",
                range: range,
                text: removed
            };
            this._emit("change", { data: delta });
            return range.start;
        };

        /**
         * Removes a range of full lines
         *
         * @param firstRow {Integer} The first row to be removed
         * @param lastRow {Integer} The last row to be removed
         * @return {String[]} The removed lines
         */
        this.removeLines = function(firstRow, lastRow) {
            var range = new Range(firstRow, 0, lastRow + 1, 0);
            var removed = this.$lines.splice(firstRow, lastRow - firstRow + 1);

            var delta = {
                action: "removeLines",
                range: range,
                nl: this.getNewLineCharacter(),
                lines: removed
            };
            this._emit("change", { data: delta });
            return removed;
        };

        this.removeNewLine = function(row) {
            var firstLine = this.getLine(row);
            var secondLine = this.getLine(row+1);

            var range = new Range(row, firstLine.length, row+1, 0);
            var line = firstLine + secondLine;

            this.$lines.splice(row, 2, line);

            var delta = {
                action: "removeText",
                range: range,
                text: this.getNewLineCharacter()
            };
            this._emit("change", { data: delta });
        };

        this.replace = function(range, text) {
            if (text.length == 0 && range.isEmpty())
                return range.start;

            // Shortcut: If the text we want to insert is the same as it is already
            // in the document, we don't have to replace anything.
            if (text == this.getTextRange(range))
                return range.end;

            this.remove(range);
            if (text) {
                var end = this.insert(range.start, text);
            }
            else {
                end = range.start;
            }

            return end;
        };

        this.applyDeltas = function(deltas) {
            for (var i=0; i<deltas.length; i++) {
                var delta = deltas[i];
                var range = Range.fromPoints(delta.range.start, delta.range.end);

                if (delta.action == "insertLines")
                    this.insertLines(range.start.row, delta.lines);
                else if (delta.action == "insertText")
                    this.insert(range.start, delta.text);
                else if (delta.action == "removeLines")
                    this.removeLines(range.start.row, range.end.row - 1);
                else if (delta.action == "removeText")
                    this.remove(range);
            }
        };

        this.revertDeltas = function(deltas) {
            for (var i=deltas.length-1; i>=0; i--) {
                var delta = deltas[i];

                var range = Range.fromPoints(delta.range.start, delta.range.end);

                if (delta.action == "insertLines")
                    this.removeLines(range.start.row, range.end.row - 1);
                else if (delta.action == "insertText")
                    this.remove(range);
                else if (delta.action == "removeLines")
                    this.insertLines(range.start.row, delta.lines);
                else if (delta.action == "removeText")
                    this.insert(range.start, delta.text);
            }
        };

    }).call(Document.prototype);

    exports.Document = Document;
});
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('ace/range', ['require', 'exports', 'module' ], function(require, exports, module) {
    "use strict";

    var Range = function(startRow, startColumn, endRow, endColumn) {
        this.start = {
            row: startRow,
            column: startColumn
        };

        this.end = {
            row: endRow,
            column: endColumn
        };
    };

    (function() {
        this.isEqual = function(range) {
            return this.start.row == range.start.row &&
                this.end.row == range.end.row &&
                this.start.column == range.start.column &&
                this.end.column == range.end.column
        };

        this.toString = function() {
            return ("Range: [" + this.start.row + "/" + this.start.column +
                "] -> [" + this.end.row + "/" + this.end.column + "]");
        };

        this.contains = function(row, column) {
            return this.compare(row, column) == 0;
        };

        /**
         * Compares this range (A) with another range (B), where B is the passed in
         * range.
         *
         * Return values:
         *  -2: (B) is infront of (A) and doesn't intersect with (A)
         *  -1: (B) begins before (A) but ends inside of (A)
         *   0: (B) is completly inside of (A) OR (A) is complety inside of (B)
         *  +1: (B) begins inside of (A) but ends outside of (A)
         *  +2: (B) is after (A) and doesn't intersect with (A)
         *
         *  42: FTW state: (B) ends in (A) but starts outside of (A)
         */
        this.compareRange = function(range) {
            var cmp,
                end = range.end,
                start = range.start;

            cmp = this.compare(end.row, end.column);
            if (cmp == 1) {
                cmp = this.compare(start.row, start.column);
                if (cmp == 1) {
                    return 2;
                } else if (cmp == 0) {
                    return 1;
                } else {
                    return 0;
                }
            } else if (cmp == -1) {
                return -2;
            } else {
                cmp = this.compare(start.row, start.column);
                if (cmp == -1) {
                    return -1;
                } else if (cmp == 1) {
                    return 42;
                } else {
                    return 0;
                }
            }
        }

        this.comparePoint = function(p) {
            return this.compare(p.row, p.column);
        }

        this.containsRange = function(range) {
            return this.comparePoint(range.start) == 0 && this.comparePoint(range.end) == 0;
        }

        this.intersects = function(range) {
            var cmp = this.compareRange(range);
            return (cmp == -1 || cmp == 0 || cmp == 1);
        }

        this.isEnd = function(row, column) {
            return this.end.row == row && this.end.column == column;
        }

        this.isStart = function(row, column) {
            return this.start.row == row && this.start.column == column;
        }

        this.setStart = function(row, column) {
            if (typeof row == "object") {
                this.start.column = row.column;
                this.start.row = row.row;
            } else {
                this.start.row = row;
                this.start.column = column;
            }
        }

        this.setEnd = function(row, column) {
            if (typeof row == "object") {
                this.end.column = row.column;
                this.end.row = row.row;
            } else {
                this.end.row = row;
                this.end.column = column;
            }
        }

        this.inside = function(row, column) {
            if (this.compare(row, column) == 0) {
                if (this.isEnd(row, column) || this.isStart(row, column)) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        }

        this.insideStart = function(row, column) {
            if (this.compare(row, column) == 0) {
                if (this.isEnd(row, column)) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        }

        this.insideEnd = function(row, column) {
            if (this.compare(row, column) == 0) {
                if (this.isStart(row, column)) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        }

        this.compare = function(row, column) {
            if (!this.isMultiLine()) {
                if (row === this.start.row) {
                    return column < this.start.column ? -1 : (column > this.end.column ? 1 : 0);
                };
            }

            if (row < this.start.row)
                return -1;

            if (row > this.end.row)
                return 1;

            if (this.start.row === row)
                return column >= this.start.column ? 0 : -1;

            if (this.end.row === row)
                return column <= this.end.column ? 0 : 1;

            return 0;
        };

        /**
         * Like .compare(), but if isStart is true, return -1;
         */
        this.compareStart = function(row, column) {
            if (this.start.row == row && this.start.column == column) {
                return -1;
            } else {
                return this.compare(row, column);
            }
        }

        /**
         * Like .compare(), but if isEnd is true, return 1;
         */
        this.compareEnd = function(row, column) {
            if (this.end.row == row && this.end.column == column) {
                return 1;
            } else {
                return this.compare(row, column);
            }
        }

        this.compareInside = function(row, column) {
            if (this.end.row == row && this.end.column == column) {
                return 1;
            } else if (this.start.row == row && this.start.column == column) {
                return -1;
            } else {
                return this.compare(row, column);
            }
        }

        this.clipRows = function(firstRow, lastRow) {
            if (this.end.row > lastRow) {
                var end = {
                    row: lastRow+1,
                    column: 0
                };
            }

            if (this.start.row > lastRow) {
                var start = {
                    row: lastRow+1,
                    column: 0
                };
            }

            if (this.start.row < firstRow) {
                var start = {
                    row: firstRow,
                    column: 0
                };
            }

            if (this.end.row < firstRow) {
                var end = {
                    row: firstRow,
                    column: 0
                };
            }
            return Range.fromPoints(start || this.start, end || this.end);
        };

        this.extend = function(row, column) {
            var cmp = this.compare(row, column);

            if (cmp == 0)
                return this;
            else if (cmp == -1)
                var start = {row: row, column: column};
            else
                var end = {row: row, column: column};

            return Range.fromPoints(start || this.start, end || this.end);
        };

        this.fixOrientation = function() {
            if (
                this.start.row < this.end.row
                    || (this.start.row == this.end.row && this.start.column < this.end.column)
                ) {
                return false;
            }

            var temp = this.start;
            this.end = this.start;
            this.start = temp;
            return true;
        };


        this.isEmpty = function() {
            return (this.start.row == this.end.row && this.start.column == this.end.column);
        };

        this.isMultiLine = function() {
            return (this.start.row !== this.end.row);
        };

        this.clone = function() {
            return Range.fromPoints(this.start, this.end);
        };

        this.collapseRows = function() {
            if (this.end.column == 0)
                return new Range(this.start.row, 0, Math.max(this.start.row, this.end.row-1), 0)
            else
                return new Range(this.start.row, 0, this.end.row, 0)
        };

        this.toScreenRange = function(session) {
            var screenPosStart =
                session.documentToScreenPosition(this.start);
            var screenPosEnd =
                session.documentToScreenPosition(this.end);

            return new Range(
                screenPosStart.row, screenPosStart.column,
                screenPosEnd.row, screenPosEnd.column
            );
        };

    }).call(Range.prototype);


    Range.fromPoints = function(start, end) {
        return new Range(start.row, start.column, end.row, end.column);
    };

    exports.Range = Range;
});
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('ace/anchor', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/lib/event_emitter'], function(require, exports, module) {
    "use strict";

    var oop = require("./lib/oop");
    var EventEmitter = require("./lib/event_emitter").EventEmitter;

    /**
     * An Anchor is a floating pointer in the document. Whenever text is inserted or
     * deleted before the cursor, the position of the cursor is updated
     */
    var Anchor = exports.Anchor = function(doc, row, column) {
        this.document = doc;

        if (typeof column == "undefined")
            this.setPosition(row.row, row.column);
        else
            this.setPosition(row, column);

        this.$onChange = this.onChange.bind(this);
        doc.on("change", this.$onChange);
    };

    (function() {

        oop.implement(this, EventEmitter);

        this.getPosition = function() {
            return this.$clipPositionToDocument(this.row, this.column);
        };

        this.getDocument = function() {
            return this.document;
        };

        this.onChange = function(e) {
            var delta = e.data;
            var range = delta.range;

            if (range.start.row == range.end.row && range.start.row != this.row)
                return;

            if (range.start.row > this.row)
                return;

            if (range.start.row == this.row && range.start.column > this.column)
                return;

            var row = this.row;
            var column = this.column;

            if (delta.action === "insertText") {
                if (range.start.row === row && range.start.column <= column) {
                    if (range.start.row === range.end.row) {
                        column += range.end.column - range.start.column;
                    }
                    else {
                        column -= range.start.column;
                        row += range.end.row - range.start.row;
                    }
                }
                else if (range.start.row !== range.end.row && range.start.row < row) {
                    row += range.end.row - range.start.row;
                }
            } else if (delta.action === "insertLines") {
                if (range.start.row <= row) {
                    row += range.end.row - range.start.row;
                }
            }
            else if (delta.action == "removeText") {
                if (range.start.row == row && range.start.column < column) {
                    if (range.end.column >= column)
                        column = range.start.column;
                    else
                        column = Math.max(0, column - (range.end.column - range.start.column));

                } else if (range.start.row !== range.end.row && range.start.row < row) {
                    if (range.end.row == row) {
                        column = Math.max(0, column - range.end.column) + range.start.column;
                    }
                    row -= (range.end.row - range.start.row);
                }
                else if (range.end.row == row) {
                    row -= range.end.row - range.start.row;
                    column = Math.max(0, column - range.end.column) + range.start.column;
                }
            } else if (delta.action == "removeLines") {
                if (range.start.row <= row) {
                    if (range.end.row <= row)
                        row -= range.end.row - range.start.row;
                    else {
                        row = range.start.row;
                        column = 0;
                    }
                }
            }

            this.setPosition(row, column, true);
        };

        this.setPosition = function(row, column, noClip) {
            var pos;
            if (noClip) {
                pos = {
                    row: row,
                    column: column
                };
            }
            else {
                pos = this.$clipPositionToDocument(row, column);
            }

            if (this.row == pos.row && this.column == pos.column)
                return;

            var old = {
                row: this.row,
                column: this.column
            };

            this.row = pos.row;
            this.column = pos.column;
            this._emit("change", {
                old: old,
                value: pos
            });
        };

        this.detach = function() {
            this.document.removeEventListener("change", this.$onChange);
        };

        this.$clipPositionToDocument = function(row, column) {
            var pos = {};

            if (row >= this.document.getLength()) {
                pos.row = Math.max(0, this.document.getLength() - 1);
                pos.column = this.document.getLine(pos.row).length;
            }
            else if (row < 0) {
                pos.row = 0;
                pos.column = 0;
            }
            else {
                pos.row = row;
                pos.column = Math.min(this.document.getLine(pos.row).length, Math.max(0, column));
            }

            if (column < 0)
                pos.column = 0;

            return pos;
        };

    }).call(Anchor.prototype);

});
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define('ace/lib/lang', ['require', 'exports', 'module' ], function(require, exports, module) {
    "use strict";

    exports.stringReverse = function(string) {
        return string.split("").reverse().join("");
    };

    exports.stringRepeat = function (string, count) {
        return new Array(count + 1).join(string);
    };

    var trimBeginRegexp = /^\s\s*/;
    var trimEndRegexp = /\s\s*$/;

    exports.stringTrimLeft = function (string) {
        return string.replace(trimBeginRegexp, '');
    };

    exports.stringTrimRight = function (string) {
        return string.replace(trimEndRegexp, '');
    };

    exports.copyObject = function(obj) {
        var copy = {};
        for (var key in obj) {
            copy[key] = obj[key];
        }
        return copy;
    };

    exports.copyArray = function(array){
        var copy = [];
        for (var i=0, l=array.length; i<l; i++) {
            if (array[i] && typeof array[i] == "object")
                copy[i] = this.copyObject( array[i] );
            else
                copy[i] = array[i];
        }
        return copy;
    };

    exports.deepCopy = function (obj) {
        if (typeof obj != "object") {
            return obj;
        }

        var copy = obj.constructor();
        for (var key in obj) {
            if (typeof obj[key] == "object") {
                copy[key] = this.deepCopy(obj[key]);
            } else {
                copy[key] = obj[key];
            }
        }
        return copy;
    };

    exports.arrayToMap = function(arr) {
        var map = {};
        for (var i=0; i<arr.length; i++) {
            map[arr[i]] = 1;
        }
        return map;

    };

    /**
     * splice out of 'array' anything that === 'value'
     */
    exports.arrayRemove = function(array, value) {
        for (var i = 0; i <= array.length; i++) {
            if (value === array[i]) {
                array.splice(i, 1);
            }
        }
    };

    exports.escapeRegExp = function(str) {
        return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
    };

    exports.deferredCall = function(fcn) {

        var timer = null;
        var callback = function() {
            timer = null;
            fcn();
        };

        var deferred = function(timeout) {
            deferred.cancel();
            timer = setTimeout(callback, timeout || 0);
            return deferred;
        };

        deferred.schedule = deferred;

        deferred.call = function() {
            this.cancel();
            fcn();
            return deferred;
        };

        deferred.cancel = function() {
            clearTimeout(timer);
            timer = null;
            return deferred;
        };

        return deferred;
    };

});