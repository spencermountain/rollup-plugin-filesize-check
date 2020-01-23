(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
}((function () { 'use strict';

  // This function isn't used anywhere, so
  // Rollup excludes it from the bundle...
  const square = function(x) {
    return x * x
  };

  // This function gets included
  const cube = function(x) {
    // rewrite this as `square( x ) * x`
    // and see what happens!
    return x * x * x
  };
  const doMath = function() {
    let x = 2;
    x = square(x);
    x = cube(x);
    return x
  };
  module.exports = doMath;

})));
