/* eslint-env browser */

module.exports = TabElect

var IdbKvStore = require('idb-kv-store')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter

TabElect.SUPPORT = IdbKvStore.INDEXEDDB_SUPPORT && IdbKvStore.BROADCAST_SUPPORT

// TODO : expirementally verify that these numbers aren't bullshit
// Consts
var LEADER_REFRESH_INTERVAL = 250  // In milliseconds
var ACK_TIMEOUT = 250

/********************/
/* PUBLIC INTERFACE */
/********************/

inherits(TabElect, EventEmitter)
function TabElect (name, opts = {}) {
  var self = this
  if (!TabElect.SUPPORT) throw new Error('No indexDB or BroadcastChannel support')
  if (typeof name === 'undefined') throw new Error('"name" cannot be undefined')
  if (!(self instanceof TabElect)) return new TabElect(name, opts)

  EventEmitter.call(self)

  self.dbManager = new TabElectDBManager(name)
  self.dbManager.on('elect', _onElect)
  self.dbManager.on('depose', _onDepose)

  self.isLeader = false
  self.destroyed = false

  // Handle lifecycle events
  addEventListener('beforeunload', onBeforeUnload)

  function onBeforeUnload () {
    self._destroy()
  }
}

TabElect.prototype.destroy = function () {
  this._destroy()
}

TabElect.prototype._onElect = function (cb = noop) {
  var self = this
  if (self.destroyed) throw new Error('Already destroyed')
  if (self.isLeader) throw new Error('Already the leader')

  this.isLeader = true
  this.emit('active')
}

TabElect.prototype._onDepose = function () {
  if (this.destroyed) throw new Error('Already destroyed')
  if (!this.isLeader) throw new Error('Can not depose when not the leader')

  this.isLeader = false
  this.emit('deactivate')
}

TabElect.prototype._destroy = function (err) {
  if (this.destroyed) return
  this.destroyed = true

  if (err) this.emit('error', err)
  this.removeAllListeners()

  self.isLeader = false
}

/******************/
/* HELPER CLASSES */
/******************/

// Manages the database state for the TabElect class
inherits(TabElectDBManager, EventEmitter)
function TabElectDBManager (name) {
  var self = this
  if (!TabElect.SUPPORT) throw new Error('No indexDB or BroadcastChannel support')
  if (!(self instanceof TabElectDBManager)) return new TabElectDBManager()

  EventEmitter.call(self)

  self._db = new IdbKvStore('tab-elect-' + name)
  self.destroyed = false

  // Handle DB and lifecycle events
  self._db.on('change', onDbChange)
  self._db.on('error', onDbError)
  self._db.on('close', onDbClose)

  addEventListener('beforeunload', onBeforeUnload)

  /******************/
  /* EVENT HANDLERS */
  /******************/

  function onDbChange (change) {
    // TODO : handle callbacks for acks and leader elections
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

  // Find the leader or elect yourself
  // NOTE that a randomized timeout may be necessary
  setInterval(function () {
    self.dbManager.ackLeader(function (succ, err) {
      // TODO : attempt leader election on err failure
    })
  }, LEADER_REFRESH_INTERVAL)
  self.dbManager.ackLeader()
}

// Writes an ack to the DB to be consumed by the listening instance of TabElect
// cb (succ, err) => succ if leader acks back else err
TabElectDBManager.prototype.sendAck() {
  // TODO : write ack to disk and have a failure path through timeout and success path through change notification
}

TabElectDBManager.prototype.elect() {
  // TODO : correctly handle attempting to win an election
}

TabElectDBManager.prototype._destroy(err) {
  if (this.destroyed) return
  this.destroyed = true

  if (err) this.emit('error', err)
  this.removeAllListeners()

  // TODO : clean up the DB connection
}

// TODO : refactor this into the _destroy method
TabElectDBManager.prototype._destroyDB = function () {
  var self = this
  if (!self._db) return

  if (self.isLeader) this._db.remove('lock', finished)
  else if (!self.locking) finished()

  function finished () {
    self._db.close()
    self._db = null
  }
}

/********************/
/* HELPER FUNCTIONS */
/********************/

function noop () {
  // do nothing
}
