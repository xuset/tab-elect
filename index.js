
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
  self.currentTerm = 0
  self.electedTerm = 0
  self.destroyed = false

  self._db = new IdbKvStore(name)
  self._db.on('change', function (change) {
    self._onDbChange(change)
  })

  self._db.on('error', function (err) {
    self._destroy(err)
  })

  self._db.on('close', function () {
    self._destroy(new Error('IDB database unexpectedly closed'))
  })

  self.elect()
}

TabElect.prototype._onDbChange = function (change) {
  if (this.destroyed) return
  console.log('CHANGE', change)
  if (change.method === 'add' && change.key > this.currentTerm) {
    // A new leader has rising; a new age of tyranny has begun
    this.currentTerm = change.key
  }

  if (change.method === 'remove') {
    if (this.isLeader && change.key === this.electedTerm) {
      // The new leader has revoked this instance's leadership position
      this.depose()
    } else if (!this.isLeader && change.key === this.currentTerm) {
      // The leader has deposed themself so no one is the leader. Begin the race for election
      this.elect()
    }
  }
}

TabElect.prototype.elect = function (cb) {
  var self = this
  if (self.destroyed) throw new Error('Already destroyed')
  if (self.isLeader) throw new Error('Already the leader')

  var oldTerms
  var newTerm

  self._db.keys()
  .then(function (keys) {
    oldTerms = keys.slice(0) // Copy array
    newTerm = keys.length === 0 ? 1 : keys.sort().pop() + 1
    console.log('GOT_TERMS', newTerm, oldTerms)
    // 'add' operation fails if the key already exists.
    // The key already exists only if multiple instances try to elect themeselves simultaneously
    return self._db.add(newTerm, true)
  })
  .then(function () {
    // Remove all old keys/terms. This notifies the old leader their tyranny has ended
    return Promise.all(oldTerms.map(function (t) { return self._db.remove(t) }))
  })
  .then(function () {
    console.log('PRE_ELECT', self.currentTerm, newTerm)
    if (self.currentTerm > newTerm) {
      // Someone elected themeselves after us and stole the leader position
      if (cb) cb(null, false)
    } else {
      console.log('ELECT', newTerm)
      self.isLeader = true
      self.currentTerm = newTerm
      self.electedTerm = newTerm

      if (cb) cb(null, true)
      self.emit('elected')
    }
  })
  .catch(function (err) {
    console.log('DB ERR', err)
    if (!cb) return
    if (err.name === 'ConstraintError') {
      /*
       * The db 'add' operation failed because another instance added the same key. That
       * instance successfully elected itself. This instance did not.
       */
      cb(null, false)
    } else {
      cb(err)
    }
  })
}

TabElect.prototype.depose = function () {
  if (this.destroyed) throw new Error('Already destroyed')
  if (!this.isLeader) throw new Error('Can not depose when not the leader')

  console.log('DEPOSE', this.electedTerm)
  this._db.remove(this.electedTerm)
  this.isLeader = false
  this.emit('deposed')
}

TabElect.prototype.destroy = function () {
  this._destroy()
}

TabElect.prototype._destroy = function (err) {
  var self = this
  if (self.destroyed) return
  self.destroyed = true
  var wasLeader = self.isLeader
  self.isLeader = false

  if (err) self.emit('error', err)
  self.removeAllListeners()

  if (wasLeader) this._db.remove(this.electedTerm, finished)
  else finished()

  function finished () {
    self._db.close()
    self._db = null
  }
}
