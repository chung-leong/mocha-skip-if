# Mocha-skip-if

This module enables you to selectively skip certain Mocha tests based on runtime conditions. It'll call `it.skip()` or `describe.skip()` when the expressed conditions are met and `it()` or `describe()` otherwise.

## Basic Usage

```js
require('mocha-skip-if');

skip.condition({
  watching: /:watch/.test(process.env.npm_lifecycle_event),
  debugging: (part) => (part === process.env.DEBUGGING),
})

describe('Test', function() {
  skip.if.watching.and.not.debugging('data retrieval').
  describe('Remote data retrieval', function() {
    // activities subjected to rate-limit
  })
})
```

This module adds the global variable `skip`. You call its `condition()` method to define conditions. In the example above, two conditions are defined: **watching** and **debugging**. The latter requires one argument.

Once conditions are defined, they become available as properties of `skip.if` and logical operators like `and` and `not`. You can then construct skip statements in a style similar to the one used by [Chai](https://www.chaijs.com/). Ending in a dot, a statement should sit atop the relevant describe() or it() call.

Instead of `if`, you can use `when` or `while`. They are synonyms.

## Using variables

You can also use variables to determine whether a test gets skipped:

```js
skip.if(variable1).or.if(variable2).
it('should wipe out half of all life in the universe', function() {
  /* ... */
})
```

The second `if` in the example above isn't necessary. The following would also work:

```js
skip.if(variable1).or(variable2).
it('should wipe out half of all life in the universe', function() {
  /* ... */
})
```

If a function is passed, then the function will be called and its return value determines whether the test is skipped:

```js
function isCatDead() {
  return Math.random() >= 0.5;
}

skip.if(isCatDead).
it('should send cat back in time to search for the soul stone', function() {
  /* ... */
})
```

## Defining conditions

Multiple conditions can be specified by passing an object to `skip.condition()`. This object can in turn contain multiple objects, whose keys are treated as semantically meaningful tokens:

```js
skip.condition({
  browser: {
    is: {
      edge: isEdge,
      chrome: isChrome,
      firefox: isFirefox,
    }
  },
  os: {
    is: {
      mac: isMac,
      windows: isWindows,
      linux: isLinux,
    }
  }
});

skip.if.os.is.mac.and.browser.is.chrome.
describe('Browser specific test', function() {
  /* ... */
})
```

In the example above, the tokens `browser` and `is` don't really do anything. They are just there to make the code read like normal English.

You can also define conditions by passing a `string` and a `boolean` or a `function` to `skip.condition()`:

```js
skip.condition('browser.is.edge', isEdge);
skip.condition('browser.is.chrome', isChrome);
skip.condition('browser.is.firefox', isFirefox);
```

Starting from v1.0.2, you can do this:

```js
skip
  .condition('browser.is.edge', isEdge)
  .condition('browser.is.chrome', isChrome)
  .condition('browser.is.firefox', isFirefox);
```

Conditions can be redefined. In the examples above, `browser` is not a condition. It's just a word you have to specify for semantic reason. The expression `skip.if.browser.it()` would cause an error. We can make `skip.if.browser` available as a check for whether the environment is a generic web-browser by redefining it:

```js
skip.condition({
  browser: {
    is: {
      edge: isEdge,
      chrome: isChrome,
      firefox: isFirefox,
    }
  },
  os: {
    is: {
      mac: isMac,
      windows: isWindows,
      linux: isLinux,
    }
  }
});
skip.condition('browser', isBrowser);
```

Now you can use both `skip.if.browser` and `skip.if.browser.is.chrome`.

Note that the module will scan `function` objects for attached properties. You can therefore do the following:

```js
function edge() {
  /* ... */  
}
function chrome() {
  /* ... */    
}
function firefox() {
  /* ... */
}
function browser() {
  /* ... */
}
browser.is = { edge, chrome, firefox };

skip.condition({ browser });

skip.if.browser.is.firefox.
it ('should halt and catch fire', function() {
  /* ... */
})
```

## Skipping tests permanently

This module will normally call `it.skip()` or `describe.skip()` when the condition specified evaluates to true. This means the test will be marked by Mocha as **pending**. If the test in question will never ever pass and should be skipped permanently, you can accomplish that by adding `forever` to the expression:

```js
skip.forever.if.browser.is.ie.
describe('Browser specific test', function() {
  /* this will never succeed in IE */
})
```

The synonyms `entirely` and `permanently` can be used in place of `forever`.

## Inverting conditions

Normally, a test is skipped when the condition specified is true. You can invert the behavior--skipping a test when the condition is false--by using `unless` instead of `if`:

```js
skip.unless.os.is.mac.and.browser.is.chrome.
describe('Browser specific test', function() {
  /* ... */
})
```

The synonym `until` can also be used.

Extra care needs to be taken when using `unless` to check for existence of a function as the function could end up being called instead. The following, for instance, does not work:

```js
skip.unless(global.gc).
it('should not leak memory', function() {
  /* ... */
})
```

The test will be skipped even when Node is started with the command-line option `--expose-gc`, since `gc()` returns `undefined`. You need to do this instead:

```js
skip.unless(!!global.gc).
it('should not leak memory', function() {
  /* ... */
})
```

or

```js
skip.if(!global.gc).
it('should not leak memory', function() {
  /* ... */
})
```

## Parametric conditions

When a function with named arguments is given as a condition, then it has to be invoked with arguments. The following would throw an error for instance:

```js
skip.condition('browser', (name) => {
  /* ... */
});

skip.if.browser.
it('should test something', function() {
  /* ... */
})
```

You can make a condition both generic and possibly more specific with the help of default argument:

```js
skip.condition('browser', (name = 'any') => {
  if (name === 'any') {
    /* return true as long as we're in any browser */
  } else {
    /* return true if the browser is the one specified */
  }
});
```

Now `skip.if.browser.it(...)` will no longer throw. Instead, it'll invoke the callback with the default argument. The expression `skip.if.browser('edge').it(...)` would cause the callback to be invoked twice: once with `name` set to the default and a second time with the name given as an argument.

Callbacks can accept at most two arguments currently.

## Asynchronous conditions

Sometimes, test cases would only pass if external, remote resources are available. Checking for their availability would generally require asynchronous function calls, however. This module is not designed to deal with this situation. Consider using [deasync](https://www.npmjs.com/package/deasync) if you're faced with this problem.

## Skipping a test unconditionally

Calling `skip.it()` or `skip.describe()` would always skip a test (or a set of tests):

```js
skip.
it('should do the impossible', function() {
  /* ... */
})
```

## Creating isolated instances

Most of the time, test conditions affect your entire test suite and the use of the global `skip` object is sufficient. When conditions are localized to a particular test script, you might find it useful to use an isolated instance of Skip. You create one by calling `skip` as a function.

```js
const skip = global.skip({
  /* conditions */
});
```
