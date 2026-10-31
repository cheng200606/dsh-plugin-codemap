# Cordis API reference (DSH-bundled `@deepseek-ai/cordis`)

Code-grounded reference for writing a standalone Cordis plugin package that installs into a DSH profile.

**Primary source (only file):** `D:\ProfessionalSoftware\Agent\dsh\resources\app.asar\dsh\node_modules\@deepseek-ai\cordis\lib\index.js` — 1829 lines, bundled ESM. Cited below as `cordis/lib/index.js:NNN`.
**Package:** `D:\ProfessionalSoftware\Agent\dsh\resources\app.asar\dsh\node_modules\@deepseek-ai\cordis\package.json` — `@deepseek-ai/cordis` 4.0.5, `"type": "module"`, `main: lib/index.js`, `exports: { ".": "./lib/index.js" }`, deps `@standard-schema/spec` + `@deepseek-ai/cosmokit ~1.8.6`, optional peers `cordis-plugin-include ~1.0.10`, `cordis-plugin-loader ~1.0.6`.
**No `lib/types/*.d.ts` is shipped inside the asar** — types are inlined as JSDoc in `lib/index.js`.

Public exports (`cordis/lib/index.js:1829`):
`Context, CordisError, DisposableList, EventsService, Fiber, Inject, Logger, LoggerService, RegistryService, Service, ValidationError, buildOuterStack, c16, c256, composeError, createCallable, defaultFormatters, getPropertyDescriptor, getTraceable, isBailed, isConstructor, isObject, joinPrototype, resolveConfig, symbols, withProps`.

---

## 1. The `Service` base class

- Definition `var Service = class Service {` — `cordis/lib/index.js:1742` (body ends `:1827`).
- Static symbol keys (`:1745-1757`): `init`, `check`, `config`, `invoke`, `extend`, `tracker`, `resolveConfig` — all `Symbol.for("cordis.*")` (symbol table `:35-53`).
- **Constructor, verbatim** (`cordis/lib/index.js:1770-1784`):

```js
constructor(ctx, name) {
    this.ctx = ctx;
    name ??= this.constructor["provide"];
    let self = this;
    const tracker = {
        associate: name,
        property: "ctx"
    };
    if (self[symbols.invoke]) self = createCallable(name, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
    self.ctx = ctx;
    self.name = name;
    defineProperty(self, symbols.tracker, tracker);
    self.ctx.reflect.provide(name, self, this[symbols.check]);
    return self;
}
```

Consequences:

- `super(ctx, name)` **registers the service immediately** through `ctx.reflect.provide(name, self, this[Service.check])` (`:1782`). It does **not** call `ctx.set(...)`.
- `name` defaults to `this.constructor["provide"]` — a **static `provide` field** (`:1772`), *not* the class name and *not* a static `name` field. `Service` itself declares no `provide`, so without it you must pass the name explicitly.
- `this.ctx = ctx`, `this.name = name` (`:1779-1780`).
- The service is auto-unregistered when the owning fiber unloads (doc `:1760-1769`; disposer `:817-822`).
- If the instance implements `[Service.invoke]`, the registered value is a **callable proxy** (`:1778`) — that is how `ctx.logger` is callable.
- `Service` does **not** require the class to be a module default export; that is a loader/registry convention (§2), not a `Service` rule. But to be loaded, the module's default export must *be* the class, or the module must expose a named `apply` export.
- **Static `inject` is not declared on `Service`** — it is a plain static-field convention read by the registry: `Inject.resolve(plugin.inject)` (`:1635`). The `Inject` class decorator writes into it (`:1460-1481`).
- **Static `Config` is not declared on `Service`** — it is read off the plugin object by the registry: `Config: plugin.Config` (`:1631`) and consumed by `resolveConfig(runtime, config)` (`:956-962`) through **standard-schema**.
- Other members: `[symbols.filter](ctx)` (`:1785-1787`, isolation-scope check), `[symbols.extend](props)` (`:1788-1793`), `[symbols.resolveConfig](base, head)` (`:1805-1816`, uses `this["Config"]?.merge` when present, else `Object.assign({}, ...configs)`), `static [Symbol.hasInstance]` (`:1817-1826`).

Instance hooks a subclass may implement:

| hook | meaning |
|---|---|
| `[Service.init]()` | the class-plugin "init" body; **its return value is the plugin's effect** (see §2) |
| `[Service.check]()` | availability predicate passed to `ctx.provide` |
| `[Service.invoke](name)` | makes the service callable (`ctx.logger()`) |
| `[Service.config]` | phantom intercept-config type key |

Real shipped example — `D:\ProfessionalSoftware\Agent\dsh\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-working-directory\lib\index.js:12-70`:

```js
var WorkingDirectoryService = class extends Service {
  static inject = ["fs", "sessionProjections", "systemPrompt"];
  static Config = z.object({ defaultDirectory: z.string() });
  constructor(ctx, config) {
    super(ctx, "workingDirectory");
    ...
    ctx.effect(() => async () => { /* cleanup */ });        // :66-69
  }
};
export { WorkingDirectoryService, WorkingDirectoryService as default };   // :167
```

---

## 2. How a plugin module is loaded and invoked

### 2a. Module → plugin object

`D:\...\app.asar\dsh\node_modules\@deepseek-ai\cordis-plugin-loader\lib\index.js:667-672`:

```js
unwrapExports(exports) {
    if (isNullable(exports)) return exports;
    exports = exports.default ?? exports;
    if (!exports.__esModule) return exports;
    return exports.default ?? exports;
}
```

`Entry._init` (`cordis-plugin-loader/lib/index.js:450-465`): import module → `unwrapExports(namespace)` → `this.ctx.registry.plugin(plugin, this.options.config, this.getOuterStack)`.

⇒ **A default export wins**; a module with only named exports is used as the whole namespace object.

### 2b. Plugin object → callback

`cordis/lib/index.js:1533-1538`:

```js
resolve(plugin) {
    try {
        if (typeof plugin === "function") return plugin;
        if (isApplicable(plugin)) return plugin.apply;
    } catch {}
}
```

`isApplicable` = "object with a function `apply`" (`:1446-1448`).

Supported export shapes:

1. `export default function` / arrow function → callback = that function.
2. `export default class MyService` → callback = the class (`typeof === "function"`).
3. `export default { apply(ctx, config) {...} }` → callback = `plugin.apply`.
4. module with **named export `apply`** and no default export → namespace object is the plugin → callback = `namespace.apply`.

Companion exports consumed **only** in shapes 3 and 4 (object/namespace plugins): `Config` (`:1631`), `inject` (`:1635`), `name` (`:1625`). In shapes 1/2 they must be **statics on the default-exported class/function**. If a module has a default export, its named exports `inject`/`Config`/`name` are ignored.

### 2c. Registration

`cordis/lib/index.js:1619-1641`:

```js
plugin(plugin, config, getOuterStack = buildOuterStack()) {
    const callback = this.resolve(plugin);
    if (!callback) throw new Error("invalid plugin, expect function or object with an \"apply\" method, received " + typeof plugin);
    this.ctx.fiber.assertActive();
    let runtime = this._internal.get(callback);
    if (!runtime) {
        let name = plugin.name;
        if (name === "apply") name = void 0;
        runtime = { name, callback, fibers: new DisposableList(), Config: plugin.Config };
        this._internal.set(callback, runtime);
    }
    const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
    ...
}
```

- runtime `name` = `plugin.name` (class name / exported `name`), except the literal `"apply"`, which is discarded (`:1625-1626`).
- `Config` = `plugin.Config` (`:1631`), `inject` = `plugin.inject` (`:1635`).

### 2d. Invocation

`cordis/lib/index.js:1066-1072` (inside `Fiber`'s runner):

```js
execute: function() {
    if (isConstructor(runtime.callback)) {
        const instance = new runtime.callback(this.ctx, this.config);
        for (const hook of instance?.[symbols.initHooks] ?? []) hook();
        return instance?.[symbols.init]?.();
    } else return runtime.callback(this.ctx, this.config);
}
```

- **Class plugin**: `new Class(ctx, config)`. The constructor's own return value is **discarded**; the plugin's effect is the return value of the instance's `[Service.init]()`. Use `async *[Service.init]() { yield disposer }` or `async [Service.init]() { return disposer }` (a returned function is collected as a disposer).
- **Function plugin**: called as `callback(ctx, config)`; its return value **is** the effect.
- ⚠ `isConstructor` (`:57-62`) = "has `.prototype` and is not a generator function". An **arrow function has no `.prototype`** → called normally. A **`function` declaration has `.prototype`** → treated as a constructor and invoked with `new`, so a returned disposer is lost. Use an arrow function for function-style plugins that return a disposer.

### 2e. How `config` is produced

- The loader passes the YAML entry's `config:` value straight through (`cordis-plugin-loader/lib/index.js:450-465`).
- `Fiber._resolveConfig` (`cordis/lib/index.js:1345-1348`): `config = this.context.waterfall(this, "internal/config", config, () => config); return this.runtime ? resolveConfig(this.runtime, config) : config;` — the `internal/config` waterfall lets interceptors rewrite config; `this.config = this._resolveConfig(this._config)` on reload (`:1355`).
- `resolveConfig(runtime, config)` (`:956-962`):

```js
function resolveConfig(runtime, config) {
	if (!runtime.Config) return config;
	const result = runtime.Config["~standard"].validate(config);
	if ("then" in result) throw new TypeError("Async config validation is not supported");
	if (result.issues) throw new ValidationError(result.issues);
	else return result.value;
}
```

⇒ **standard-schema** is the contract (`runtime.Config["~standard"].validate(config)`); schemastery / zod both work. Defaults come from the schema. Without `Config`, the raw config (possibly `undefined`) is passed through unchanged. `ValidationError extends TypeError` (`:933-947`), message `invalid config:\n  - <issue> (at <path>)`.
⇒ A zero-dependency package can still ship a schema by hand: any object with a `~standard.validate(value)` method returning `{ value }` or `{ issues }`.

### 2f. `ctx.inject([...])` vs the `inject` export

- **`inject` export / static = a declaration.** "This plugin may not start until these services exist." Read at `:1635` → `Inject.resolve(plugin.inject)` → the fiber's `inject` map. The fiber stays in state 1 (loading) until every injected service is provided; it is refreshed by `ReflectService.notify` (`:832-852`). Injected names become readable as `ctx.<name>` (otherwise the proxy get trap throws `cannot get property "x" without inject`, `:676`), and each injected name with a non-null config gets that intercept config copied into the plugin's child context (`:1055-1061`).
  `Inject.resolve` (`:1491-1499`) accepts: an **array** of names → `{name: null}`; a plain object `{name: config}` → `{name: config ?? null}`; a prototype-chained object (the `@Inject` class decorator's shape, `:1462-1467`) → inherited entries merged.
- **`ctx.inject(inject, callback)` = a runtime API** that starts a *new* plugin fiber now (`:1600-1606`):

```js
inject(inject, callback) {
    return this.plugin({ inject, apply: callback, name: callback.name });
}
```

  The callback receives `(ctx, config)` with `config === undefined` (no config is passed). `ctx.inject` requires both arguments (the callback is dereferenced for `.name`).
- `Inject` decorator (`:1460-1481`): class decorator merges a dependency map into the static `inject`; method decorator delays the call until the services exist (it uses `this.ctx.inject(inject, ...)` at `:1474`).

### 2g. Loader wiring (DSH profile install)

- Entry `name:` = the **import specifier**; relative paths resolve against `ctx.baseUrl` (`cordis-plugin-loader/lib/index.js:214-228`).
- Entry `config:` = the plugin config (`:450-465`).
- Entry `inject:` / `isolate:` / `intercept:` are loader-level options (`:510-582`, `:628-643`) and are merged with the plugin's own declaration.

---

## 3. Registering a service **without** importing `@deepseek-ai/cordis`

**Yes — `ctx.provide(name, value, check)` exists on the context**, as a mixin of `ReflectService.provide`.

Mixin wiring — `ReflectService` constructor (`cordis/lib/index.js:730-754`):

```js
this.mixin("reflect", ["get", "set", "provide", "accessor", "mixin"]);   // :736-742
this.mixin("fiber", ["runtime", "effect"]);                              // :743
this.mixin("registry", ["inject", "plugin"]);                            // :744
this.mixin("events", ["on", "once", "parallel", "emit", "serial", "bail", "waterfall"]);  // :745-753
```

⇒ Available directly on `ctx`: `ctx.get`, `ctx.set`, `ctx.provide`, `ctx.accessor`, `ctx.mixin`, `ctx.fiber.runtime`, `ctx.fiber.effect`, `ctx.inject` (= `ctx.registry.inject`), `ctx.plugin` (= `ctx.registry.plugin`), `ctx.on`, `ctx.once`, `ctx.parallel`, `ctx.emit`, `ctx.serial`, `ctx.bail`, `ctx.waterfall`. Full service objects are also reachable as `ctx.reflect`, `ctx.events`, `ctx.registry`, `ctx.logger`.

`ctx.provide` implementation (`cordis/lib/index.js:800-824`):

```js
provide(name, value, check) {
    return this.ctx.fiber.effect(() => {
        if (!this.props[name]) this.props[name] ??= { type: "service" };
        else if (this.props[name].type !== "service") throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
        this.props[name] = { type: "service" };
        this.ctx.root[symbols.isolate][name] ??= Symbol(name);
        const key = this.ctx[symbols.isolate][name];
        const impl = { name, value, fiber: this.ctx.fiber, check };
        if (this.store[key]) throw new Error(`service "${name}" has been registered at <${this.store[key].fiber.name}>`);
        this.store[key] = impl;
        this.ctx.fiber.store[name] = impl;
        if (this.ctx.fiber.state === 2) this.notify([name]);
        return async () => {
            delete this.store[key];
            const fibers = this.notify([name]);
            await Promise.allSettled(fibers.map((fiber) => fiber.await()));
            delete this.ctx.fiber.store[name];
        };
    }, `ctx.provide(${JSON.stringify(name)})`);
}
```

- Registration is a **fiber effect** → undone automatically when the owning fiber unloads.
- Duplicate registration throws `service "<name>" has been registered at <<fiber>>` (`:813`).
- `ctx.reflect.provide(...)` is the identical method.

**`ctx.set(name, value)` is NOT registration** (`:782-789`):

```js
set(name, value, error) {
    const key = this.ctx[symbols.isolate][name];
    const impl = this.store[key];
    if (!impl) throw new Error(`cannot set property "${name}" without provide`);
    if (impl.fiber !== this.ctx.fiber) throw new Error(`cannot set property "${name}" in multiple fibers`);
    impl.value = value;
    return true;
}
```

It only overwrites the value of an already-provided service (hot-swap), owned by the same fiber.

Reading a service **without** declaring an inject dependency: `ctx.get(name, strict = true)` (`:763-765`) → returns the value only when the providing fiber is active (state 2), else `undefined` (`:766-772`).

`ctx[name]` property access — proxy get trap (`:673-699`):

- name is neither an own property nor a declared service/accessor → `cannot get property "<prop>" without inject` (`:676`);
- name is in `fiber.inject` but no live implementation → `cannot get required service "<prop>" in inactive context` (`:688`).

`ctx[name] = value` — proxy set trap (`:700-719`): the property must already be declared (service or accessor), else `cannot set property "<prop>" without provide` (`:702`).

Also available: `ctx.accessor(name, {get, set})` (`:860-869`, computed context property) and `ctx.mixin(source, mixins)` (`:879-902`, exposes service members on ctx).

**Practical consequence for a zero-dependency package**: you cannot extend `Service` (that requires importing `@deepseek-ai/cordis`), but you can register a plain object/function with `ctx.provide("myService", impl)` and consume it via `ctx.get("myService")` or by declaring it in `inject` (then `ctx.myService` works).

---

## 4. `ctx.effect(fn)`

- `ctx.effect` **is** `Fiber.effect` (mixed in at `:743`), defined at `cordis/lib/index.js:1169-1279`.
- Signature `effect(execute, label = "anonymous")`.
- The callback is invoked **synchronously and immediately**, with **no arguments**, and `this` bound to the Fiber: `const effect = runner.execute.call(this);` (`:1142`), from `task = this._execute(runner);` (`:1250`).
- Preconditions: `this.assertActive()` (`:1170`) → throws `CordisError("INACTIVE_EFFECT")` when `this.uid === null` (`:1131-1134`); plus `if (this.state === 5) throw new CordisError("INACTIVE_EFFECT");` (`:1171`) — state 5 = unloading.

Return-value contract (`_execute`, `:1135-1167`):

| returned value | effect |
|---|---|
| function | collected as the disposer (`:1143`) |
| `null` / `undefined` | nothing (`:1144`) |
| non-object | `throw new TypeError("Invalid effect")` (`:1144`) |
| thenable | awaited, then collected; the resolved value must be a function or nullish, else `TypeError("Invalid effect")` (`:1138-1140`, `:1145`) |
| iterable | each yielded value is collected as a disposer (`:1146-1153`) |
| async iterable | same, awaited (`:1154-1165`) |
| anything else | `throw new TypeError("Invalid effect")` (`:1166`) |

- The returned value is a **wrapper function** (`:1239-1246`) that disposes the effect when called; it carries `symbols.effect` metadata (`:1246`) and is **thenable**: `wrapper.then = async (...) => { ... disposeAsync ... }` (`:1275-1277`) — **awaiting the wrapper disposes the effect**.
- Labels show up in diagnostics via `fiber.getEffects()` (`:1285-1287`).
- Shipped pattern: `ctx.effect(() => async () => { /* cleanup */ })` (`dsh-working-directory/lib/index.js:66-69`).

---

## 5. `ctx.on(event, listener, options)` — waterfall & `prepend`

`cordis/lib/index.js:371-380`:

```js
on(name, listener, options) {
    if (typeof options !== "object") options = { prepend: options };
    this.ctx.fiber.assertActive();
    listener = this.ctx.reflect.bind(listener);
    const result = this.bail(this.ctx, "internal/listener", name, listener, options);
    if (result) return result;
    const hooks = this._hooks[name] ||= [];
    const label = `ctx.on(${typeof name === "string" ? JSON.stringify(name) : name.toString()})`;
    return this.register(label, hooks, listener, options);
}
```

- `options` may be a **boolean**, shorthand for `{ prepend: options }` (`:372`).
- The listener is bound for context tracing (`:374`).
- Throws `CordisError('INACTIVE_EFFECT')` on a disposed fiber (`:373`).
- Returns a **disposer**; `true` if it was still registered.

`prepend` — `register(label, hooks, callback, options)` (`:335-345`):

```js
const method = options.prepend ? "unshift" : "push";
```

⇒ With `{ prepend: true }` the listener is placed at the **head** of the hook list and therefore **runs first**. Shipped usage: `ctx.on("system-prompt/assemble", async (_assembly, context, next) => {...}, { prepend: true })` (`dsh-working-directory/lib/index.js:48-65`).
Registration is a fiber effect (`:337-344`) → the listener is removed automatically when the plugin's fiber unloads.

Waterfall semantics (doc `:307-316`, impl `:317-325`):

```js
waterfall(...args) {
    const cbs = this.dispatch("waterfall", args);
    const inner = args.pop();
    const next = () => {
        return (cbs.shift() ?? inner)(...args);
    };
    args.push(next);
    return next();
}
```

- The **last argument** is the innermost fallback `next` (the built-in behaviour).
- Listeners run **outermost-first**, invoked as `listener(...listenerArgs, next)`; each listener must `await next()` / `return next()` to continue.
- A listener that never calls `next()` **vetoes** the rest of the chain, including the built-in behaviour (`:310-312`).
- Returns the outermost listener's return value.

Other dispatch modes (`:258-306`): `dispatch` filters by isolation scope — `hook.global || !filter || filter.call(thisArg, hook.ctx)` (`:263`); `parallel` (all concurrent, throws `AggregateError` if any rejects, `:271-274`); `emit` (sync, no awaiting, `:280-282`); `serial` (sequential, awaits each, stops at a bail value, `:289-294`); `bail` (sync, stops at a bail value, `:301-306`). A value is "bailed" when not null/false/undefined (`isBailed`, `:219-221`). `ctx.once(name, listener, options)` (`:389-395`) self-disposes after the first call.

---

## 6. `ctx.logger`

- `ctx.logger` is a `LoggerService` instance installed by the Context constructor (`:1688`) and is **callable**: `ctx.logger("name")` → `[symbols.invoke](name)` (`:629-639`):

```js
[symbols.invoke](name) {
    const config = this._resolveConfig();
    const fiber = (this.ctx[symbols.shadow] ?? this.ctx).fiber;
    name ??= config.name;
    name ??= hyphenate(fiber.name);
    return new Logger({ name, level: config.level, meta: { fiber: new WeakRef(fiber) } }, this);
}
```

  ⇒ `ctx.logger('my-plugin').warn('hi')` = named logger; `ctx.logger.warn('hi')` = fiber-derived default name.
- Level methods on the service prototype (`:640-649`): `error`, `info`, `warn`, `debug` — each `function(...args) { return this()[type](...args); }`, i.e. **variadic**.
- Named `Logger` (`:454-461`): `this.error = this._method("error", 0)`, `info`=1, `warn`=2, `debug`=3.
- `_method(type, level)` (`:462-487`): variadic `(...args)`; a lone `Error` arg is unwrapped (`.cause` / `AggregateError` expansion, `:464-470`); the first arg is a **printf-style format string**; placeholders `%s %d %i %f %o %O %c %C %%` (`defaultFormatters`, `:400-411`); a non-string first arg is rendered with `%o` (`:444-448`); each line is truncated at `maxLength = 10240` (`:449-452`).
- Exporters: `ctx.logger.exporter(exporter)` (`:613-619`) registers a sink, disposed with the fiber. Per-exporter level filter (`:474`):
  `if ((exporter.levels?.[this.name] ?? exporter.levels?.default ?? this.level ?? 1) < level) continue;` ⇒ a message passes when the configured level is **≥** the message level; default level is `1` (info).
- The service keeps a 1000-message ring buffer (`bufferSize = 1e3`, `:583`) with its own exporter (`:598-604`).
- `LoggerService._resolveConfig()` (`:620-628`) merges `logger` intercept configs (`{ name, level }`).

---

## 7. `ctx.fiber`, `ctx.scope`, `ctx.setTimeout`

### `ctx.fiber`

- `ctx.fiber` is the current `Fiber` (`:1684`: `this.fiber = new Fiber(self, {}, Object.create(null), null, () => [])`). `ctx.fiber.runtime` and `ctx.fiber.effect` are accessors into the owning fiber (`:743`).
- Public members (`:1008-1033`): `parent`, `inject`, `runtime`, `uid`, `ctx`, `config`, `_config`, `state`, `dispose`, `store`, `inertia`.
- `ctx.fiber.assertActive()` (`:1131-1134`):

```js
assertActive() {
    if (this.uid !== null) return;
    throw new CordisError("INACTIVE_EFFECT");
}
```

  Call it after any `await` before touching ctx APIs — the fiber may have been disposed meanwhile.
- `ctx.fiber.effect(execute, label)` (`:1169`) — identical to `ctx.effect`.
- `ctx.fiber.name` (`:1117-1124`) — nearest named ancestor runtime name, else `"root"`.
- `ctx.fiber.state` — `0 idle, 1 loading, 2 active, 3 error, 4 disposed, 5 unloading` (`_getState` `:1288-1293`, `_updateState` `:1294-1305`).
- `ctx.fiber.getEffects()` (`:1285-1287`) — effect metadata tree.
- `ctx.fiber.await()` (`:1399-1403`, rethrows startup error), `ctx.fiber.restart()` (`:1410-1415`), `ctx.fiber.update(config, noSave)` (`:1427-1442` → `internal/update` waterfall then restart).
- `ctx.fiber.inject` — the resolved dependency map (`name → intercept config | null`) produced from the declaration.
- `ctx.fiber.store` — the services provided by this fiber (`name → impl`).
- `ctx.fiber.ctx` — the fiber's own child context.

### `ctx.scope` — **not present**

- No `scope` member anywhere in `cordis/lib/index.js`.
- DSH's `@deepseek-ai/dsh-scope` (`D:\...\app.asar\dsh\node_modules\@deepseek-ai\dsh-scope\lib\index.js`, 357 lines) is a **pure helper library**, not a ctx service: `createScope(ctx, key, options)` (`:296-306`, mints a `ctx.plugin(scope)` fiber and returns `{ ctx, rawDispose, dispose }`), `scopeOf(ctx)` (`:312-314`), `scopeTarget(base, key)` (`:327-338`), `isScopeCarrier` (`:344-346`), `carrierKeyOf` (`:352-355`), `bindScopeParent` (`:256-262`), `scopeParentOf` (`:268-273`), `scopeChainOf` (`:276-280`). It registers **no** `ctx.scope` property.
- Use `ctx.isolate(name, label)` (`:1723-1732`) / `ctx.extend(meta)` (`:1704-1710`) for scoped contexts.

### `ctx.setTimeout` — **not in cordis core**; comes from `@deepseek-ai/cordis-plugin-timer`

`D:\...\app.asar\dsh\node_modules\@deepseek-ai\cordis-plugin-timer\lib\index.js` (152 lines; the package is a dependency of `@deepseek-ai/dsh-desktop-runtime` v0.2.1-rc.5):

- `:4-15` — `var TimerService = class extends Service { constructor(ctx) { super(ctx, "timer"); ctx.mixin("timer", ["timeout","interval","throttle","debounce","setTimeout","setInterval"]); } ... }` ⇒ the service is named **`timer`** and its members are mixed onto `ctx`.
- `:17-19` — `setTimeout(callback, delay)` is a **deprecated alias** of `timeout`.
- `:24-47` — `timeout(...args)`: with a callback it returns a disposer effect; **without** a callback it returns a promise that rejects with `Error("Context has been disposed")` on dispose.
- `:48-116` `interval(...)`, `:131-142` `throttle(callback, delay, noTrailing)`, `:144-149` `debounce(callback, delay)`.
- `:152` — `export { TimerService, TimerService as default }`.

---

## 8. DSH-specific constraints worth knowing before writing the package

**Restricted ctx façade for agent "dynamic packages"** — `D:\...\app.asar\dsh\node_modules\@deepseek-ai\dsh-cordis-host-runner\lib\index.js:629-661`:

- Allowed on the sandbox ctx: `ctx.tools` (guarded façade: `register` / `schemas` / `get`, `:579-585`), `ctx.get(name)` (any service, `:643`), and the verbs `CTX_VERBS` = `{ effect, on, once, provide, timeout, interval, setTimeout, setInterval, throttle, debounce }` (`:550-561`, served at `:649-653`), plus **declared** services as properties (`:654`, `:638`).
- Timer verbs require `inject: ['timer']` (`:650`, `:562-569`).
- **Not exposed**: `ctx.logger`, `ctx.plugin`, `ctx.inject`, `ctx.extend`, `ctx.registry`, `ctx.fiber`, `ctx.accessor`, `ctx.mixin`, `ctx.emit`/`ctx.waterfall` (only `on`/`once`). Reading them raises: `sandbox ctx does not expose "<prop>". Available: ctx.tools.register / ctx.on / ctx.provide / the timer helpers after injecting timer, and any service you declared in inject. Framework internals (root, fiber, registry, extend, plugin, …) are withheld by design.` (`:634`).
- The sandbox ctx is **read-only** for assignment (`:656-658`).
- `guardedPlugin` (`:679-696`) wraps function/object plugins, preserving `name` and `apply`; the plugin body receives the sandbox ctx.
- Re-registering a service name that an earlier package already provided fails loudly: `... — to REPLACE something an earlier dynamic package registered, first stop that package through its runner or the Cordis panel before running the new version.` (`:951-963`).

A plugin installed **into a profile** through `cordis-plugin-loader` does **not** run behind this façade — it receives the normal context (all verbs, `ctx.logger`, `ctx.plugin`, `ctx.provide`, `ctx.fiber`, …).

---

## 9. Checklist for a standalone package installed into a DSH profile

1. **Shape**: `package.json` with `"type": "module"`, `exports`/`main` → `lib/index.js`; the module's **default export is the plugin**.
2. **Zero-dependency style (no `@deepseek-ai/cordis` import)** — recommended when the package must install without a registry round-trip:

   ```js
   export default {
     name: 'repowiki',           // optional: display/runtime name
     inject: ['fs'],             // optional: services this plugin needs
     // Config: optional standard-schema object; omit for plain-object config
     apply(ctx, config) {
       const dispose = ctx.provide('repowiki', { /* api */ });
       ctx.on('some-event', async (payload, next) => { /* waterfall */ await next(); }, { prepend: true });
       ctx.effect(() => async () => { /* cleanup */ });
       return dispose;           // returned function is collected as the disposer
     },
   }
   ```

   - `ctx.provide` registers the service with **no cordis import** (`:800-824`); consumers read it via `ctx.get('repowiki')` or by declaring `inject: ['repowiki']` (then `ctx.repowiki`).
   - `inject: ['fs']` is what makes `ctx.fs` legal; without a declaration, `ctx.fs` throws `cannot get property "fs" without inject` (`:676`).
   - `Config` must be a **standard-schema** object (`{ "~standard": { version: 1, vendor, validate(v) } }`); a plain object would crash at `runtime.Config["~standard"].validate` (`:958`).
3. **Cordis-import style** (adds `@deepseek-ai/cordis` as a dependency):

   ```js
   import { Service } from '@deepseek-ai/cordis'
   export default class RepoWikiService extends Service {
     static inject = ['fs']
     static provide = 'repowiki'        // default service name
     constructor(ctx, config) { super(ctx, 'repowiki'); /* ... */ }
     async *[Service.init]() { /* yield disposer */ }
   }
   ```

   - `super(ctx, name)` performs the registration (`:1782`); the **constructor's** return value is discarded — put cleanup in `[Service.init]()` or `ctx.effect(...)`.
4. **Function style**: use an **arrow function** (`export default (ctx, config) => {...}`) if you want to return a disposer — a `function` declaration is `new`-ed by `isConstructor` (`:57-62`) and loses the return value.
5. **Config**: declare `static Config` / `Config` as standard-schema; the validated value arrives as the 2nd argument. Without it the raw config object (or `undefined`) arrives.
6. **Cleanup**: prefer `ctx.effect(() => disposer)` — it unwinds with the fiber.
7. **Events**: `ctx.on(name, async (...args, next) => { ...; await next(); }, { prepend: true })` for waterfall events; `prepend` puts the listener first (`:336`).
8. **Loader entry**: `name:` = the package's import specifier, `config:` = the plugin config (`cordis-plugin-loader/lib/index.js:214-228`, `:450-465`).
9. **Timers**: `ctx.setTimeout` only exists if the `timer` service is installed (`@deepseek-ai/cordis-plugin-timer`); in the dynamic-package sandbox you must also declare `inject: ['timer']` (`:650`).
