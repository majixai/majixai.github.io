/**
 * mvc-router.js — MajixMvcRouter
 *
 * Client-side router with hash and history API modes.
 * Supports named params, query strings, nested routes,
 * navigation guards, named routes, and route groups.
 *
 * Usage:
 *   <script src="/mvc/mvc-router.js"></script>
 *
 *   var router = MajixMvcRouter.create({
 *     mode: "hash",  // or "history"
 *     routes: [
 *       { path: "/",        controller: "HomeCtrl",  action: "index" },
 *       { path: "/users/:id", controller: "UserCtrl", action: "show" }
 *     ]
 *   });
 *   router.beforeEach(function(to, from, next) { next(); });
 *   router.start();
 *
 * @version 1.0.0
 */

(function (global) {
  'use strict';

  var VERSION = "1.0.0";

  // ─── Utilities ─────────────────────────────────────────────────────────
  function noop() {}
  function isString(v) { return typeof v === "string"; }
  function isFunction(v) { return typeof v === "function"; }
  function isObject(v) { return v !== null && typeof v === "object"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) Object.keys(src).forEach(function(k) { target[k] = src[k]; });
    }
    return target;
  }

  // ─── Internal event bus ─────────────────────────────────────────────────
  var _ev = {};
  function _on(e,fn){ (_ev[e]||(_ev[e]=[])).push(fn); }
  function _off(e,fn){ if(_ev[e]) _ev[e]=_ev[e].filter(function(h){return h!==fn;}); }
  function _emit(e,d){ (_ev[e]||[]).slice().forEach(function(h){ try{h(d);}catch(ex){} }); }

  // ─── Route class ────────────────────────────────────────────────────────
  /**
   * Represents a single route definition.
   *
   * @constructor
   * @param {object} opts
   * @param {string}   opts.path       - Route path pattern (e.g. "/users/:id").
   * @param {string}   [opts.name]     - Named route identifier.
   * @param {string}   [opts.controller] - Controller name.
   * @param {string}   [opts.action]   - Action name.
   * @param {Function} [opts.handler]  - Direct handler function.
   * @param {object}   [opts.meta]     - Arbitrary route metadata.
   * @param {array}    [opts.children] - Nested route definitions.
   */
  function Route(opts) {
    this.path        = opts.path || "/";
    this.name        = opts.name || null;
    this.controller  = opts.controller || null;
    this.action      = opts.action || "index";
    this.handler     = opts.handler || null;
    this.meta        = opts.meta || {};
    this.children    = (opts.children || []).map(function(c) { return new Route(c); });
    this.guards      = opts.guards || [];
    this.middleware  = opts.middleware || [];
    this._keys       = [];
    this._regex      = this._compile(this.path);
  }

  /**
   * Compile a path pattern into a RegExp, extracting param key names.
   *
   * @param {string} path - Route path (e.g. "/users/:id/posts/:postId").
   * @returns {RegExp}
   */
  Route.prototype._compile = function(path) {
    this._keys = [];
    var self = this;
    var pattern = path
      .replace(/\/\*/g, "(?:.*)")
      .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)(\?)?/g, function(m, key, optional) {
        self._keys.push({ name: key, optional: !!optional });
        return optional ? "([^/]*)" : "([^/]+)";
      });
    return new RegExp("^" + pattern + "\\/?$", "i");
  };

  /**
   * Test whether a URL pathname matches this route.
   *
   * @param {string} pathname - URL path to test.
   * @returns {object|null} Match object with params, or null if no match.
   */
  Route.prototype.match = function(pathname) {
    var m = pathname.match(this._regex);
    if (!m) return null;
    var params = {};
    this._keys.forEach(function(k, i) {
      params[k.name] = m[i + 1] ? decodeURIComponent(m[i + 1]) : null;
    });
    return { route: this, params: params };
  };

  /**
   * Generate a URL for this route given a params object.
   *
   * @param {object} [params={}] - Named parameters.
   * @returns {string} Generated URL path.
   */
  Route.prototype.generate = function(params) {
    params = params || {};
    return this.path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)(\?)?/g, function(m, key, optional) {
      var val = params[key];
      if (val === undefined || val === null) {
        if (optional) return "";
        throw new Error("[Router] missing required param: " + key);
      }
      return encodeURIComponent(val);
    });
  };

  /**
   * Serialise the route to a plain object (for debug/logging).
   * @returns {object}
   */
  Route.prototype.toJSON = function() {
    return {
      path:        this.path,
      name:        this.name,
      controller:  this.controller,
      action:      this.action,
      meta:        this.meta,
      childCount:  this.children.length
    };
  };

  // ─── QueryString helpers ─────────────────────────────────────────────────
  /**
   * Parse a query string into a key/value map.
   *
   * @param {string} search - Raw query string (with or without leading "?").
   * @returns {object} Parsed key/value map.
   *
   * @example
   *   parseQuery("?foo=1&bar=hello%20world")
   *   // => { foo: "1", bar: "hello world" }
   */
  function parseQuery(search) {
    var result = {};
    var str = (search || "").replace(/^\?/, "");
    if (!str) return result;
    str.split("&").forEach(function(pair) {
      var idx = pair.indexOf("=");
      if (idx === -1) {
        result[decodeURIComponent(pair)] = true;
      } else {
        var key = decodeURIComponent(pair.slice(0, idx));
        var val = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, " "));
        if (result[key] !== undefined) {
          result[key] = [].concat(result[key], val);
        } else {
          result[key] = val;
        }
      }
    });
    return result;
  }

  /**
   * Stringify a key/value map to a query string.
   *
   * @param {object} params - Key/value pairs.
   * @returns {string} Query string without leading "?".
   *
   * @example
   *   stringifyQuery({ foo: "1", bar: "hello world" })
   *   // => "foo=1&bar=hello%20world"
   */
  function stringifyQuery(params) {
    if (!params || !Object.keys(params).length) return "";
    return Object.keys(params).map(function(k) {
      var v = params[k];
      if (Array.isArray(v)) {
        return v.map(function(vi) { return encodeURIComponent(k) + "=" + encodeURIComponent(vi); }).join("&");
      }
      return encodeURIComponent(k) + "=" + encodeURIComponent(v);
    }).join("&");
  }

  // ─── Location helpers ────────────────────────────────────────────────────
  /**
   * Build a normalised location object from a URL string.
   *
   * @param {string} url - Absolute or relative URL.
   * @returns {{ pathname: string, search: string, hash: string, query: object }}
   */
  function parseLocation(url) {
    var hashIdx   = url.indexOf("#");
    var searchIdx = url.indexOf("?");
    var pathname, search, hash;
    if (hashIdx !== -1) {
      hash = url.slice(hashIdx);
      url  = url.slice(0, hashIdx);
    } else {
      hash = "";
    }
    if (searchIdx !== -1 && searchIdx < url.length) {
      search = url.slice(searchIdx);
      pathname = url.slice(0, searchIdx);
    } else {
      search   = "";
      pathname = url;
    }
    return { pathname: pathname || "/", search: search, hash: hash, query: parseQuery(search) };
  }

  // ─── Navigation context ──────────────────────────────────────────────────
  /**
   * Create a navigation context object (passed to guards and handlers).
   *
   * @param {Route}  route    - Matched route.
   * @param {object} params   - Extracted URL params.
   * @param {object} location - Parsed location.
   * @returns {object} Navigation context.
   */
  function makeContext(route, params, location) {
    return {
      path:       location.pathname,
      params:     params || {},
      query:      location.query || {},
      hash:       location.hash || "",
      name:       route ? route.name : null,
      controller: route ? route.controller : null,
      action:     route ? route.action : null,
      meta:       route ? route.meta : {},
      route:      route || null,
      fullPath:   location.pathname + location.search + location.hash
    };
  }

  // ─── Router class ────────────────────────────────────────────────────────
  /**
   * MajixMvcRouter — client-side router.
   *
   * @constructor
   * @param {object} opts
   * @param {string}   [opts.mode="hash"]        - "hash" or "history".
   * @param {string}   [opts.base=""]            - Base URL for history mode.
   * @param {array}    [opts.routes=[]]          - Initial route definitions.
   * @param {Function} [opts.notFound]           - Handler for unmatched routes.
   * @param {boolean}  [opts.caseSensitive=false]- Case-sensitive matching.
   * @param {boolean}  [opts.strict=false]       - Strict trailing-slash mode.
   * @param {boolean}  [opts.debug=false]        - Enable debug logging.
   */
  function Router(opts) {
    this._opts         = opts || {};
    this._mode         = (opts && opts.mode) || "hash";
    this._base         = (opts && opts.base) || "";
    this._routes       = [];
    this._namedRoutes  = {};
    this._guards       = [];
    this._afterHooks   = [];
    this._current      = null;
    this._previous     = null;
    this._started      = false;
    this._debug        = !!(opts && opts.debug);
    this._notFound     = (opts && opts.notFound) || null;
    this._onError      = (opts && opts.onError) || null;
    this._listeners    = [];
    if (opts && opts.routes) {
      var self = this;
      opts.routes.forEach(function(r) { self.add(r); });
    }
  }

  /**
   * Add a route definition.
   *
   * @param {object} definition - Route definition object.
   * @returns {Router} this
   */
  Router.prototype.add = function(definition) {
    var route = new Route(definition);
    this._routes.push(route);
    if (route.name) this._namedRoutes[route.name] = route;
    // Register child routes
    var self = this;
    route.children.forEach(function(child) {
      var childPath = route.path.replace(/\/$/, "") + "/" + child.path.replace(/^\//, "");
      child.path = childPath;
      child._regex = child._compile(childPath);
      self._routes.push(child);
      if (child.name) self._namedRoutes[child.name] = child;
    });
    return this;
  };

  /**
   * Remove a route by path or name.
   *
   * @param {string} pathOrName - Route path or name.
   * @returns {Router} this
   */
  Router.prototype.remove = function(pathOrName) {
    this._routes = this._routes.filter(function(r) {
      return r.path !== pathOrName && r.name !== pathOrName;
    });
    if (this._namedRoutes[pathOrName]) delete this._namedRoutes[pathOrName];
    return this;
  };

  /**
   * Register a global before-navigation guard.
   *
   * Guards are called in order before each navigation.
   * Each guard receives (to, from, next) and must call next() to proceed,
   * next(false) to abort, or next("/path") to redirect.
   *
   * @param {Function} fn - Guard function(to, from, next).
   * @returns {Router} this
   *
   * @example
   *   router.beforeEach(function(to, from, next) {
   *     if (!isLoggedIn() && to.path !== "/login") {
   *       next("/login");
   *     } else {
   *       next();
   *     }
   *   });
   */
  Router.prototype.beforeEach = function(fn) {
    this._guards.push(fn);
    return this;
  };

  /**
   * Register a global after-navigation hook.
   *
   * @param {Function} fn - Hook function(to, from).
   * @returns {Router} this
   */
  Router.prototype.afterEach = function(fn) {
    this._afterHooks.push(fn);
    return this;
  };

  /**
   * Match a pathname against all registered routes.
   *
   * @param {string} pathname - URL path to match.
   * @returns {{ route: Route, params: object }|null}
   */
  Router.prototype.match = function(pathname) {
    for (var i = 0; i < this._routes.length; i++) {
      var result = this._routes[i].match(pathname);
      if (result) return result;
    }
    return null;
  };

  /**
   * Get the current route URL fragment.
   *
   * @returns {string} Current pathname.
   */
  Router.prototype._getPath = function() {
    if (this._mode === "history") {
      var path = global.location ? global.location.pathname : "/";
      var base = this._base;
      if (base && path.indexOf(base) === 0) path = path.slice(base.length);
      return path || "/";
    }
    var hash = global.location ? global.location.hash : "";
    return hash.slice(1) || "/";
  };

  /**
   * Get the current full URL including search and hash.
   * @returns {string}
   */
  Router.prototype._getFullPath = function() {
    if (!global.location) return "/";
    if (this._mode === "history") {
      return global.location.pathname + global.location.search + global.location.hash;
    }
    return global.location.hash.slice(1) || "/";
  };

  /**
   * Internal navigation — runs guards then resolves.
   *
   * @param {string} to      - Target path.
   * @param {boolean} replace - Use replaceState instead of pushState.
   * @returns {Router} this
   */
  Router.prototype._navigate = function(to, replace) {
    var self = this;
    var loc  = parseLocation(to);
    var matched = this.match(loc.pathname);
    var toCtx  = makeContext(matched ? matched.route : null, matched ? matched.params : {}, loc);
    var fromCtx = this._current;
    var guards  = this._guards.slice();
    var guardIdx = 0;

    function runGuards() {
      if (guardIdx >= guards.length) {
        // All guards passed — commit navigation
        if (self._debug) console.log("[Router] navigating to:", to);
        if (global.history && self._mode === "history") {
          if (replace) {
            global.history.replaceState(null, "", self._base + to);
          } else {
            global.history.pushState(null, "", self._base + to);
          }
        } else if (self._mode === "hash") {
          if (replace) {
            global.location.replace("#" + to);
          } else {
            global.location.hash = to;
          }
        }
        self._previous = fromCtx;
        self._current  = toCtx;
        self._resolve(toCtx);
        self._afterHooks.forEach(function(h) {
          try { h(toCtx, fromCtx); } catch(e) {}
        });
        _emit("route:change", { to: toCtx, from: fromCtx });
        return;
      }
      var guard = guards[guardIdx++];
      try {
        guard(toCtx, fromCtx, function next(result) {
          if (result === false) {
            _emit("route:guard:deny", { to: toCtx, from: fromCtx, reason: "guard returned false" });
            return;
          }
          if (typeof result === "string") {
            self._navigate(result, replace);
            return;
          }
          runGuards();
        });
      } catch(e) {
        if (self._onError) self._onError(e);
        else if (self._debug) console.error("[Router] guard error:", e);
      }
    }
    runGuards();
    return this;
  };

  /**
   * Resolve a navigation context by invoking the matched handler.
   *
   * @param {object} ctx - Navigation context.
   */
  Router.prototype._resolve = function(ctx) {
    if (!ctx.route) {
      if (this._notFound) {
        try { this._notFound(ctx); } catch(e) {}
      } else if (this._debug) {
        console.warn("[Router] no route matched:", ctx.path);
      }
      return;
    }
    var route = ctx.route;
    if (isFunction(route.handler)) {
      try { route.handler(ctx); } catch(e) { if (this._onError) this._onError(e); }
      return;
    }
    // Look up controller + action via MajixMvc if available
    if (route.controller && global.MajixMvc) {
      var ctrl = global.MajixMvc.getController(route.controller);
      if (ctrl && isFunction(ctrl[route.action])) {
        try { ctrl[route.action](ctx); } catch(e) { if (this._onError) this._onError(e); }
      }
    }
  };

  /**
   * Navigate to a path (push).
   *
   * @param {string|object} to - Path string or { name, params, query } object.
   * @returns {Router} this
   *
   * @example
   *   router.push("/users/42");
   *   router.push({ name: "user.show", params: { id: 42 } });
   */
  Router.prototype.push = function(to) {
    if (isObject(to) && to.name) {
      var route = this._namedRoutes[to.name];
      if (!route) throw new Error("[Router] unknown route name: " + to.name);
      var path = route.generate(to.params || {});
      var qs   = stringifyQuery(to.query || {});
      return this._navigate(path + (qs ? "?" + qs : "") + (to.hash || ""), false);
    }
    return this._navigate(String(to), false);
  };

  /**
   * Navigate to a path (replace — no browser history entry).
   *
   * @param {string|object} to - Path string or { name, params, query } object.
   * @returns {Router} this
   */
  Router.prototype.replace = function(to) {
    if (isObject(to) && to.name) {
      var route = this._namedRoutes[to.name];
      if (!route) throw new Error("[Router] unknown route name: " + to.name);
      var path = route.generate(to.params || {});
      var qs   = stringifyQuery(to.query || {});
      return this._navigate(path + (qs ? "?" + qs : "") + (to.hash || ""), true);
    }
    return this._navigate(String(to), true);
  };

  /**
   * Go forward or backward N steps in the browser history.
   *
   * @param {number} n - Number of steps (positive = forward, negative = back).
   * @returns {Router} this
   */
  Router.prototype.go = function(n) {
    if (global.history) global.history.go(n);
    return this;
  };

  /**
   * Go back one step in browser history.
   * @returns {Router} this
   */
  Router.prototype.back = function() { return this.go(-1); };

  /**
   * Go forward one step in browser history.
   * @returns {Router} this
   */
  Router.prototype.forward = function() { return this.go(1); };

  /**
   * Resolve a path against the current location.
   *
   * @param {string} path - Relative or absolute path.
   * @returns {string} Resolved absolute path.
   */
  Router.prototype.resolve = function(path) {
    if (!path || path.charAt(0) === "/") return path;
    var current = this._getPath();
    var base = current.split("/").slice(0, -1).join("/");
    return base + "/" + path;
  };

  /**
   * Generate a URL for a named route.
   *
   * @param {string} name     - Route name.
   * @param {object} [params] - URL params.
   * @param {object} [query]  - Query string params.
   * @returns {string} Generated URL.
   */
  Router.prototype.url = function(name, params, query) {
    var route = this._namedRoutes[name];
    if (!route) throw new Error("[Router] unknown route name: " + name);
    var path = route.generate(params || {});
    var qs   = stringifyQuery(query || {});
    return path + (qs ? "?" + qs : "");
  };

  /**
   * Check if a path is currently active.
   *
   * @param {string}  path    - Path to check.
   * @param {boolean} [exact] - Require exact match.
   * @returns {boolean}
   */
  Router.prototype.isActive = function(path, exact) {
    var current = this._getPath();
    if (exact) return current === path;
    return current.indexOf(path) === 0;
  };

  /**
   * Get all registered routes.
   *
   * @returns {Route[]}
   */
  Router.prototype.routes = function() { return this._routes.slice(); };

  /**
   * Get the current navigation context.
   *
   * @returns {object|null}
   */
  Router.prototype.current = function() { return this._current; };

  /**
   * Get the previous navigation context.
   *
   * @returns {object|null}
   */
  Router.prototype.previous = function() { return this._previous; };

  /**
   * Start the router — attach event listeners and dispatch initial route.
   *
   * @returns {Router} this
   */
  Router.prototype.start = function() {
    if (this._started) return this;
    this._started = true;
    var self = this;

    if (this._mode === "history" && global.addEventListener) {
      var popHandler = function() { self._navigate(self._getFullPath(), true); };
      global.addEventListener("popstate", popHandler);
      this._listeners.push({ type: "popstate", fn: popHandler, target: global });
    } else if (global.addEventListener) {
      var hashHandler = function() { self._navigate(self._getPath(), true); };
      global.addEventListener("hashchange", hashHandler);
      this._listeners.push({ type: "hashchange", fn: hashHandler, target: global });
    }

    // Handle <a> clicks if in history mode
    if (this._mode === "history" && global.document && global.document.addEventListener) {
      var clickHandler = function(e) {
        var a = e.target && e.target.closest && e.target.closest("a[href]");
        if (!a) return;
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#" || href.indexOf("://") !== -1) return;
        if (a.hasAttribute("data-router-ignore")) return;
        e.preventDefault();
        self.push(href);
      };
      global.document.addEventListener("click", clickHandler);
      this._listeners.push({ type: "click", fn: clickHandler, target: global.document });
    }

    // Dispatch current path
    this._navigate(this._getFullPath(), true);
    _emit("router:start", this);
    return this;
  };

  /**
   * Stop the router — remove all event listeners.
   *
   * @returns {Router} this
   */
  Router.prototype.stop = function() {
    if (!this._started) return this;
    this._started = false;
    this._listeners.forEach(function(l) {
      l.target.removeEventListener(l.type, l.fn);
    });
    this._listeners = [];
    _emit("router:stop", this);
    return this;
  };

  /**
   * Define a group of routes sharing a common prefix.
   *
   * @param {string} prefix  - Shared path prefix.
   * @param {array}  routes  - Child route definitions.
   * @param {object} [meta]  - Shared meta for all children.
   * @returns {Router} this
   */
  Router.prototype.group = function(prefix, routes, meta) {
    var self = this;
    routes.forEach(function(r) {
      var fullPath = prefix.replace(/\/$/, "") + "/" + String(r.path || "").replace(/^\//, "");
      self.add(extend({}, r, { path: fullPath, meta: extend({}, meta || {}, r.meta || {}) }));
    });
    return this;
  };

  /**
   * Refresh the current route (re-dispatch without navigation).
   *
   * @returns {Router} this
   */
  Router.prototype.refresh = function() {
    var path = this._getFullPath();
    this._navigate(path, true);
    return this;
  };

  /**
   * Subscribe to router events.
   *
   * Events: "route:change", "route:guard:deny", "router:start", "router:stop"
   *
   * @param {string}   event - Event name.
   * @param {Function} fn    - Handler function.
   * @returns {Router} this
   */
  Router.prototype.on  = function(e, fn) { _on(e, fn); return this; };
  Router.prototype.off = function(e, fn) { _off(e, fn); return this; };

  /**
   * Serialise router state for debugging.
   *
   * @returns {object}
   */
  Router.prototype.debug = function() {
    return {
      mode:    this._mode,
      started: this._started,
      routes:  this._routes.map(function(r) { return r.toJSON(); }),
      current: this._current,
      previous:this._previous
    };
  };

  // ─── Navigation history tracker ─────────────────────────────────────────
  /**
   * Attach an in-memory history tracker to the router.
   *
   * The tracker records every navigation and provides undo/redo.
   *
   * @param {Router} router - The router instance to attach to.
   * @returns {object} HistoryTracker API.
   */
  function createHistoryTracker(router) {
    var _stack = [];
    var _idx   = -1;
    var _limit = 100;

    router.on("route:change", function(ev) {
      _stack = _stack.slice(0, _idx + 1);
      _stack.push({ context: ev.to, timestamp: Date.now() });
      if (_stack.length > _limit) _stack.shift();
      _idx = _stack.length - 1;
    });

    return {
      /** Return all recorded entries. @returns {array} */
      entries: function() { return _stack.slice(); },
      /** Return the current entry. @returns {object|null} */
      current: function() { return _stack[_idx] || null; },
      /** Number of entries. @type {number} */
      get length() { return _stack.length; },
      /** True if we can go back. @type {boolean} */
      get canBack() { return _idx > 0; },
      /** True if we can go forward. @type {boolean} */
      get canForward() { return _idx < _stack.length - 1; },
      /** Clear the history. */
      clear: function() { _stack = []; _idx = -1; },
      /** Set max history entries. @param {number} n */
      setLimit: function(n) { _limit = n; }
    };
  }

  // ─── Breadcrumb builder ──────────────────────────────────────────────────
  /**
   * Build an array of breadcrumb objects from the current navigation context.
   *
   * @param {object} ctx   - Current navigation context.
   * @param {array}  routes- All registered routes.
   * @returns {array} Array of { path, label, active } breadcrumb objects.
   */
  function buildBreadcrumbs(ctx, routes) {
    if (!ctx || !ctx.path) return [];
    var parts = ctx.path.split("/").filter(Boolean);
    var crumbs = [{ path: "/", label: "Home", active: false }];
    var acc = "";
    parts.forEach(function(part, i) {
      acc += "/" + part;
      var matched = null;
      for (var j = 0; j < routes.length; j++) {
        if (routes[j].match(acc)) { matched = routes[j]; break; }
      }
      crumbs.push({
        path:   acc,
        label:  matched && matched.meta && matched.meta.breadcrumb ? matched.meta.breadcrumb : part,
        active: i === parts.length - 1
      });
    });
    return crumbs;
  }

  // ─── Scroll behaviour plugin ─────────────────────────────────────────────
  /**
   * Attach a scroll-restoration plugin to the router.
   * Scrolls to top (or saved position) on each navigation.
   *
   * @param {Router}   router  - Router instance.
   * @param {Function} [scrollFn] - Custom scroll function(x, y).
   */
  function useScrollBehavior(router, scrollFn) {
    var _positions = {};
    var _scroll = scrollFn || function(x, y) {
      if (global.scrollTo) global.scrollTo(x, y);
    };
    router.on("route:change", function(ev) {
      // Save position before leaving
      if (ev.from && ev.from.path && global.scrollY !== undefined) {
        _positions[ev.from.path] = { x: global.scrollX, y: global.scrollY };
      }
      // Restore or scroll to top
      var saved = _positions[ev.to.path];
      if (saved) {
        setTimeout(function() { _scroll(saved.x, saved.y); }, 0);
      } else {
        setTimeout(function() { _scroll(0, 0); }, 0);
      }
    });
  }

  // ─── Link helper ─────────────────────────────────────────────────────────
  /**
   * Attach router-aware click handling to all matching anchor elements.
   * Elements with `data-router-link` will use pushState instead of page reload.
   *
   * @param {Router} router - Router instance.
   * @param {string} [selector="[data-router-link]"] - CSS selector.
   */
  function bindLinks(router, selector) {
    if (!global.document) return;
    selector = selector || "[data-router-link]";
    global.document.addEventListener("click", function(e) {
      var a = e.target && e.target.closest && e.target.closest(selector);
      if (!a) return;
      e.preventDefault();
      var href = a.getAttribute("href") || a.dataset.routerLink;
      if (href) router.push(href);
    });
  }

  // ─── Lazy route loading ──────────────────────────────────────────────────
  /**
   * Create a route definition that loads its handler lazily.
   *
   * @param {string}   path   - Route path.
   * @param {Function} loader - Function returning a Promise that resolves to a handler.
   * @param {object}   [opts] - Extra route options.
   * @returns {object} Route definition with lazy handler.
   *
   * @example
   *   router.add(lazyRoute("/admin", function() {
   *     return import("/admin/index.js").then(function(m) { return m.default; });
   *   }));
   */
  function lazyRoute(path, loader, opts) {
    var _loaded = false;
    var _handler = null;
    return Object.assign({ path: path }, opts || {}, {
      handler: function(ctx) {
        if (_loaded && _handler) { _handler(ctx); return; }
        Promise.resolve(loader()).then(function(handler) {
          _loaded  = true;
          _handler = handler;
          handler(ctx);
        }).catch(function(e) { console.error("[Router] lazy load error:", e); });
      }
    });
  }

  // ─── Progress bar integration ────────────────────────────────────────────
  /**
   * Attach a navigation progress bar to the router.
   * Shows/hides an element during navigation.
   *
   * @param {Router}      router - Router instance.
   * @param {HTMLElement} barEl  - Progress bar element.
   */
  function useProgressBar(router, barEl) {
    if (!barEl) return;
    var _timer = null;
    router.beforeEach(function(to, from, next) {
      barEl.style.width = "0%";
      barEl.style.display = "block";
      barEl.style.opacity = "1";
      var w = 0;
      _timer = setInterval(function() {
        w = Math.min(w + Math.random() * 15, 80);
        barEl.style.width = w + "%";
      }, 100);
      next();
    });
    router.afterEach(function() {
      clearInterval(_timer);
      barEl.style.width = "100%";
      setTimeout(function() {
        barEl.style.opacity = "0";
        setTimeout(function() { barEl.style.display = "none"; barEl.style.width = "0%"; barEl.style.opacity = "1"; }, 300);
      }, 200);
    });
  }

  // ─── Route transition ────────────────────────────────────────────────────
  /**
   * Animate the view container on route change.
   *
   * @param {Router}      router       - Router instance.
   * @param {HTMLElement} containerEl  - View container element.
   * @param {string}      [className]  - Transition CSS class.
   */
  function useTransition(router, containerEl, className) {
    if (!containerEl) return;
    className = className || "mvc-animate-fade-in";
    router.on("route:change", function() {
      containerEl.classList.remove(className);
      void containerEl.offsetWidth; // force reflow
      containerEl.classList.add(className);
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  var MajixMvcRouter = {
    version:  VERSION,
    /**
     * Create a new Router instance.
     *
     * @param {object} opts - Router options.
     * @returns {Router}
     */
    create: function(opts) {
      return new Router(opts || {});
    },
    Route:               Route,
    parseQuery:          parseQuery,
    stringifyQuery:      stringifyQuery,
    parseLocation:       parseLocation,
    makeContext:         makeContext,
    lazyRoute:           lazyRoute,
    buildBreadcrumbs:    buildBreadcrumbs,
    createHistoryTracker:createHistoryTracker,
    bindLinks:           bindLinks,
    useScrollBehavior:   useScrollBehavior,
    useProgressBar:      useProgressBar,
    useTransition:       useTransition,
    on:  function(e, fn) { _on(e, fn); return MajixMvcRouter; },
    off: function(e, fn) { _off(e, fn); return MajixMvcRouter; }
  };

  global.MajixMvcRouter = MajixMvcRouter;

}(typeof window !== "undefined" ? window : this));
