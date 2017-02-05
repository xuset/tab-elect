var TabElect = require('.')
var test = require('tape')

test('basic', function (t) {
  t.timeoutAfter(3000)
  t.plan(2)

  var e = TabElect(random())

  e.on('elected', function () {
    t.equal(e.isLeader, true)
    e.stepDown()
  })

  e.on('deposed', function () {
    t.equal(e.isLeader, false)
  })
})

test('one after the other', function (t) {
  t.timeoutAfter(3000)
  t.plan(2)
  var campaign = random()

  var e1 = TabElect(campaign)

  e1.on('elected', function () {
    var e2 = TabElect(campaign)
    e2.on('elected', function () {
      t.equal(e2.isLeader, true)
      e2.destroy()
    })
    e1.on('deposed', function () {
      t.equal(e1.isLeader, false)
      e1.destroy()
    })
  })
})

test('two at a time', function (t) {
  t.timeoutAfter(3000)
  t.plan(2)
  var campaign = random()

  var e1 = TabElect(campaign)
  var e2 = TabElect(campaign)

  e1.on('elected', function () {
    t.equal(e1.isLeader, true)
    e1.destroy()
  })
  e2.on('elected', function () {
    t.equal(e1.isLeader, true)
    e2.destroy()
  })
})

test('explicit elect', function (t) {
  t.timeoutAfter(3000)
  t.plan(8)
  var campaign = random()

  var e1 = TabElect(campaign)
  var e2

  e1.once('elected', function () {
    t.equal(e1.isLeader, true)
    e2 = TabElect(campaign)
    e2.on('deposed', function () {
      t.equal(e2.isLeader, false)
      e2.destroy()
    })
    e2.on('elected', function () {
      t.equal(e2.isLeader, true)
    })
  })

  e1.once('deposed', function () {
    t.equal(e1.isLeader, false)
    e1.elect(function (err, elected) {
      t.equal(err, null)
      t.equal(elected, true)
      t.equal(e1.isLeader, true)
    })
    e1.once('elected', function () {
      t.equal(e1.isLeader, true)
      e1.destroy()
    })
  })
})

test('auto elect after leader is destroyed', function (t) {
  t.timeoutAfter(3000)
  t.plan(3)
  var campaign = random()

  var e1 = TabElect(campaign)

  e1.once('elected', function () {
    var e2 = TabElect(campaign)
    e2.on('elected', function () {
      t.equal(e2.isLeader, true)
      e1.on('elected', function () {
        t.equal(e1.isLeader, true)
        e1.destroy()
      })
      e2.destroy()
    })
    e2.on('deposed', function () {
      t.fail('"deposed" emitted after destroy')
    })
  })

  e1.on('deposed', function () {
    t.equal(e1.isLeader, false)
  })
})

test('leader racing', function (t) {
  t.timeoutAfter(3000)
  var instances = 10
  t.plan(instances)
  var campaign = random()

  for (var i = 0; i < instances; i++) {
    (function () {
      var e = new TabElect(campaign)
      e.on('elected', function () { onElected(e) })
      e.on('deposed', t.fail)
    })()
  }

  function onElected (e) {
    t.equal(e.isLeader, true)
    e.destroy()
  }
})

function random () {
  return Math.random().toString(16).substr(2)
}
