var TabElect = require('.')
var test = require('tape')

test('basic', function (t) {
  t.timeoutAfter(3000)
  var e = TabElect('foo')

  e.on('elected', function () {
    e.depose()
  })

  e.on('deposed', function () {
    e.destroy()
    t.end()
  })
})

test('one after the other', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo')

  e1.on('elected', function () {
    var e2 = TabElect('foo')
    e2.on('elected', function () {
      e1.destroy()
      e2.destroy()
      t.end()
    })
  })
})

test('two at a time', function (t) {
  t.timeoutAfter(3000)
  var e1 = TabElect('foo')
  var e2 = TabElect('foo')

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
  var e1 = TabElect('foo')
  var e2 = TabElect('foo')

  e1.on('elected', function () {
    e2.removeAllListeners()
    e2.elect(function (err, elected) {
      t.equal(err, null)
      t.equal(elected, true)
      t.equal(e2.isLeader, true)
      e1.destroy()
      e2.destroy()
      t.end()
    })
  })

  e2.on('elected', function () {
    e1.removeAllListeners()
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
  var e1 = TabElect('foo')
  var e2 = TabElect('foo')

  e1.on('elected', function () {
    e2.on('elected', function () {
      t.end()
    })
    e1.destroy()
  })

  e2.on('elected', function () {
    e1.on('elected', function () {
      t.end()
    })
    e2.destroy()
  })
})
