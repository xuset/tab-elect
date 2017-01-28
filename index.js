/* eslint-env browser */

module.exports = TabElect

var IdbKvStore = require('idb-kv-store')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter

TabElect.SUPPORT = IdbKvStore.INDEXEDDB_SUPPORT && IdbKvStore.BROADCAST_SUPPORT

// TODO : experimentally verify that these numbers aren't bullshit
// Constants
var LEADER_REFRESH_INTERVAL = 250  // In milliseconds
var ACK_TIMEOUT = 250

/********************/
/* PUBLIC INTERFACE */
/********************/

inherits(TabElect, EventEmitter)
function TabElect (name, opts) {
  var self = this
  if (!TabElect.SUPPORT) throw new Error('No IndexedDB or BroadcastChannel support')
  if (typeof name === 'undefined') throw new Error('"name" cannot be undefined')
  if (!(self instanceof TabElect)) return new TabElect(name, opts)
  opts = opts || {}

  EventEmitter.call(self)

  self.dbManager = new TabElectDBManager(name)
  self.dbManager.on('elect', self._onElect)
  self.dbManager.on('newLeader', self._newLeader)

  self.isLeader = false
  self.destroyed = false

  // Handle lifecycle events
  addEventListener('beforeunload', onBeforeUnload)

  function onBeforeUnload () {
    self._destroy()
  }

  // Periodically ack the leader to make sure they are alive
  // NOTE that a randomized timeout may be necessary
  setInterval(function () {
    if (!self.isLeader) self.dbManager.sendAck()
  }, LEADER_REFRESH_INTERVAL)
}

TabElect.prototype.destroy = function () {
  this._destroy()
}

TabElect.prototype._onElect = function () {
  if (this.destroyed) throw new Error('Already destroyed')
  if (this.isLeader) throw new Error('Already the leader')

  this.isLeader = true
  this.emit('active')
}

TabElect.prototype._newLeader = function () {
  if (this.destroyed) throw new Error('Already destroyed')

  // If we were previously the leader, we have been deposed
  if (this.isLeader) {
    this.isLeader = false
    this.emit('deactivate')
  }
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

// Abstracts database interaction for the TabElect class (stateless except for outstanding acks)
//
// Emits the following events:
//   - elect
//   - newLeader
inherits(TabElectDBManager, EventEmitter)
function TabElectDBManager (name) {
  var self = this
  if (!TabElect.SUPPORT) throw new Error('No IndexedDB or BroadcastChannel support')
  if (!(self instanceof TabElectDBManager)) return new TabElectDBManager(name)

  EventEmitter.call(self)

  self._db = new IdbKvStore('tab-elect-' + name)
  self._outstanding_ack_id = {}
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
    // TODO : handle ack responses and leader elections
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

// Writes an ack to the DB to be consumed by the listening instance of TabElect
TabElectDBManager.prototype.sendAck = function () {
  // TODO : write ack to disk and allow a timeout and DB change event to race
}

TabElectDBManager.prototype.elect = function () {
  // TODO : correctly handle attempting to win an election
  // TODO : remove new acks from the DB
}

TabElectDBManager.prototype._destroy = function (err) {
  if (this.destroyed) return
  this.destroyed = true

  if (err) this.emit('error', err)
  this.removeAllListeners()

  // Clean up the DB connection
  if (!this._db) return
  this._db.close()
  this._db = null
}
