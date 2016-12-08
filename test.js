var TabElect = require('.')
var test = require('tape')

test('basic', function (t) {
  t.timeoutAfter(3000)
  var e = TabElect('foo')

  e.onelect(function () {
    t.end()
  })
})
