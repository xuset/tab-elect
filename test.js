var TabElect = require('.')
var test = require('tape')

test('basic', function (t) {
  t.timeoutAfter(3000)
  var e = TabElect('foo')

  e.onelect = function () {
    e.destroy()
    t.end()
  }
})

test('one after the other', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo')

  e1.onelect = function () {
    var e2 = TabElect('foo')
    e2.onelect = function () {
      e1.destroy()
      e2.destroy()
      t.end()
    }
  }
})

test('two at a time', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo')
  var e2 = TabElect('foo')

  e1.onelect = onelect
  e2.onelect = onelect

  function onelect () {
    e1.destroy()
    e2.destroy()
    t.end()
  }
})

test('auto elect after leader steps down', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo')
  var e2 = TabElect('foo')

  e1.onelect = function () {
    e2.onelect = function () {
      t.end()
    }
    e1.destroy()
  }

  e2.onelect = function () {
    e1.onelect = function () {
      t.end()
    }
    e2.destroy()
  }
})
