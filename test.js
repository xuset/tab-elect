var TabElect = require('.')
var test = require('tape')

test('basic', function (t) {
  t.timeoutAfter(3000)
  var e = TabElect('foo1')

  e.on('elected', function () {
    e.stepDown()
  })

  e.on('deposed', function () {
    e.destroy()
    t.end()
  })
})

test('one after the other', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo2')

  e1.on('elected', function () {
    var e2 = TabElect('foo2')
    e2.on('elected', function () {
      e1.destroy()
      e2.destroy()
      t.end()
    })
  })
})

test('two at a time', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo3')
  var e2 = TabElect('foo3')

  e1.on('elected', onelect)
  e2.on('elected', onelect)

  function onelect () {
    e1.destroy()
    e2.destroy()
    t.end()
  }
})

test('explicit elect', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo4')
  var e2

  e1.once('elected', function () {
    e2 = TabElect('foo4')
  })

  e1.once('deposed', function () {
    e1.elect(function (err, elected) {
      t.equal(err, null)
      t.equal(elected, true)
      t.equal(e1.isLeader, true)
      e1.destroy()
      e2.destroy()
      t.end()
    })
  })
})

test('auto elect after leader is destroyed', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo5')

  e1.once('elected', function () {
    var e2 = TabElect('foo5')
    e2.once('elected', function () {
      e1.once('elected', function () {
        e1.destroy()
        t.end()
      })
      e2.destroy()
    })
  })
})
