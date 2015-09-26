function init(){var require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var app, appData,
  slice = [].slice;

appData = {};

app = {
  api: null,
  exapi: {},
  init: function(api) {
    var wrapByPromise;
    app.api = api;
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
  },
  actions: {}
};

module.exports = app;

},{}],2:[function(require,module,exports){
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

},{}],"addon":[function(require,module,exports){
var addonEntry, app;

app = require('./app');

addonEntry = {
  start: function(_taistApi, entryPoint) {
    var DOMObserver;
    window._app = app;
    app.init(_taistApi);
    DOMObserver = require('./helpers/domObserver');
    app.elementObserver = new DOMObserver();
    return _taistApi.log('Addon started');
  }
};

module.exports = addonEntry;

},{"./app":1,"./helpers/domObserver":2}]},{},[]);
;return require("addon")}