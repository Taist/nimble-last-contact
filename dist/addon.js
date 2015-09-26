function init(){var require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var app, promises, state;

app = require('./app');

state = require('./state');

promises = {};

state.on('get', function(event) {
  var data, path, ref, userId;
  ref = event.data, path = ref.path, data = ref.data;
  if (!data && path[0] === 'users') {
    userId = path[1];
    if (!promises[userId]) {
      console.log('get userinfo from the server ' + userId);
      promises[userId] = app.nimbleAPI.getUserById(userId);
    }
    return promises[userId].then(function(userInfo) {
      return state.set(path, {
        name: userInfo.first_name + " " + userInfo.last_name
      });
    });
  }
});

},{"./app":2,"./state":6}],2:[function(require,module,exports){
var app, appData, wrapByPromise, wrapTaistAPI,
  slice = [].slice;

appData = {};

wrapByPromise = function(object, method) {
  return function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return new Promise(function(resolve, reject) {
      args.push(function(error, result) {
        if (error) {
          return reject(error);
        } else {
          return resolve(result);
        }
      });
      return object[method].apply(object, args);
    });
  };
};

wrapTaistAPI = function(api) {
  app.exapi.setUserData = wrapByPromise(api.userData, 'set');
  app.exapi.setUserData = wrapByPromise(api.userData, 'get');
  app.exapi.setCompanyData = wrapByPromise(api.companyData, 'set');
  app.exapi.getCompanyData = wrapByPromise(api.companyData, 'get');
  app.exapi.setPartOfCompanyData = wrapByPromise(api.companyData, 'setPart');
  app.exapi.getPartOfCompanyData = wrapByPromise(api.companyData, 'getPart');
  return app.exapi.updateCompanyData = function(key, newData) {
    return app.exapi.getCompanyData(key).then(function(storedData) {
      var updatedData;
      updatedData = {};
      Object.assign(updatedData, storedData, newData);
      return Promise.all([updatedData, app.exapi.setCompanyData(key, updatedData)]);
    }).then(function(data) {
      return data[0];
    });
  };
};

app = {
  api: null,
  exapi: {},
  options: {
    nimbleToken: null
  },
  init: function(api) {
    app.api = api;
    wrapTaistAPI(api);
    return require('./nimbleApi').init(app, 'nimbleAPI');
  },
  actions: {}
};

module.exports = app;

},{"./nimbleApi":5}],3:[function(require,module,exports){
var DOMObserver, defaultConfig;

defaultConfig = {
  subtree: true,
  childList: true
};

DOMObserver = (function() {
  DOMObserver.prototype.mutationObserver = null;

  DOMObserver.prototype.isActive = false;

  DOMObserver.prototype.observers = {};

  DOMObserver.prototype.processedOnce = [];

  DOMObserver.prototype.checkForAction = function(selector, observer, container) {
    var matchedElems, nodesList;
    nodesList = container.querySelectorAll(selector);
    matchedElems = Array.prototype.slice.call(nodesList);
    return matchedElems.forEach((function(_this) {
      return function(elem) {
        if (elem && _this.processedOnce.indexOf(elem) < 0) {
          _this.processedOnce.push(elem);
          return observer.action(elem);
        }
      };
    })(this));
  };

  function DOMObserver(props) {
    var ref;
    this.config = (ref = props != null ? props.observerConfig : void 0) != null ? ref : defaultConfig;
    this.mutationObserver = new MutationObserver((function(_this) {
      return function(mutations) {
        return mutations.forEach(function(mutation) {
          var observer, ref1, results, selector;
          ref1 = _this.observers;
          results = [];
          for (selector in ref1) {
            observer = ref1[selector];
            results.push(_this.checkForAction(selector, observer, mutation.target));
          }
          return results;
        });
      };
    })(this));
  }

  DOMObserver.prototype.activateMainObserver = function() {
    var target;
    if (!this.isActive) {
      this.isActive = true;
      target = document.querySelector('body');
      return this.mutationObserver.observe(target, this.config);
    }
  };

  DOMObserver.prototype.waitElement = function(selector, action) {
    var observer;
    this.activateMainObserver();
    observer = {
      selector: selector,
      action: action
    };
    this.observers[selector] = observer;
    return this.checkForAction(selector, observer, document.querySelector('body'));
  };

  return DOMObserver;

})();

module.exports = DOMObserver;

},{}],4:[function(require,module,exports){
var _listenForRequestFinish, _listenToRequests, _listening, _responseHandlers, _window;

_responseHandlers = [];

_listening = false;

_window = window;

_listenToRequests = function() {
  var originalSend;
  originalSend = _window.XMLHttpRequest.prototype.send;
  return _window.XMLHttpRequest.prototype.send = function() {
    _listenForRequestFinish(this);
    return originalSend.apply(this, arguments);
  };
};

_listenForRequestFinish = function(request) {
  var originalOnReadyStateChange;
  originalOnReadyStateChange = request.onreadystatechange;
  return request.onreadystatechange = function() {
    var finished, handler, i, len;
    finished = request.readyState === 4;
    if (finished) {
      for (i = 0, len = _responseHandlers.length; i < len; i++) {
        handler = _responseHandlers[i];
        handler(request);
      }
    }
    return originalOnReadyStateChange != null ? originalOnReadyStateChange.apply(request, arguments) : void 0;
  };
};

module.exports = {
  onRequestFinish: function(options) {
    _window = options.window || window;
    _responseHandlers.push(options.responseHandler);
    if (!_listening) {
      return _listenToRequests();
    }
  }
};

},{}],5:[function(require,module,exports){
var app, nimbleAPI, sendNimbleRequest;

app = null;

sendNimbleRequest = function(path) {
  if (app.options.nimbleToken) {
    return new Promise(function(resolve, reject) {
      return $.ajax({
        url: path,
        dataType: "json",
        headers: {
          Authorization: "Nimble token=\"" + app.options.nimbleToken + "\""
        }
      }).then(function(result) {
        return resolve(result);
      }, function(error) {
        return reject(error);
      });
    });
  } else {
    return new Promise(function(resolve) {
      return setTimeout((function() {
        return resolve(sendNimbleRequest(path));
      }), 500);
    });
  }
};

nimbleAPI = {
  getDealIdFromUrl: function() {
    var matches;
    matches = location.hash.match(/deals\/[^?]+\?id=([0-9a-f]{24})/);
    if (matches) {
      return matches[1];
    } else {
      return null;
    }
  },
  getDealInfo: function() {
    var dealId;
    if (dealId = nimbleAPI.getDealIdFromUrl()) {
      return sendNimbleRequest("/api/deals/" + dealId);
    }
  },
  getContactById: function(contactId) {
    return sendNimbleRequest("/api/v1/contacts/detail/?id=" + contactId);
  },
  getUserById: function(userId) {
    return sendNimbleRequest("/api/users/" + userId);
  }
};

module.exports = {
  init: function(_app, propertyName) {
    app = _app;
    return _app[propertyName] = nimbleAPI;
  }
};

},{}],6:[function(require,module,exports){
var Baobab, tree;

Baobab = require('baobab');

window._state = tree = new Baobab({
  users: {},
  contacts: {}
}, {
  facets: {}
});

module.exports = tree;

},{"baobab":8}],7:[function(require,module,exports){
/**
 * Baobab Default Options
 * =======================
 *
 */
module.exports = {

  // Should the tree handle its transactions on its own?
  autoCommit: true,

  // Should the transactions be handled asynchronously?
  asynchronous: true,

  // Facets registration
  facets: {},

  // Should the tree's data be immutable?
  immutable: false,

  // Validation specifications
  validate: null,

  // Validation behaviour 'rollback' or 'notify'
  validationBehavior: 'rollback',

  // Should the user be able to write the tree synchronously?
  syncwrite: false
};

},{}],8:[function(require,module,exports){
/**
 * Baobab Public Interface
 * ========================
 *
 * Exposes the main library classes.
 */
var Baobab = require('./src/baobab.js'),
    Cursor = require('./src/cursor.js'),
    Facet = require('./src/facet.js'),
    helpers = require('./src/helpers.js');

// Non-writable version
Object.defineProperty(Baobab, 'version', {
  value: '1.1.2'
});

// Exposing Cursor and Facet classes
Baobab.Cursor = Cursor;
Baobab.Facet = Facet;

// Exposing helpers
Baobab.getIn = helpers.getIn;

// Exporting
module.exports = Baobab;

},{"./src/baobab.js":10,"./src/cursor.js":11,"./src/facet.js":12,"./src/helpers.js":13}],9:[function(require,module,exports){
(function() {
  'use strict';

  /**
   * Here is the list of every allowed parameter when using Emitter#on:
   * @type {Object}
   */
  var __allowedOptions = {
    once: 'boolean',
    scope: 'object'
  };

  /**
   * Incremental id used to order event handlers.
   */
  var __order = 0;

  /**
   * A simple helper to shallowly merge two objects. The second one will "win"
   * over the first one.
   *
   * @param  {object}  o1 First target object.
   * @param  {object}  o2 Second target object.
   * @return {object}     Returns the merged object.
   */
  function shallowMerge(o1, o2) {
    var o = {},
        k;

    for (k in o1) o[k] = o1[k];
    for (k in o2) o[k] = o2[k];

    return o;
  }

  /**
   * Is the given variable a plain JavaScript object?
   *
   * @param  {mixed}  v   Target.
   * @return {boolean}    The boolean result.
   */
  function isPlainObject(v) {
    return v &&
           typeof v === 'object' &&
           !Array.isArray(v) &&
           !(v instanceof Function) &&
           !(v instanceof RegExp);
  }

  /**
   * Iterate over an object that may have ES6 Symbols.
   *
   * @param  {object}   object  Object on which to iterate.
   * @param  {function} fn      Iterator function.
   * @param  {object}   [scope] Optional scope.
   */
  function forIn(object, fn, scope) {
    var symbols,
        k,
        i,
        l;

    for (k in object)
      fn.call(scope || null, k, object[k]);

    if (Object.getOwnPropertySymbols) {
      symbols = Object.getOwnPropertySymbols(object);

      for (i = 0, l = symbols.length; i < l; i++)
        fn.call(scope || null, symbols[i], object[symbols[i]]);
    }
  }

  /**
   * The emitter's constructor. It initializes the handlers-per-events store and
   * the global handlers store.
   *
   * Emitters are useful for non-DOM events communication. Read its methods
   * documentation for more information about how it works.
   *
   * @return {Emitter}         The fresh new instance.
   */
  var Emitter = function() {
    this._enabled = true;

    // Dirty trick that will set the necessary properties to the emitter
    this.unbindAll();
  };

  /**
   * This method unbinds every handlers attached to every or any events. So,
   * these functions will no more be executed when the related events are
   * emitted. If the functions were not bound to the events, nothing will
   * happen, and no error will be thrown.
   *
   * Usage:
   * ******
   * > myEmitter.unbindAll();
   *
   * @return {Emitter}      Returns this.
   */
  Emitter.prototype.unbindAll = function() {

    this._handlers = {};
    this._handlersAll = [];
    this._handlersComplex = [];

    return this;
  };


  /**
   * This method binds one or more functions to the emitter, handled to one or a
   * suite of events. So, these functions will be executed anytime one related
   * event is emitted.
   *
   * It is also possible to bind a function to any emitted event by not
   * specifying any event to bind the function to.
   *
   * Recognized options:
   * *******************
   *  - {?boolean} once   If true, the handlers will be unbound after the first
   *                      execution. Default value: false.
   *  - {?object}  scope  If a scope is given, then the listeners will be called
   *                      with this scope as "this".
   *
   * Variant 1:
   * **********
   * > myEmitter.on('myEvent', function(e) { console.log(e); });
   * > // Or:
   * > myEmitter.on('myEvent', function(e) { console.log(e); }, { once: true });
   *
   * @param  {string}   event   The event to listen to.
   * @param  {function} handler The function to bind.
   * @param  {?object}  options Eventually some options.
   * @return {Emitter}          Returns this.
   *
   * Variant 2:
   * **********
   * > myEmitter.on(
   * >   ['myEvent1', 'myEvent2'],
   * >   function(e) { console.log(e); }
   * >);
   * > // Or:
   * > myEmitter.on(
   * >   ['myEvent1', 'myEvent2'],
   * >   function(e) { console.log(e); }
   * >   { once: true }}
   * >);
   *
   * @param  {array}    events  The events to listen to.
   * @param  {function} handler The function to bind.
   * @param  {?object}  options Eventually some options.
   * @return {Emitter}          Returns this.
   *
   * Variant 3:
   * **********
   * > myEmitter.on({
   * >   myEvent1: function(e) { console.log(e); },
   * >   myEvent2: function(e) { console.log(e); }
   * > });
   * > // Or:
   * > myEmitter.on({
   * >   myEvent1: function(e) { console.log(e); },
   * >   myEvent2: function(e) { console.log(e); }
   * > }, { once: true });
   *
   * @param  {object}  bindings An object containing pairs event / function.
   * @param  {?object}  options Eventually some options.
   * @return {Emitter}          Returns this.
   *
   * Variant 4:
   * **********
   * > myEmitter.on(function(e) { console.log(e); });
   * > // Or:
   * > myEmitter.on(function(e) { console.log(e); }, { once: true});
   *
   * @param  {function} handler The function to bind to every events.
   * @param  {?object}  options Eventually some options.
   * @return {Emitter}          Returns this.
   */
  Emitter.prototype.on = function(a, b, c) {
    var i,
        l,
        k,
        event,
        eArray,
        handlersList,
        bindingObject;

    // Variant 3
    if (isPlainObject(a)) {
      forIn(a, function(name, fn) {
        this.on(name, fn, b);
      }, this);

      return this;
    }

    // Variant 1, 2 and 4
    if (typeof a === 'function') {
      c = b;
      b = a;
      a = null;
    }

    eArray = [].concat(a);

    for (i = 0, l = eArray.length; i < l; i++) {
      event = eArray[i];

      bindingObject = {
        order: __order++,
        fn: b
      };

      // Defining the list in which the handler should be inserted
      if (typeof event === 'string' || typeof event === 'symbol') {
        if (!this._handlers[event])
          this._handlers[event] = [];
        handlersList = this._handlers[event];
        bindingObject.type = event;
      }
      else if (event instanceof RegExp) {
        handlersList = this._handlersComplex;
        bindingObject.pattern = event;
      }
      else if (event === null) {
        handlersList = this._handlersAll;
      }
      else {
        throw Error('Emitter.on: invalid event.');
      }

      // Appending needed properties
      for (k in c || {})
        if (__allowedOptions[k])
          bindingObject[k] = c[k];

      handlersList.push(bindingObject);
    }

    return this;
  };


  /**
   * This method works exactly as the previous #on, but will add an options
   * object if none is given, and set the option "once" to true.
   *
   * The polymorphism works exactly as with the #on method.
   */
  Emitter.prototype.once = function() {
    var args = Array.prototype.slice.call(arguments),
        li = args.length - 1;

    if (isPlainObject(args[li]) && args.length > 1)
      args[li] = shallowMerge(args[li], {once: true});
    else
      args.push({once: true});

    return this.on.apply(this, args);
  };


  /**
   * This method unbinds one or more functions from events of the emitter. So,
   * these functions will no more be executed when the related events are
   * emitted. If the functions were not bound to the events, nothing will
   * happen, and no error will be thrown.
   *
   * Variant 1:
   * **********
   * > myEmitter.off('myEvent', myHandler);
   *
   * @param  {string}   event   The event to unbind the handler from.
   * @param  {function} handler The function to unbind.
   * @return {Emitter}          Returns this.
   *
   * Variant 2:
   * **********
   * > myEmitter.off(['myEvent1', 'myEvent2'], myHandler);
   *
   * @param  {array}    events  The events to unbind the handler from.
   * @param  {function} handler The function to unbind.
   * @return {Emitter}          Returns this.
   *
   * Variant 3:
   * **********
   * > myEmitter.off({
   * >   myEvent1: myHandler1,
   * >   myEvent2: myHandler2
   * > });
   *
   * @param  {object} bindings An object containing pairs event / function.
   * @return {Emitter}         Returns this.
   *
   * Variant 4:
   * **********
   * > myEmitter.off(myHandler);
   *
   * @param  {function} handler The function to unbind from every events.
   * @return {Emitter}          Returns this.
   *
   * Variant 5:
   * **********
   * > myEmitter.off(event);
   *
   * @param  {string} event     The event we should unbind.
   * @return {Emitter}          Returns this.
   */
  function filter(target, fn) {
    target = target || [];

    var a = [],
        l,
        i;

    for (i = 0, l = target.length; i < l; i++)
      if (target[i].fn !== fn)
        a.push(target[i]);

    return a;
  }

  Emitter.prototype.off = function(events, fn) {
    var i,
        n,
        k,
        event;

    // Variant 4:
    if (arguments.length === 1 && typeof events === 'function') {
      fn = arguments[0];

      // Handlers bound to events:
      for (k in this._handlers) {
        this._handlers[k] = filter(this._handlers[k], fn);

        if (this._handlers[k].length === 0)
          delete this._handlers[k];
      }

      // Generic Handlers
      this._handlersAll = filter(this._handlersAll, fn);

      // Complex handlers
      this._handlersComplex = filter(this._handlersComplex, fn);
    }

    // Variant 5
    else if (arguments.length === 1 &&
             (typeof events === 'string' || typeof events === 'symbol')) {
      delete this._handlers[events];
    }

    // Variant 1 and 2:
    else if (arguments.length === 2) {
      var eArray = [].concat(events);

      for (i = 0, n = eArray.length; i < n; i++) {
        event = eArray[i];

        this._handlers[event] = filter(this._handlers[event], fn);

        if ((this._handlers[event] || []).length === 0)
          delete this._handlers[event];
      }
    }

    // Variant 3
    else if (isPlainObject(events)) {
      forIn(events, this.off, this);
    }

    return this;
  };

  /**
   * This method retrieve the listeners attached to a particular event.
   *
   * @param  {?string}    Name of the event.
   * @return {array}      Array of handler functions.
   */
  Emitter.prototype.listeners = function(event) {
    var handlers = this._handlersAll || [],
        complex = false,
        h,
        i,
        l;

    if (!event)
      throw Error('Emitter.listeners: no event provided.');

    handlers = handlers.concat(this._handlers[event] || []);

    for (i = 0, l = this._handlersComplex.length; i < l; i++) {
      h = this._handlersComplex[i];

      if (~event.search(h.pattern)) {
        complex = true;
        handlers.push(h);
      }
    }

    // If we have any complex handlers, we need to sort
    if (this._handlersAll.length || complex)
      return handlers.sort(function(a, b) {
        return a.order - b.order;
      });
    else
      return handlers.slice(0);
  };

  /**
   * This method emits the specified event(s), and executes every handlers bound
   * to the event(s).
   *
   * Use cases:
   * **********
   * > myEmitter.emit('myEvent');
   * > myEmitter.emit('myEvent', myData);
   * > myEmitter.emit(['myEvent1', 'myEvent2']);
   * > myEmitter.emit(['myEvent1', 'myEvent2'], myData);
   * > myEmitter.emit({myEvent1: myData1, myEvent2: myData2});
   *
   * @param  {string|array} events The event(s) to emit.
   * @param  {object?}      data   The data.
   * @return {Emitter}             Returns this.
   */
  Emitter.prototype.emit = function(events, data) {

    // Short exit if the emitter is disabled
    if (!this._enabled)
      return this;

    // Object variant
    if (isPlainObject(events)) {
      forIn(events, this.emit, this);
      return this;
    }

    var eArray = [].concat(events),
        onces = [],
        event,
        parent,
        handlers,
        handler,
        i,
        j,
        l,
        m;

    for (i = 0, l = eArray.length; i < l; i++) {
      handlers = this.listeners(eArray[i]);

      for (j = 0, m = handlers.length; j < m; j++) {
        handler = handlers[j];
        event = {
          type: eArray[i],
          target: this
        };

        if (arguments.length > 1)
          event.data = data;

        handler.fn.call('scope' in handler ? handler.scope : this, event);

        if (handler.once)
          onces.push(handler);
      }

      // Cleaning onces
      for (j = onces.length - 1; j >= 0; j--) {
        parent = onces[j].type ?
          this._handlers[onces[j].type] :
          onces[j].pattern ?
            this._handlersComplex :
            this._handlersAll;

        parent.splice(parent.indexOf(onces[j]), 1);
      }
    }

    return this;
  };


  /**
   * This method will unbind all listeners and make it impossible to ever
   * rebind any listener to any event.
   */
  Emitter.prototype.kill = function() {

    this.unbindAll();
    this._handlers = null;
    this._handlersAll = null;
    this._handlersComplex = null;
    this._enabled = false;

    // Nooping methods
    this.unbindAll =
    this.on =
    this.once =
    this.off =
    this.emit =
    this.listeners = Function.prototype;
  };


  /**
   * This method disabled the emitter, which means its emit method will do
   * nothing.
   *
   * @return {Emitter} Returns this.
   */
  Emitter.prototype.disable = function() {
    this._enabled = false;

    return this;
  };


  /**
   * This method enables the emitter.
   *
   * @return {Emitter} Returns this.
   */
  Emitter.prototype.enable = function() {
    this._enabled = true;

    return this;
  };


  /**
   * Version:
   */
  Emitter.version = '3.1.1';


  // Export:
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports)
      exports = module.exports = Emitter;
    exports.Emitter = Emitter;
  } else if (typeof define === 'function' && define.amd)
    define('emmett', [], function() {
      return Emitter;
    });
  else
    this.Emitter = Emitter;
}).call(this);

},{}],10:[function(require,module,exports){
/**
 * Baobab Data Structure
 * ======================
 *
 * A handy data tree with cursors.
 */
var Cursor = require('./cursor.js'),
    EventEmitter = require('emmett'),
    Facet = require('./facet.js'),
    helpers = require('./helpers.js'),
    update = require('./update.js'),
    merge = require('./merge.js'),
    defaults = require('../defaults.js'),
    type = require('./type.js');

var uniqid = (function() {
  var i = 0;
  return function() {
    return i++;
  };
})();

/**
 * Main Class
 */
function Baobab(initialData, opts) {
  if (arguments.length < 1)
    initialData = {};

  // New keyword optional
  if (!(this instanceof Baobab))
    return new Baobab(initialData, opts);

  if (!type.Object(initialData) && !type.Array(initialData))
    throw Error('Baobab: invalid data.');

  // Extending
  EventEmitter.call(this);

  // Merging defaults
  this.options = helpers.shallowMerge(defaults, opts);

  // Privates
  this._transaction = {};
  this._future = undefined;
  this._cursors = {};
  this._identity = '[object Baobab]';

  // Properties
  this.log = [];
  this.previousData = null;
  this.data = initialData;
  this.root = this.select();
  this.facets = {};

  // Immutable tree?
  if (this.options.immutable)
    helpers.deepFreeze(this.data);

  // Boostrapping root cursor's methods
  function bootstrap(name) {
    this[name] = function() {
      var r = this.root[name].apply(this.root, arguments);
      return r instanceof Cursor ? this : r;
    };
  }

  [
    'apply',
    'chain',
    'get',
    'merge',
    'push',
    'set',
    'splice',
    'unset',
    'unshift',
    'update'
  ].forEach(bootstrap.bind(this));

  // Facets
  if (!type.Object(this.options.facets))
    throw Error('Baobab: invalid facets.');

  for (var k in this.options.facets)
    this.addFacet(k, this.options.facets[k]);
}

helpers.inherits(Baobab, EventEmitter);

/**
 * Prototype
 */
Baobab.prototype.addFacet = function(name, definition, args) {
  this.facets[name] = this.createFacet(definition, args);
  return this;
};

Baobab.prototype.createFacet = function(definition, args) {
  return new Facet(this, definition, args);
};

Baobab.prototype.select = function(path) {
  path = path || [];

  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  if (!type.Path(path))
    throw Error('Baobab.select: invalid path.');

  // Casting to array
  path = [].concat(path);

  // Computing hash
  var hash = path.map(function(step) {
    if (type.Function(step) || type.Object(step))
      return '$' + uniqid() + '$';
    else
      return step;
  }).join('|λ|');

  // Registering a new cursor or giving the already existing one for path
  var cursor;
  if (!this._cursors[hash]) {
    cursor = new Cursor(this, path, hash);
    this._cursors[hash] = cursor;
  }
  else {
    cursor = this._cursors[hash];
  }

  // Emitting an event
  this.emit('select', {path: path, cursor: cursor});
  return cursor;
};

// TODO: if syncwrite wins: drop skipMerge, this._transaction etc.
// TODO: uniq'ing the log through path hashing
Baobab.prototype.stack = function(spec, skipMerge) {
  var self = this;

  if (!type.Object(spec))
    throw Error('Baobab.update: wrong specification.');

  if (!this.previousData)
    this.previousData = this.data;

  // Applying modifications
  if (this.options.syncwrite) {
    var result = update(this.data, spec, this.options);
    this.data = result.data;
    this.log = [].concat(this.log).concat(result.log);
  }
  else {
    this._transaction = (skipMerge && !Object.keys(this._transaction).length) ?
      spec :
      merge(this._transaction, spec);
  }

  // Should we let the user commit?
  if (!this.options.autoCommit)
    return this;

  // Should we update synchronously?
  if (!this.options.asynchronous)
    return this.commit();

  // Updating asynchronously
  if (!this._future)
    this._future = setTimeout(self.commit.bind(self, null), 0);

  return this;
};

Baobab.prototype.commit = function() {

  if (this._future)
    this._future = clearTimeout(this._future);

  if (!this.options.syncwrite) {

    // Applying the asynchronous transaction
    var result = update(this.data, this._transaction, this.options);
    this.data = result.data;
    this.log = result.log;
  }

  // Resetting transaction
  this._transaction = {};

  // Validate?
  var validate = this.options.validate,
      behavior = this.options.validationBehavior;

  if (typeof validate === 'function') {
    var error = validate.call(this, this.previousData, this.data, this.log);

    if (error instanceof Error) {
      this.emit('invalid', {error: error});

      if (behavior === 'rollback') {
        this.data = this.previousData;
        return this;
      }
    }
  }

  // Baobab-level update event
  this.emit('update', {
    log: this.log,
    previousData: this.previousData,
    data: this.data
  });

  this.log = [];
  this.previousData = null;

  return this;
};

Baobab.prototype.release = function() {
  var k;

  delete this.data;
  delete this._transaction;

  // Releasing cursors
  for (k in this._cursors)
    this._cursors[k].release();
  delete this._cursors;

  // Releasing facets
  for (k in this.facets)
    this.facets[k].release();
  delete this.facets;

  // Killing event emitter
  this.kill();
};

/**
 * Output
 */
Baobab.prototype.toJSON = function() {
  return this.get();
};

Baobab.prototype.toString = function() {
  return this._identity;
};

/**
 * Export
 */
module.exports = Baobab;

},{"../defaults.js":7,"./cursor.js":11,"./facet.js":12,"./helpers.js":13,"./merge.js":14,"./type.js":15,"./update.js":16,"emmett":9}],11:[function(require,module,exports){
/**
 * Baobab Cursor Abstraction
 * ==========================
 *
 * Nested selection into a baobab tree.
 */
var EventEmitter = require('emmett'),
    helpers = require('./helpers.js'),
    defaults = require('../defaults.js'),
    type = require('./type.js');

/**
 * Main Class
 */
function Cursor(tree, path, hash) {
  var self = this;

  // Extending event emitter
  EventEmitter.call(this);

  // Enforcing array
  path = path || [];

  // Privates
  this._identity = '[object Cursor]';
  this._additionnalPaths = [];

  // Properties
  this.tree = tree;
  this.path = path;
  this.hash = hash;
  this.archive = null;
  this.recording = false;
  this.undoing = false;

  // Path initialization
  this.complex = type.ComplexPath(path);
  this.solvedPath = path;

  if (this.complex)
    this.solvedPath = helpers.solvePath(this.tree.data, path, this.tree);

  if (this.complex)
    path.forEach(function(step) {
      if (type.Object(step) && '$cursor' in step)
        this._additionnalPaths.push(step.$cursor);
    }, this);

  // Relevant?
  this.relevant = this.get(false) !== undefined;

  // Root listeners
  function update(previousData) {
    var record = helpers.getIn(previousData, self.solvedPath, self.tree);

    if (self.recording && !self.undoing) {

      // Handle archive
      self.archive.add(record);
    }

    self.undoing = false;
    return self.emit('update', {
      data: self.get(false),
      previousData: record
    });
  }

  this.updateHandler = function(e) {
    var log = e.data.log,
        previousData = e.data.previousData,
        shouldFire = false,
        c, p, l, m, i, j;

    // Solving path if needed
    if (self.complex)
      self.solvedPath = helpers.solvePath(self.tree.data, self.path, self.tree);

    // If selector listens at tree, we fire
    if (!self.path.length)
      return update(previousData);

    // Checking update log to see whether the cursor should update.
    if (self.solvedPath)
      shouldFire = helpers.solveUpdate(
        log,
        [self.solvedPath].concat(self._additionnalPaths)
      );

    // Handling relevancy
    var data = self.get(false) !== undefined;

    if (self.relevant) {
      if (data && shouldFire) {
        update(previousData);
      }
      else if (!data) {
        self.emit('irrelevant');
        self.relevant = false;
      }
    }
    else {
      if (data && shouldFire) {
        self.emit('relevant');
        update(previousData);
        self.relevant = true;
      }
    }
  };

  // Lazy binding
  var bound = false;

  this._lazyBind = function() {
    if (bound)
      return;
    bound = true;

    self.tree.on('update', self.updateHandler);
  };

  this.on = helpers.before(this._lazyBind, this.on.bind(this));
  this.once = helpers.before(this._lazyBind, this.once.bind(this));

  if (this.complex)
    this._lazyBind();
}

helpers.inherits(Cursor, EventEmitter);

/**
 * Predicates
 */
Cursor.prototype.isRoot = function() {
  return !this.path.length;
};

Cursor.prototype.isLeaf = function() {
  return type.Primitive(this.get(false));
};

Cursor.prototype.isBranch = function() {
  return !this.isLeaf() && !this.isRoot();
};

/**
 * Traversal
 */
Cursor.prototype.root = function() {
  return this.tree.root;
};

Cursor.prototype.select = function(path) {
  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  if (!type.Path(path))
    throw Error('baobab.Cursor.select: invalid path.');
  return this.tree.select(this.path.concat(path));
};

Cursor.prototype.up = function() {
  if (this.solvedPath && this.solvedPath.length)
    return this.tree.select(this.path.slice(0, -1));
  else
    return null;
};

Cursor.prototype.left = function() {
  var last = +this.solvedPath[this.solvedPath.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.left: cannot go left on a non-list type.');

  return last ?
    this.tree.select(this.solvedPath.slice(0, -1).concat(last - 1)) :
    null;
};

Cursor.prototype.leftmost = function() {
  var last = +this.solvedPath[this.solvedPath.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.leftmost: cannot go left on a non-list type.');

  return this.tree.select(this.solvedPath.slice(0, -1).concat(0));
};

Cursor.prototype.right = function() {
  var last = +this.solvedPath[this.solvedPath.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.right: cannot go right on a non-list type.');

  if (last + 1 === this.up().get(false).length)
    return null;

  return this.tree.select(this.solvedPath.slice(0, -1).concat(last + 1));
};

Cursor.prototype.rightmost = function() {
  var last = +this.solvedPath[this.solvedPath.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.right: cannot go right on a non-list type.');

  var list = this.up().get(false);

  return this.tree.select(this.solvedPath.slice(0, -1).concat(list.length - 1));
};

Cursor.prototype.down = function() {
  var last = +this.solvedPath[this.solvedPath.length - 1];

  if (!(this.get(false) instanceof Array))
    return null;

  return this.tree.select(this.solvedPath.concat(0));
};

Cursor.prototype.map = function(fn, scope) {
  var array = this.get(false),
      l = arguments.length;

  if (!type.Array(array))
    throw Error('baobab.Cursor.map: cannot map a non-list type.');

  return array.map(function(item, i) {
    return fn.call(
      l > 1 ? scope : this,
      this.select(i),
      i
    );
  }, this);
};

/**
 * Access
 */
Cursor.prototype.get = function(path) {

  if (!this.solvedPath)
    return;

  var skipEvent = false;

  if (path === false) {
    path = [];
    skipEvent = true;
  }

  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  var fullPath = this.solvedPath.concat(
    [].concat(path || path === 0 ? path : [])
  );

  // Retrieving data
  var data = helpers.getIn(this.tree.data, fullPath, this.tree);

  // Emitting an event
  if (!skipEvent)
    this.tree.emit('get', {path: fullPath, data: data});

  return data;
};

/**
 * Update
 */
function pathPolymorphism(method, allowedType, key, val) {
  if (arguments.length > 5)
    throw Error('baobab.Cursor.' + method + ': too many arguments.');

  if (method === 'unset') {
    val = true;

    if (arguments.length === 2)
      key = [];
  }

  else if (arguments.length < 4) {
    val = key;
    key = [];
  }

  if (!type.Path(key))
    throw Error('baobab.Cursor.' + method + ': invalid path "' + key + '".');

  // Splice exception
  if (method === 'splice' &&
      !type.Splicer(val)) {
    if (type.Array(val))
      val = [val];
    else
      throw Error('baobab.Cursor.splice: incorrect value.');
  }

  // Checking value validity
  if (allowedType && !allowedType(val))
    throw Error('baobab.Cursor.' + method + ': incorrect value.');

  var path = [].concat(key),
      solvedPath = helpers.solvePath(this.get(false), path, this.tree);

  if (!solvedPath)
    throw Error('baobab.Cursor.' + method + ': could not solve dynamic path.');

  var leaf = {};
  leaf['$' + method] = val;

  var spec = helpers.pathObject(solvedPath, leaf);

  return spec;
}

function makeUpdateMethod(command, type) {
  Cursor.prototype[command] = function() {
    var spec = pathPolymorphism.bind(this, command, type).apply(this, arguments);

    return this.update(spec, true);
  };
}

makeUpdateMethod('set');
makeUpdateMethod('apply', type.Function);
makeUpdateMethod('chain', type.Function);
makeUpdateMethod('push');
makeUpdateMethod('unshift');
makeUpdateMethod('merge', type.Object);
makeUpdateMethod('splice');

Cursor.prototype.unset = function(key) {
  if (key === undefined && this.isRoot())
    throw Error('baobab.Cursor.unset: cannot remove root node.');

  var spec = pathPolymorphism.bind(this, 'unset', null).apply(this, arguments);

  return this.update(spec, true);
};

Cursor.prototype.update = function(spec, skipMerge) {
  if (!type.Object(spec))
    throw Error('baobab.Cursor.update: invalid specifications.');

  if (!this.solvedPath)
    throw Error('baobab.Cursor.update: could not solve the cursor\'s dynamic path.');

  this.tree.stack(helpers.pathObject(this.solvedPath, spec), skipMerge);
  return this;
};

/**
 * History
 */
Cursor.prototype.startRecording = function(maxRecords) {
  maxRecords = maxRecords || 5;

  if (maxRecords < 1)
    throw Error('baobab.Cursor.startRecording: invalid maximum number of records.');

  if (this.archive)
    return this;

  // Lazy bind
  this._lazyBind();

  this.archive = helpers.archive(maxRecords);
  this.recording = true;
  return this;
};

Cursor.prototype.stopRecording = function() {
  this.recording = false;
  return this;
};

Cursor.prototype.undo = function(steps) {
  steps = steps || 1;

  if (!this.recording)
    throw Error('baobab.Cursor.undo: cursor is not recording.');

  if (!type.PositiveInteger(steps))
    throw Error('baobab.Cursor.undo: expecting a positive integer.');

  var record = this.archive.back(steps);

  if (!record)
    throw Error('baobab.Cursor.undo: cannot find a relevant record (' + steps + ' back).');

  this.undoing = true;
  return this.set(record);
};

Cursor.prototype.hasHistory = function() {
  return !!(this.archive && this.archive.get().length);
};

Cursor.prototype.getHistory = function() {
  return this.archive ? this.archive.get() : [];
};

Cursor.prototype.clearHistory = function() {
  this.archive = null;
  return this;
};

/**
 * Releasing
 */
Cursor.prototype.release = function() {

  // Removing listener on parent
  this.tree.off('update', this.updateHandler);

  // If the cursor is hashed, we unsubscribe from the parent
  if (this.hash)
    delete this.tree._cursors[this.hash];

  // Dereferencing
  delete this.tree;
  delete this.path;
  delete this.solvedPath;
  delete this.archive;

  // Killing emitter
  this.kill();
};

/**
 * Output
 */
Cursor.prototype.toJSON = function() {
  return this.get();
};

Cursor.prototype.toString = function() {
  return this._identity;
};

/**
 * Export
 */
module.exports = Cursor;

},{"../defaults.js":7,"./helpers.js":13,"./type.js":15,"emmett":9}],12:[function(require,module,exports){
/**
 * Baobab Facet Abstraction
 * =========================
 *
 * Facets enable the user to define views on a given Baobab tree.
 */
var EventEmitter = require('emmett'),
    Cursor = require('./cursor.js'),
    helpers = require('./helpers.js'),
    type = require('./type.js');

function Facet(tree, definition, args) {
  var self = this;

  var firstTime = true,
      solved = false,
      getter = definition.get,
      facetData = null;

  // Extending event emitter
  EventEmitter.call(this);

  // Properties
  this.killed = false;
  this.tree = tree;
  this.cursors = {};
  this.facets = {};

  var cursorsMapping = definition.cursors,
      facetsMapping = definition.facets,
      complexCursors = typeof definition.cursors === 'function',
      complexFacets = typeof definition.facets === 'function';

  // Refreshing the internal mapping
  function refresh(complexity, targetMapping, targetProperty, mappingType, refreshArgs) {
    if (!complexity && !firstTime)
      return;

    solved = false;

    var solvedMapping = targetMapping;

    if (complexity)
      solvedMapping = targetMapping.apply(this, refreshArgs);

    if (!mappingType(solvedMapping))
      throw Error('baobab.Facet: incorrect ' + targetProperty + ' mapping.');

    self[targetProperty] = {};

    Object.keys(solvedMapping).forEach(function(k) {

      if (targetProperty === 'cursors') {
        if (solvedMapping[k] instanceof Cursor) {
          self.cursors[k] = solvedMapping[k];
          return;
        }

        if (type.Path(solvedMapping[k])) {
          self.cursors[k] = tree.select(solvedMapping[k]);
          return;
        }
      }

      else {
        if (solvedMapping[k] instanceof Facet) {
          self.facets[k] = solvedMapping[k];
          return;
        }

        if (typeof solvedMapping[k] === 'string') {
          self.facets[k] = tree.facets[solvedMapping[k]];

          if (!self.facets[k])
            throw Error('baobab.Facet: unkown "' + solvedMapping[k] + '" facet in facets mapping.');
          return;
        }
      }
    });
  }

  this.refresh = function(refreshArgs) {
    refreshArgs = refreshArgs || [];

    if (!type.Array(refreshArgs))
      throw Error('baobab.Facet.refresh: first argument should be an array.');

    if (cursorsMapping)
      refresh(
        complexCursors,
        cursorsMapping,
        'cursors',
        type.FacetCursors,
        refreshArgs
      );

    if (facetsMapping)
      refresh(
        complexFacets,
        facetsMapping,
        'facets',
        type.FacetFacets,
        refreshArgs
      );
  };

  // Data solving
  this.get = function() {
    if (solved)
      return facetData;

    // Solving
    var data = {},
        k;

    for (k in self.facets)
      data[k] = self.facets[k].get();

    for (k in self.cursors)
      data[k] = self.cursors[k].get();

    // Applying getter
    data = typeof getter === 'function' ?
      getter.call(self, data) :
      data;

    solved = true;
    facetData = data;

    return facetData;
  };

  // Tracking the tree's updates
  function cursorsPaths(cursors) {
    return Object.keys(cursors).map(function(k) {
      return cursors[k].solvedPath;
    });
  }

  function facetsPaths(facets) {
    var paths =  Object.keys(facets).map(function(k) {
      return cursorsPaths(facets[k].cursors).concat(facetsPaths(facets[k].facets));
    });

    return [].concat.apply([], paths);
  }

  this.updateHandler = function(e) {
    if (self.killed)
      return;

    var paths = cursorsPaths(self.cursors).concat(facetsPaths(self.facets));

    if (helpers.solveUpdate(e.data.log, paths)) {
      solved = false;
      self.emit('update');
    }
  };

  // Init routine
  this.refresh(args);
  this.tree.on('update', this.updateHandler);

  firstTime = false;
}

helpers.inherits(Facet, EventEmitter);

Facet.prototype.release = function() {
  this.tree.off('update', this.updateHandler);

  this.tree = null;
  this.cursors = null;
  this.facets = null;
  this.killed = true;
  this.kill();
};

module.exports = Facet;

},{"./cursor.js":11,"./helpers.js":13,"./type.js":15,"emmett":9}],13:[function(require,module,exports){
(function (global){
/**
 * Baobab Helpers
 * ===============
 *
 * Miscellaneous helper functions.
 */
var type = require('./type.js');

// Make a real array of an array-like object
function arrayOf(o) {
  return Array.prototype.slice.call(o);
}

// Decorate a function by applying something before it
function before(decorator, fn) {
  return function() {
    decorator.apply(null, arguments);
    fn.apply(null, arguments);
  };
}

// Non-mutative splice function
function splice(array, index, nb /*, &elements */) {
  var elements = arrayOf(arguments).slice(3);

  return array
    .slice(0, index)
    .concat(elements)
    .concat(array.slice(index + nb));
}

// Shallow merge
function shallowMerge(o1, o2) {
  var o = {},
      k;

  for (k in o1) o[k] = o1[k];
  for (k in o2) o[k] = o2[k];

  return o;
}

// Clone a regexp
function cloneRegexp(re) {
  var pattern = re.source,
      flags = '';

  if (re.global) flags += 'g';
  if (re.multiline) flags += 'm';
  if (re.ignoreCase) flags += 'i';
  if (re.sticky) flags += 'y';
  if (re.unicode) flags += 'u';

  return new RegExp(pattern, flags);
}

// Cloning function
function cloner(deep, item) {
  if (!item ||
      typeof item !== 'object' ||
      item instanceof Error ||
      ('ArrayBuffer' in global && item instanceof ArrayBuffer))
    return item;

  // Array
  if (type.Array(item)) {
    if (deep) {
      var i, l, a = [];
      for (i = 0, l = item.length; i < l; i++)
        a.push(deepClone(item[i]));
      return a;
    }
    else {
      return item.slice(0);
    }
  }

  // Date
  if (type.Date(item))
    return new Date(item.getTime());

  // RegExp
  if (item instanceof RegExp)
    return cloneRegexp(item);

  // Object
  if (type.Object(item)) {
    var k, o = {};

    if (item.constructor && item.constructor !== Object)
      o = Object.create(item.constructor.prototype);

    for (k in item)
      if (item.hasOwnProperty(k))
        o[k] = deep ? deepClone(item[k]) : item[k];
    return o;
  }

  return item;
}

// Shallow & deep cloning functions
var shallowClone = cloner.bind(null, false),
    deepClone = cloner.bind(null, true);

// Freezing function
function freezer(deep, o) {
  if (typeof o !== 'object')
    return;

  Object.freeze(o);

  if (!deep)
    return;

  if (Array.isArray(o)) {

    // Iterating through the elements
    var i,
        l;

    for (i = 0, l = o.length; i < l; i++)
      deepFreeze(o[i]);
  }
  else {
    var p,
        k;

    for (k in o) {
      p = o[k];

      if (!p ||
          !o.hasOwnProperty(k) ||
          typeof p !== 'object' ||
          Object.isFrozen(p))
        continue;

      deepFreeze(p);
    }
  }
}

// Shallow & deep freezing function
var freeze = Object.freeze ? freezer.bind(null, false) : Function.prototype,
    deepFreeze = Object.freeze ? freezer.bind(null, true) : Function.prototype;

// Simplistic composition
function compose(fn1, fn2) {
  return function(arg) {
    return fn2(fn1(arg));
  };
}

// Get first item matching predicate in list
function first(a, fn) {
  var i, l;
  for (i = 0, l = a.length; i < l; i++) {
    if (fn(a[i]))
      return a[i];
  }
  return;
}

function index(a, fn) {
  var i, l;
  for (i = 0, l = a.length; i < l; i++) {
    if (fn(a[i]))
      return i;
  }
  return -1;
}

// Compare object to spec
function compare(object, spec) {
  var ok = true,
      k;

  // If we reached here via a recursive call, object may be undefined because
  // not all items in a collection will have the same deep nesting structure
  if (!object) {
    return false;
  }

  for (k in spec) {
    if (type.Object(spec[k])) {
      ok = ok && compare(object[k], spec[k]);
    }
    else if (type.Array(spec[k])) {
      ok = ok && !!~spec[k].indexOf(object[k]);
    }
    else {
      if (object[k] !== spec[k])
        return false;
    }
  }

  return ok;
}

function firstByComparison(object, spec) {
  return first(object, function(e) {
    return compare(e, spec);
  });
}

function indexByComparison(object, spec) {
  return index(object, function(e) {
    return compare(e, spec);
  });
}

// Retrieve nested objects
function getIn(object, path, tree) {
  path = path || [];

  var c = object,
      p,
      i,
      l;

  for (i = 0, l = path.length; i < l; i++) {
    if (!c)
      return;

    if (typeof path[i] === 'function') {
      if (!type.Array(c))
        return;

      c = first(c, path[i]);
    }
    else if (typeof path[i] === 'object') {
      if (tree && '$cursor' in path[i]) {
        if (!type.Path(path[i].$cursor))
          throw Error('baobab.getIn: $cursor path must be an array.');

        p = tree.get(path[i].$cursor);
        c = c[p];
      }

      else if (!type.Array(c)) {
        return;
      }

      else {
        c = firstByComparison(c, path[i]);
      }
    }
    else {
      c = c[path[i]];
    }
  }

  return c;
}

// Solve a complex path
function solvePath(object, path, tree) {
  var solvedPath = [],
      c = object,
      idx,
      i,
      l;

  for (i = 0, l = path.length; i < l; i++) {
    if (!c)
      return null;

    if (typeof path[i] === 'function') {
      if (!type.Array(c))
        return;

      idx = index(c, path[i]);
      solvedPath.push(idx);
      c = c[idx];
    }
    else if (typeof path[i] === 'object') {
      if (tree && '$cursor' in path[i]) {
        if (!type.Path(path[i].$cursor))
          throw Error('baobab.getIn: $cursor path must be an array.');

        p = tree.get(path[i].$cursor);
        solvedPath.push(p);
        c = c[p];
      }

      else if (!type.Array(c)) {
        return;
      }

      else {
        idx = indexByComparison(c, path[i]);
        solvedPath.push(idx);
        c = c[idx];
      }
    }
    else {
      solvedPath.push(path[i]);
      c = c[path[i]] || {};
    }
  }

  return solvedPath;
}

// Determine whether an update should fire for the given paths
// NOTES: 1) if performance becomes an issue, the threefold loop can be
//           simplified to become a complex twofold one.
//        2) a regex version could also work but I am not confident it would be
//           faster.
function solveUpdate(log, paths) {
  var i, j, k, l, m, n, p, c, s;

  // Looping through possible paths
  for (i = 0, l = paths.length; i < l; i++) {
    p = paths[i];

    if (!p.length)
      return true;

    // Looping through logged paths
    for (j = 0, m = log.length; j < m; j++) {
      c = log[j];

      if (!c.length)
        return true;

      // Looping through steps
      for (k = 0, n = c.length; k < n; k++) {
        s = c[k];

        // If path is not relevant, we break
        if (s != p[k])
          break;

        // If we reached last item and we are relevant
        if (k + 1 === n || k + 1 === p.length)
          return true;
      }
    }
  }

  return false;
}

// Return a fake object relative to the given path
function pathObject(path, spec) {
  var l = path.length,
      o = {},
      c = o,
      i;

  if (!l)
    o = spec;

  for (i = 0; i < l; i++) {
    c[path[i]] = (i + 1 === l) ? spec : {};
    c = c[path[i]];
  }

  return o;
}

// Shim used for cross-compatible event emitting extension
function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  var TempCtor = function () {};
  TempCtor.prototype = superCtor.prototype;
  ctor.prototype = new TempCtor();
  ctor.prototype.constructor = ctor;
}

// Archive
function archive(size) {
  var records = [];

  return {
    add: function(record) {
      records.unshift(record);

      if (records.length > size)
        records.length = size;
    },
    back: function(steps) {
      var record = records[steps - 1];

      if (record)
        records = records.slice(steps);
      return record;
    },
    get: function() {
      return records;
    }
  };
}

module.exports = {
  archive: archive,
  arrayOf: arrayOf,
  before: before,
  freeze: freeze,
  deepClone: deepClone,
  deepFreeze: deepFreeze,
  shallowClone: shallowClone,
  shallowMerge: shallowMerge,
  compose: compose,
  getIn: getIn,
  inherits: inherits,
  pathObject: pathObject,
  solvePath: solvePath,
  solveUpdate: solveUpdate,
  splice: splice
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./type.js":15}],14:[function(require,module,exports){
/**
 * Baobab Merge
 * =============
 *
 * A function used to merge updates in the stack.
 */
var helpers = require('./helpers.js'),
    type = require('./type.js');

// Helpers
var COMMANDS = ['$unset', '$set', '$apply'];

function only(command, commandValue) {
  var o = {};
  o[command] = commandValue;
  return o;
}

// Main function
function merge(a, b) {
  var o = helpers.shallowClone(a || {}),
      leafLevel = false,
      k,
      i;

  COMMANDS.forEach(function(c) {
    if (c in b) {
      o = only(c, b[c]);
      leafLevel = true;
    }
  });

  if (b.$chain) {

    if (o.$apply)
      o.$apply = helpers.compose(o.$apply, b.$chain);
    else
      o.$apply = b.$chain;

    o = only('$apply', o.$apply);
    leafLevel = true;
  }

  if (b.$merge) {
    o.$merge = helpers.shallowMerge(o.$merge || {}, b.$merge);
    leafLevel = true;
  }

  if (b.$splice || b.$splice) {
    o.$splice = [].concat(o.$splice || []).concat(b.$splice || []);
    leafLevel = true;
  }

  if (b.$push || o.$push) {
    o.$push = [].concat(o.$push || []).concat(b.$push || []);
    leafLevel = true;
  }

  if (b.$unshift || o.$unshift) {
    o.$unshift = [].concat(b.$unshift || []).concat(o.$unshift || []);
    leafLevel = true;
  }

  if (leafLevel)
    return o;

  for (k in o) {
    if (k.charAt(0) === '$')
      delete o[k];
  }

  for (k in b) {
    if (type.Object(b[k]))
      o[k] = merge(o[k], b[k]);
  }

  return o;
}

module.exports = merge;

},{"./helpers.js":13,"./type.js":15}],15:[function(require,module,exports){
/**
 * Baobab Type Checking
 * =====================
 *
 * Misc helpers functions used throughout the library to perform some type
 * tests at runtime.
 *
 * @christianalfoni
 */
var type = {};

/**
 * Helpers
 */
function anyOf(value, allowed) {
  return allowed.some(function(t) {
    return type[t](value);
  });
}

/**
 * Simple types
 */
type.Array = function(value) {
  return Array.isArray(value);
};

type.Object = function(value) {
  return value &&
         typeof value === 'object' &&
         !Array.isArray(value) &&
         !(value instanceof Date) &&
         !(value instanceof RegExp);
};

type.String = function(value) {
  return typeof value === 'string';
};

type.Number = function(value) {
  return typeof value === 'number';
};

type.PositiveInteger = function(value) {
  return typeof value === 'number' && value > 0 && value % 1 === 0;
};

type.Function = function(value) {
  return typeof value === 'function';
};

type.Primitive = function(value) {
  return value !== Object(value);
};

type.Date = function(value) {
  return value instanceof Date;
};

/**
 * Complex types
 */
type.NonScalar = function(value) {
  return type.Object(value) || type.Array(value);
};

type.Splicer = function(value) {
  return type.Array(value) &&
         value.every(type.Array);
};

type.Path = function(value, allowed) {
  allowed = allowed || ['String', 'Number', 'Function', 'Object'];

  if (type.Array(value)) {
    return value.every(function(step) {
      return anyOf(step, allowed);
    });
  }
  else {
    return anyOf(value, allowed);
  }
};

type.ComplexPath = function(value) {
  return value.some(function(step) {
    return anyOf(step, ['Object', 'Function']);
  });
};

type.FacetCursors = function(value) {
  if (!type.Object(value))
    return false;

  return Object.keys(value).every(function(k) {
    var v = value[k];

    return type.Path(v, ['String', 'Number', 'Object']) ||
           v instanceof require('./cursor.js');
  });
};

type.FacetFacets = function(value) {
  if (!type.Object(value))
    return false;

  return Object.keys(value).every(function(k) {
    var v = value[k];

    return typeof v === 'string' ||
           v instanceof require('./facet.js');
  });
};

module.exports = type;

},{"./cursor.js":11,"./facet.js":12}],16:[function(require,module,exports){
/**
 * Baobab Update
 * ==============
 *
 * A handy method to mutate an atom according to the given specification.
 * Mostly inspired by http://facebook.github.io/react/docs/update.html
 */
var helpers = require('./helpers.js'),
    type = require('./type.js');

// Helpers
function makeError(path, message) {
  var e = new Error('baobab.update: ' + message + ' at path /' +
                    path.slice(1).join('/'));

  e.path = path;
  return e;
}

module.exports = function(data, spec, opts) {
  opts = opts || {};

  var log = {};

  // Shifting root
  data = {root: helpers.shallowClone(data)};

  // Closure performing the updates themselves
  var mutator = function(o, spec, path, parent) {
    path = path || ['root'];

    var hash = path.join('|λ|'),
        lastKey = path[path.length - 1],
        oldValue = o[lastKey],
        fn,
        k,
        v,
        i,
        l;

    // Are we at leaf level?
    var leafLevel = Object.keys(spec).some(function(k) {
      return k.charAt(0) === '$';
    });

    // Leaf level updates
    if (leafLevel) {
      log[hash] = true;

      for (k in spec) {

        // $unset
        if (k === '$unset') {
          var olderKey = path[path.length - 2];

          if (!type.Object(parent[olderKey]))
            throw makeError(path.slice(0, -1), 'using command $unset on a non-object');

          parent[olderKey] = helpers.shallowClone(o);
          delete parent[olderKey][lastKey];

          if (opts.immutable)
            helpers.freeze(parent[olderKey]);
          break;
        }

        // $set
        if (k === '$set') {
          v = spec.$set;

          o[lastKey] = v;
        }

        // $apply
        else if (k === '$apply' || k === '$chain') {
          fn = spec.$apply || spec.$chain;

          if (typeof fn !== 'function')
            throw makeError(path, 'using command $apply with a non function');

          o[lastKey] = fn.call(null, oldValue);
        }

        // $merge
        else if (k === '$merge') {
          v = spec.$merge;

          if (!type.Object(o[lastKey]) || !type.Object(v))
            throw makeError(path, 'using command $merge with a non object');

          o[lastKey] = helpers.shallowMerge(o[lastKey], v);
        }

        // $splice
        if (k === '$splice') {
          v = spec.$splice;

          if (!type.Array(o[lastKey]))
            throw makeError(path, 'using command $push to a non array');

          for (i = 0, l = v.length; i < l; i++)
            o[lastKey] = helpers.splice.apply(null, [o[lastKey]].concat(v[i]));
        }

        // $push
        if (k === '$push') {
          v = spec.$push;

          if (!type.Array(o[lastKey]))
            throw makeError(path, 'using command $push to a non array');

          o[lastKey] = o[lastKey].concat(v);
        }

        // $unshift
        if (k === '$unshift') {
          v = spec.$unshift;

          if (!type.Array(o[lastKey]))
            throw makeError(path, 'using command $unshift to a non array');

          o[lastKey] = [].concat(v).concat(o[lastKey]);
        }

        // Deep freezing the new value?
        if (opts.immutable)
          helpers.deepFreeze(o);
      }
    }
    else {

      // If nested object does not exist, we create it
      if (type.Primitive(o[lastKey]))
        o[lastKey] = {};
      else
        o[lastKey] = helpers.shallowClone(o[lastKey]);

      // Should we freeze the parent?
      if (opts.immutable)
        helpers.freeze(o);

      for (k in spec)  {

        // Recur
        mutator(
          o[lastKey],
          spec[k],
          path.concat(k),
          o
        );
      }
    }
  };

  mutator(data, spec);

  // Returning data and path log
  return {
    data: data.root,

    // SHIFT LOG
    log: Object.keys(log).map(function(hash) {
      return hash.split('|λ|').slice(1);
    })
  };
};

},{"./helpers.js":13,"./type.js":15}],"addon":[function(require,module,exports){
var DOMObserver, addonEntry, app, contactsCursor, elementObserver, extractNimbleAuthTokenFromRequest, findParent, proxy, showLastContactedPerson, state, waitingForContactsRequest;

app = require('./app');

state = require('./state');

require('./actions');

contactsCursor = state.select(['contacts']);

proxy = require('./helpers/xmlHttpProxy');

extractNimbleAuthTokenFromRequest = function() {
  return proxy.onRequestFinish({
    responseHandler: function(request) {
      var tokenMatches, url;
      url = request.responseURL;
      tokenMatches = url.match(/\/api\/sessions\/([0-9abcdef-]{36})\?/);
      if (tokenMatches != null) {
        return app.options.nimbleToken = tokenMatches[1];
      }
    }
  });
};

findParent = function(element, selector) {
  var parentNode;
  while (parentNode = element.parentNode) {
    if (parentNode.matches(selector)) {
      return parentNode;
    }
    element = parentNode;
  }
  return null;
};

DOMObserver = require('./helpers/domObserver');

elementObserver = new DOMObserver();

showLastContactedPerson = function(contactId, userId) {
  var selector;
  selector = ".ContactsGrid [__gwt_row] .contact-name[href$=\"" + contactId + "\"]";
  return elementObserver.waitElement(selector, function(contactLink) {
    var attrValue, contactBlock, div, lastContactContainer, user, userCursor;
    contactBlock = findParent(contactLink, '[__gwt_row]');
    if (contactBlock) {
      attrValue = contactBlock.getAttribute('__gwt_row');
      selector = ".ContactsGrid [__gwt_row=\"" + attrValue + "\"] td.last-contacted";
      lastContactContainer = document.querySelector(selector);
      if (lastContactContainer) {
        lastContactContainer.style.paddingLeft = '12px';
        div = document.createElement('div');
        div.style.color = 'black';
        lastContactContainer.appendChild(div);
        userCursor = state.select(['users', userId]);
        user = userCursor.get();
        if (user) {
          return div.innerText = user.name || '';
        } else {
          return userCursor.on('update', function(event) {
            userCursor.off('update');
            return div.innerText = event.data.data.name || '';
          });
        }
      }
    }
  });
};

waitingForContactsRequest = function() {
  return proxy.onRequestFinish({
    responseHandler: function(request) {
      var error, ref, result, url;
      url = request.responseURL;
      if (url.match(/\/api(\/.+)?\/contacts\/list\?/)) {
        try {
          result = JSON.parse(request.responseText);
        } catch (_error) {
          error = _error;
          return;
        }
        return (ref = result.resources) != null ? ref.forEach(function(contact) {
          var id, last_contacted, obj;
          id = contact.id, last_contacted = contact.last_contacted;
          if (((last_contacted != null ? last_contacted.user_id : void 0) != null)) {
            contactsCursor.update((
              obj = {},
              obj["" + id] = {
                last_contacted: {
                  $set: last_contacted
                }
              },
              obj
            ));
            return showLastContactedPerson(id, last_contacted.user_id);
          }
        }) : void 0;
      }
    }
  });
};

addonEntry = {
  start: function(_taistApi, entryPoint) {
    window._app = app;
    app.init(_taistApi);
    extractNimbleAuthTokenFromRequest();
    waitingForContactsRequest();
    return _taistApi.log('Addon started');
  }
};

module.exports = addonEntry;

},{"./actions":1,"./app":2,"./helpers/domObserver":3,"./helpers/xmlHttpProxy":4,"./state":6}]},{},[]);
;return require("addon")}