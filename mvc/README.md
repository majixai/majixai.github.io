# MajixMvc — Model-View-Controller Framework

`mvc/` is a self-contained, browser-native MVC framework for the MajixAI platform.  
It follows the same IIFE + `Majix*`-namespace conventions used across this repository.

## Overview

MajixMvc provides seven cooperating modules:

| File | Global | Purpose |
|------|--------|---------|
| `mvc-core.js` | `MajixMvc` | Core App + EventBus + Model/View/Controller base classes |
| `mvc-model.js` | `MajixMvcModel` | Enhanced ORM — schema, relationships, query builder, adapters |
| `mvc-view.js` | `MajixMvcView` | Template engine, 40+ directives, DOM diffing, components |
| `mvc-controller.js` | `MajixMvcController` | Middleware pipeline, CRUD scaffolding, auth filters |
| `mvc-router.js` | `MajixMvcRouter` | Client-side router — hash/history, guards, named routes |
| `mvc-store.js` | `MajixMvcStore` | Flux state store — modules, undo/redo, persistence |
| `mvc-validator.js` | `MajixMvcValidator` | 80+ built-in rules, custom + async validation, i18n |
| `mvc-form.js` | `MajixMvcForm` | 50+ field types, auto-binding, validation, file upload |

---

## Installation

No build step required — load via `<script>` tags (core first, then modules as needed):

```html
<!-- Core framework -->
<script src="/mvc/mvc-core.js"></script>

<!-- Optional modules (load only what you need) -->
<script src="/mvc/mvc-validator.js"></script>
<script src="/mvc/mvc-model.js"></script>
<script src="/mvc/mvc-view.js"></script>
<script src="/mvc/mvc-form.js"></script>
<script src="/mvc/mvc-router.js"></script>
<script src="/mvc/mvc-store.js"></script>
<script src="/mvc/mvc-controller.js"></script>
```

---

## Quick Start

### 1. Minimal App (core only)

```html
<script>
  window.MVC_CONFIG = { namespace: 'my-app', debug: true };
</script>
<script src="/mvc/mvc-core.js"></script>
<script>
  // Define a Model
  var Todo = MajixMvc.defineModel('Todo', {
    fields: {
      id:        { type: 'string', default: null },
      text:      { type: 'string', required: true },
      done:      { type: 'boolean', default: false },
      createdAt: { type: 'date',   default: function() { return new Date(); } }
    }
  });

  // Define a View
  var TodoView = MajixMvc.defineView('TodoView', {
    template: '<li class="{{done ? \'done\' : \'\'}}">{{text}}</li>',
    events: {
      'click li': 'toggleDone'
    }
  });

  // Define a Controller
  var TodoController = MajixMvc.defineController('TodoController', {
    model: 'Todo',
    view:  'TodoView',
    actions: {
      addTodo: function(text) {
        this.model.create({ text: text });
        this.view.render();
      },
      toggleDone: function(id) {
        var todo = this.model.find(id);
        if (todo) { todo.set('done', !todo.get('done')); }
        this.view.render();
      }
    }
  });

  // Bootstrap the app
  var app = MajixMvc.createApp({
    models:      { Todo: Todo },
    views:       { TodoView: TodoView },
    controllers: { TodoController: TodoController }
  });
  app.mount('#app');
  app.start();
</script>
```

### 2. Full App with Router

```html
<script src="/mvc/mvc-core.js"></script>
<script src="/mvc/mvc-router.js"></script>
<script>
  var router = MajixMvcRouter.create({
    mode: 'hash',
    routes: [
      { path: '/',          controller: 'HomeController',  action: 'index' },
      { path: '/todos',     controller: 'TodoController',  action: 'index' },
      { path: '/todos/:id', controller: 'TodoController',  action: 'show'  },
      { path: '/about',     controller: 'AboutController', action: 'index' }
    ]
  });

  router.beforeEach(function(to, from, next) {
    if (to.path !== '/login' && !isAuthenticated()) {
      next('/login');
    } else {
      next();
    }
  });

  router.start();
</script>
```

### 3. State Store

```html
<script src="/mvc/mvc-core.js"></script>
<script src="/mvc/mvc-store.js"></script>
<script>
  var store = MajixMvcStore.create({
    state: {
      todos: [],
      filter: 'all'
    },
    mutations: {
      ADD_TODO: function(state, todo) {
        state.todos.push(todo);
      },
      TOGGLE_TODO: function(state, id) {
        var todo = state.todos.find(function(t) { return t.id === id; });
        if (todo) { todo.done = !todo.done; }
      },
      SET_FILTER: function(state, filter) {
        state.filter = filter;
      }
    },
    actions: {
      addTodo: function(ctx, text) {
        ctx.commit('ADD_TODO', { id: Date.now(), text: text, done: false });
      }
    },
    getters: {
      filteredTodos: function(state) {
        if (state.filter === 'active') {
          return state.todos.filter(function(t) { return !t.done; });
        }
        if (state.filter === 'done') {
          return state.todos.filter(function(t) { return t.done; });
        }
        return state.todos;
      },
      todoCount: function(state) {
        return state.todos.length;
      },
      doneCount: function(state) {
        return state.todos.filter(function(t) { return t.done; }).length;
      }
    }
  });

  // Subscribe to state changes
  store.subscribe(function(mutation, state) {
    console.log('[store] mutation:', mutation.type, state);
  });

  store.dispatch('addTodo', 'Buy milk');
  console.log(store.getters.filteredTodos); // [{ id: ..., text: 'Buy milk', done: false }]
</script>
```

### 4. Form with Validation

```html
<script src="/mvc/mvc-core.js"></script>
<script src="/mvc/mvc-validator.js"></script>
<script src="/mvc/mvc-form.js"></script>
<script>
  var form = MajixMvcForm.create('#signup-form', {
    fields: {
      name:     { type: 'text',     label: 'Full Name',  rules: 'required|min_length:2|max_length:100' },
      email:    { type: 'email',    label: 'Email',      rules: 'required|email' },
      password: { type: 'password', label: 'Password',   rules: 'required|min_length:8|has_upper|has_digit' },
      confirm:  { type: 'password', label: 'Confirm',    rules: 'required|same:password' },
      age:      { type: 'number',   label: 'Age',        rules: 'required|integer|between:18,120' }
    },
    onSubmit: function(values) {
      console.log('Form values:', values);
      // POST to your API...
    },
    onError: function(errors) {
      console.log('Validation errors:', errors);
    }
  });

  form.bind();  // Attaches to the DOM
</script>
```

---

## Module Reference

### MajixMvc (mvc-core.js)

| Method | Returns | Description |
|--------|---------|-------------|
| `MajixMvc.init(config?)` | `MajixMvc` | Initialise framework with optional config override |
| `MajixMvc.defineModel(name, def)` | `ModelClass` | Register a model class |
| `MajixMvc.defineView(name, def)` | `ViewClass` | Register a view class |
| `MajixMvc.defineController(name, def)` | `ControllerClass` | Register a controller class |
| `MajixMvc.createApp(opts)` | `App` | Create and configure an application instance |
| `MajixMvc.use(plugin, opts?)` | `MajixMvc` | Install a plugin |
| `MajixMvc.on(event, fn)` | `MajixMvc` | Subscribe to a framework event |
| `MajixMvc.off(event, fn)` | `MajixMvc` | Unsubscribe from a framework event |
| `MajixMvc.emit(event, ...args)` | `MajixMvc` | Emit a framework event |
| `MajixMvc.version` | `string` | Semantic version string |

### MajixMvcModel (mvc-model.js)

| Method | Returns | Description |
|--------|---------|-------------|
| `Model.create(attrs)` | `instance` | Create and persist a new record |
| `Model.find(id)` | `instance\|null` | Find by primary key |
| `Model.findAll()` | `Collection` | Return all records |
| `Model.where(conditions)` | `QueryBuilder` | Start a filtered query |
| `Model.orderBy(field, dir?)` | `QueryBuilder` | Sort records |
| `Model.limit(n)` | `QueryBuilder` | Limit result count |
| `Model.offset(n)` | `QueryBuilder` | Skip first N records |
| `Model.first()` | `instance\|null` | Return first matching record |
| `Model.last()` | `instance\|null` | Return last matching record |
| `Model.count()` | `number` | Count matching records |
| `model.get(field)` | `any` | Get a field value |
| `model.set(field, val)` | `model` | Set a field value |
| `model.save()` | `model` | Persist changes |
| `model.delete()` | `boolean` | Remove the record |
| `model.toJSON()` | `object` | Serialize to plain object |
| `model.isDirty(field?)` | `boolean` | Check if unsaved changes exist |
| `model.changes()` | `object` | Map of changed fields |
| `model.revert()` | `model` | Undo unsaved changes |

### MajixMvcValidator (mvc-validator.js)

Built-in rules (pipe-separated string syntax): `required`, `optional`, `nullable`,
`email`, `url`, `ip`, `ipv4`, `ipv6`, `mac_address`, `uuid`, `alpha`, `alpha_num`,
`alpha_dash`, `numeric`, `integer`, `float`, `positive`, `negative`, `min`, `max`,
`between`, `min_length`, `max_length`, `exact_length`, `in`, `not_in`, `starts_with`,
`ends_with`, `contains`, `regex`, `same`, `different`, `confirmed`, `date`, `before`,
`after`, `date_format`, `boolean`, `array`, `object`, `json`, `base64`, `hex`, `ascii`,
`credit_card`, `phone`, `zip`, `digits`, `digits_between`, `has_upper`, `has_lower`,
`has_digit`, `has_special`, `strong_password`, `no_spaces`, `slug`, `username`,
`luhn`, `ean13`, `isbn`, `iban`, `bic`, `ssn`, `tax_id`, `latitude`, `longitude`,
`color_hex`, `color_rgb`, `mime_type`, `file_extension`, `max_file_size`, `dimensions`,
`multiple_of`, `even`, `odd`, `prime`, `palindrome`, and more.

---

## Events

All modules emit standard lifecycle events. Subscribe with `.on(event, fn)`:

| Event | Module | Payload |
|-------|--------|---------|
| `model:created` | core | `{ model, instance }` |
| `model:updated` | core | `{ model, instance, changes }` |
| `model:deleted` | core | `{ model, id }` |
| `view:rendered` | core | `{ view, el }` |
| `view:updated` | core | `{ view, el }` |
| `controller:action` | core | `{ controller, action, args }` |
| `route:change` | router | `{ to, from }` |
| `route:guard:deny` | router | `{ to, from, reason }` |
| `store:mutation` | store | `{ type, payload, state }` |
| `store:action` | store | `{ type, payload }` |
| `form:submit` | form | `{ values, form }` |
| `form:error` | form | `{ errors, form }` |
| `form:change` | form | `{ field, value, form }` |
| `validator:pass` | validator | `{ field, value, rule }` |
| `validator:fail` | validator | `{ field, value, rule, message }` |

---

## Configuration

Global configuration via `window.MVC_CONFIG` before loading `mvc-core.js`:

```js
window.MVC_CONFIG = {
  namespace:    'my-app',      // Used as localStorage key prefix
  debug:         false,         // Enable console debug output
  autoDispatch:  true,          // Wire into MajixActions if loaded
  storageKey:   'majixMvc',    // localStorage key for persisted state
  historyLimit:  50,            // Max undo history entries
  plugins:      [],             // Auto-install plugins on init
};
```

---

## Directory Layout

```
mvc/
├── README.md              This file
├── mvc.css                Default styles for MVC-driven UIs
├── index.html             Interactive demo application
├── mvc-core.js            Core framework (required)
├── mvc-model.js           ORM model system (optional)
├── mvc-view.js            View / template engine (optional)
├── mvc-controller.js      Controller / middleware system (optional)
├── mvc-router.js          Client-side router (optional)
├── mvc-store.js           Flux state store (optional)
├── mvc-validator.js       Validation library (optional)
└── mvc-form.js            Form handling (optional)
```

---

## License

Part of the MajixAI platform — educational and research use.
