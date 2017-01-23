/* eslint-env browser */

module.exports = TabElect

var IdbKvStore = require('idb-kv-store')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter

TabElect.SUPPORT = IdbKvStore.INDEXEDDB_SUPPORT && IdbKvStore.BROADCAST_SUPPORT

inherits(TabElect, EventEmitter)
function TabElect (name, opts) {
  var self = this
  if (!TabElect.SUPPORT) throw new Error('No indexDB or BroadcastChannel support')
  if (typeof name === 'undefined') throw new Error('"name" cannot be undefined')
  if (!(self instanceof TabElect)) return new TabElect(name, opts)
  if (!opts) opts = {}

  EventEmitter.call(self)

  self.isLeader = false
  self.destroyed = false

  self._locking = false

  self._db = new IdbKvStore('tab-elect-' + name)
  self._db.on('change', onDbChange)
  self._db.on('error', onDbError)
  self._db.on('close', onDbClose)

  addEventListener('beforeunload', onBeforeUnload)

  self.elect()

  function onDbChange (change) {
    self._onDbChange(change)
  }

  function onDbError (err) {
    self._destroy(err)
  }

  function onDbClose () {
    self._destroy(new Error('IDB database unexpectedly closed'))
  }

  function onBeforeUnload () {
    self._destroy()
  }
}

TabElect.prototype.elect = function (cb) {
  var self = this
  cb = cb || noop
  if (self.destroyed) throw new Error('Already destroyed')
  if (self.isLeader) throw new Error('Already the leader')
  if (self._locking) return setTimeout(cb, 0, null, false)

  self._db.remove('lock')
  .then(function () {
    return self._lock(cb)
  })
}

TabElect.prototype._lock = function (cb) {
  var self = this
  cb = cb || noop
  if (self.destroyed) return
  if (self._locking) return cb(null, false)

  self._locking = true
  return self._db.add('lock', true)
  .then(function () {
    self._locking = false
    self.isLeader = true

    if (self.destroyed) return self._destroyDB()

    cb(null, true)
    self.emit('elected')
  })
  .catch(function (err) {
    self._locking = false

    if (self.destroyed) return self._destroyDB()

    // ConstraintError - Add operation failed because key already exists. Someone else is leader
    if (err.name === 'ConstraintError') cb(null, false)
    else cb(err)
  })
}

TabElect.prototype.depose = function () {
  if (this.destroyed) throw new Error('Already destroyed')
  if (!this.isLeader) throw new Error('Can not depose when not the leader')

  this._db.remove('lock')
  this._onDepose()
}

TabElect.prototype._onDepose = function () {
  this.isLeader = false
  this.emit('deposed')
}

TabElect.prototype._onDbChange = function (change) {
  if (this.destroyed || change.key !== 'lock' || change.method !== 'remove') return

  if (this.isLeader) {
    // Someone removed our lock so we are not the leader anymore
    this._onDepose()
  } else {
    // The leaders lock has been removed so attempt to elect ourselves
    this._lock()
  }
}

TabElect.prototype.destroy = function () {
  this._destroy()
}

TabElect.prototype._destroy = function (err) {
  if (this.destroyed) return
  this.destroyed = true

  if (err) this.emit('error', err)
  this.removeAllListeners()

  this._destroyDB()
  self.isLeader = false
}

TabElect.prototype._destroyDB = function () {
  var self = this
  if (!self._db) return

  if (self.isLeader) this._db.remove('lock', finished)
  else if (!self.locking) finished()

  function finished () {
    self._db.close()
    self._db = null
  }
}

function noop () {
  // do nothing
}
