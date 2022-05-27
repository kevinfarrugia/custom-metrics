// Note: Using prefixed variable to avoid naming collisions in the global scope.
// This name must exactly match the one referenced in custom metrics.
const httparchive_observers = {
  call_stacks: {},
  constructor_stacks: {}
};
let httparchive_enable_observations = false;

// Local scope.
(() => {

// Add the pathnames of any functions/properties you want to observe.
const OBSERVERS = [
  'navigator.__proto__.*',
  'performance.__proto__.*',
  'performance.timing.__proto__.*',
  'Array.prototype.*',
  'String.prototype.*',
  'Object.prototype.*',
  'CSSStyleDeclaration.prototype.*',
  'document.featurePolicy',
  'document.write',
  'queueMicrotask',
  'requestIdleCallback',
  'navigator.scheduling.isInputPending',
  'scheduler.postTask'
];

const PROPERTIES_TO_TRACE = new Set([
  'navigator.userAgent'
]);

// observe number of times a constructor is called
const CONSTRUCTORS = ["Worker"];

function resolveObject(pathname) {
  let obj = window;
  let props = pathname.split('.');

  while (props.length) {
    if (!obj) {
      return null;
    }

    const prop = props.shift();
    obj = obj[prop];
  }

  return obj || null;
}

function getAllProperties(pathname, depth=1) {
  if (!depth) {
    return pathname;
  }

  const props = pathname.split('.');
  const parentPathname = props.slice(0, -1).join('.');
  const parentObj = resolveObject(parentPathname);

  return Object.getOwnPropertyNames(parentObj).flatMap(prop => {
    return getAllProperties(`${parentPathname}.${prop}`, depth - 1);
  });
}

function initializeObserver(pathname) {
  const props = pathname.split('.');
  const prop = props.at(-1);
  let parentPathname;
  let original;

  if (props.at(-2) == '__proto__') {
    // Omit __proto__ for observation purposes.
    parentPathname = props.slice(0, -2).join('.');
  } else {
    parentPathname = props.slice(0, -1).join('.');
  }

  pathname = `${parentPathname}.${prop}`;
  const parentObj = resolveObject(parentPathname);

  try {
    original = parentObj[prop];
  } catch (e) {
    // The property is not accessible.
    return;
  }

  try {
    Object.defineProperty(parentObj, prop, {
      configurable: true,
      get: () => {
        if (!httparchive_enable_observations) {
          return original;
        }

        if (PROPERTIES_TO_TRACE.has(pathname)) {
          // Construct a stack trace.
          let stack;
          try {
            throw new Error();
          } catch (e) {
            stack = e.stack;
          }
          let stackCounter = httparchive_observers.call_stacks[pathname];
          if (!stackCounter[stack]) {
            stackCounter[stack] = 0;
          }
          stackCounter[stack]++;
        }

        // Increment the feature counter.
        httparchive_observers[pathname]++;

        // Return the original feature.
        return original;
      }
    });
  } catch (e) {
    // The property is not observable.
    return;
  }

  if (PROPERTIES_TO_TRACE.has(pathname)) {
    httparchive_observers.call_stacks[pathname] = {};
  }

  httparchive_observers[pathname] = 0;
}

OBSERVERS.forEach(pathname => {
  if (pathname.split('.').at(-1) == '**') {
    getAllProperties(pathname, 3).forEach(initializeObserver);
    return;
  }

  if (pathname.split('.').at(-1) == '*') {
    getAllProperties(pathname).forEach(initializeObserver);
    return;
  }

  initializeObserver(pathname);
});

CONSTRUCTORS.forEach((n) => {
  // keep a reference to the original prototype
  const original_proto = window[n].prototype;

  // initialise the counter
  httparchive_observers.constructor_stacks[n] = 0;

  // override the constructor
  window[n] = function (...args) {
    // increment the counter
    httparchive_observers.constructor_stacks[n] =
      httparchive_observers.constructor_stacks[n] + 1;
    // return the original constructor with the arguments
    return new original_proto.constructor(args);
  };

  // restore the original prototype
  window[n].prototype = original_proto;
});

httparchive_enable_observations = true;

})();
