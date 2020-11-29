# Mocha-skip-if

This module enable you to selectively skip certain Mocha tests based on runtime conditions. It'll call `it.skip()` or `describe.skip()` if stated conditions are met and `it()` or `describe()` otherwise.

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

This module adds the global variable `skip`. The method `condition()` is used to define conditions. In the example above, two conditions are defined: **watching** and **debugging**. The latter requires one argument.

Once the conditions are defined, they become available as properties of `skip.if` and logical operators like `and` and `not`. The skip statement is then constructed in a semantic style similar to one used by [Chai](https://www.chaijs.com/). Ending in a dot, it should sit atop the relevant describe() or it() call.

Instead of `if`, you can also use `when` or `while`. They are synonyms.

## Using variables

You can also use variables to determine whether a test gets skipped:

```js
skip.if(variable1).or.if(variable2).
it('should wipe out half of all life in the universe', function() {
  /* ... */
})
```

The second `if` in the example above isn't necessarily. The following would also work:

```js
skip.if(variable1).or(variable2).
it('should wipe out half of all life in the universe', function() {
  /* ... */
})
```

## Defining conditions

Multiple conditions can be specified by passing an object to `skip.condition()`. This object can in turn contain multiple objects, whose keys are used as semantically meaningful tokens:

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

In the example above, the tokens `browser` and `is` doesn't do anything. They are just there for documentation purpose.

You can also define conditions by passing a string and a boolean or a function to `skip.condition()`:

```js
skip.condition('browser.is.edge', isEdge);
skip.condition('browser.is.chrome', isChrome);
skip.condition('browser.is.firefox', isFirefox);
```

Conditions can be redefined. In the examples above, `browser` is not a condition. It's just a word you have to specify for semantic reason. The expression `skip.if.browser.it()` would cause an error. We can make `skip.if.browser` available as a check for whether the environment is a generic webbrowser by redefining it:

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

Now you can both `skip.if.browser` and `skip.if.browser.is.chrome` as conditions.

Note that the module will scan function object for attached properties. The following would accomplished the same goal:

```js
function isBrowser() {
  /* ... */
}
isBrowser.is = {
  edge: isEdge,
  chrome: isChrome,
  firefox: isFirefox
};

skip.condition({ browser: isBrowser });
```

## Skipping tests permanently

This module will call `it.skip()` or `describe.skip()` normally if the condition specified is true. This means the test will be marked by Mocha as **pending**. If the test in question will never pass and should be skipped permanently, you can accomplish that by adding `forever` to the expression:

```js
skip.forever.if.browser.is.ie.
describe('Browser specific test', function() {
  /* this will never succeed in IE */
})
```

The synonyms `entirely` and `permanently` can be used in place of `forever`.

## Inverting conditions

Normally, a test is skipped if the condition specified is true. You can invert the behavior--skipping a test when the condition is false--by using the `unless` instead of `if`:

```js
skip.unless.os.is.mac.and.browser.is.chrome.
describe('Browser specific test', function() {
  /* ... */
})
```

The synonym `util` can also be used.

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

Now `skip.if.browser.it(...)` will no longer throw.

## Asynchronous conditions

Sometimes, test cases would only pass if external, remote resources are available. Checking for their availability would generally require asynchronous function calls, however. This module is not designed to deal with this situation. Consider using [deasync](https://www.npmjs.com/package/deasync) if you're faced with this problem.

## Skipping a test unconditionally

Calling `skip.it()` or `skip.describe()` would always skip a test (or set of tests):

```js
skip.
it('should do the impossible', function() {
  /* ... */
})
```

## Creating isolated instances

Most of the time, test conditions affect your entire test suite and the use of the global `skip` object is sufficient. When conditions are localized to a particular test script, you might find it useful to an isolated instance of Skip. You can do so by calling `skip` as a function.

```js
const skip = global.skip({
  /* conditions */
});
```
