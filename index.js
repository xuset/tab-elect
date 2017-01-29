/* eslint-env browser */

module.exports = TabElect

var IdbKvStore = require('idb-kv-store')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter

TabElect.SUPPORT = IdbKvStore.INDEXEDDB_SUPPORT && IdbKvStore.BROADCAST_SUPPORT

/*************/
/* CONSTANTS */
/*************/

// TODO : experimentally verify that these numbers aren't bullshit
var LEADER_REFRESH_INTERVAL = 250  // In milliseconds
var PING_TIMEOUT = 250  // In milliseconds

var TERM_KEY_PREFIX = 'term-'
var PING_KEY_PREFIX = 'ping-'
var ACK_KEY_PREFIX = 'ack-'

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
  self.dbManager.on('elected', self._onElected)
  self.dbManager.on('newLeader', self._newLeader)

  self.isLeader = false
  self.destroyed = false

  // Handle lifecycle events
  addEventListener('beforeunload', onBeforeUnload)

  function onBeforeUnload () {
    self._destroy()
  }

  // Periodically ping the leader to make sure they are alive
  // NOTE that a randomized timeout may be necessary
  setInterval(function () {
    if (!self.isLeader) self.dbManager.sendPing()
  }, LEADER_REFRESH_INTERVAL)
}

TabElect.prototype.destroy = function () {
  // Only destroy the DB if this object was manually destroyed
  self._db.destroy()

  this._destroy()
}

TabElect.prototype._onElected = function () {
  if (this.destroyed) throw new Error('Already destroyed')
  if (this.isLeader) throw new Error('Already the leader')

  this.isLeader = true
  this.emit('activate')
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

// Abstracts database interaction for the TabElect class
//
// Emits the following events:
//  - elected
//  - newLeader
inherits(TabElectDBManager, EventEmitter)
function TabElectDBManager (name) {
  var self = this
  if (!TabElect.SUPPORT) throw new Error('No IndexedDB or BroadcastChannel support')
  if (!(self instanceof TabElectDBManager)) return new TabElectDBManager(name)

  EventEmitter.call(self)

  self.id = genId()
  self.destroyed = false

  self._db = new IdbKvStore('tab-elect-' + name)
  self._pings = []
  self._curTerm = null

  // Handle DB and lifecycle events
  self._db.on('change', onDbChange)
  self._db.on('error', onDbError)
  self._db.on('close', onDbClose)

  addEventListener('beforeunload', onBeforeUnload)

  var extractIdFromKey = function (key) {
    parseInt(key.substring(key.lastIndexOf('-')))
  }

  /******************/
  /* EVENT HANDLERS */
  /******************/

  function onDbChange (change) {
    if (self.destroyed) return

    // Handle new terms, pings, and acks
    if (change.key.startsWith(TERM_KEY_PREFIX)) {
      var newTerm = extractIdFromKey(change.value)

      // Protects against duplicate or out of order messages
      if (newTerm <= self._curTerm) return

      // We are in a new term now
      self._curTerm = newTerm

      // Clear the outstanding pings, since we don't want to depose the new leader
      self._pings = []

      // Check to see if we were elected as the leader
      if (change.value === self.id) self.emit('elected')
      else self.emit('newLeader')
    } else if (change.key.startsWith(ACK_KEY_PREFIX)) {
      var pingId = extractIdFromKey(change.value)
      var pingIndex = self._pings.indexOf(pingId)

      // Remove the outstanding ack if it exists
      if (pingIndex !== -1) self._pings.splice(pingIndex, 1)
    } else if (change.key.startsWith(PING_KEY_PREFIX)) {
      // Ignore acks
      return
    } else {
      throw Error('Invalid key ' + change.key)
    }
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

  // Try to get the current term
  // If no leader exists, try to win an election (avoids waiting for the ping timeout)
  self._db.keys(function (err, keys) {
    if (err) throw err

    self._curTerm = keys.filter(function (k) {
      k.startsWith(TERM_KEY_PREFIX)
    }).map(extractIdFromKey).sort().pop()

    if (self._curTerm === undefined) {
      self._curTerm = 0
      self.elect()
    }
  })
}

// Writes a ping to the DB to be consumed by the current leader
// Allows the leader's DB change event and a timeout callback to race
TabElectDBManager.prototype.sendPing = function () {
  var self = this

  var pingId = genId()
  self._pings.append(pingId)
  self._db.set(PING_KEY_PREFIX + pingId, function (err) {
    if (err) throw err

    // Set a timeout to trigger an election if there is no response to this ack
    setTimeout(function () {
      if (self._pings.indexOf(pingId) !== -1) self.elect()
    }, PING_TIMEOUT)
  })
}

TabElectDBManager.prototype.elect = function () {
  // Performs an atomic operation that attempts to write its ID to the next term.
  // On Success => we became leader (action is delegated to the `onDbChange` event handler)
  // On Failure => someone else became leader
  this._db.add(TERM_KEY_PREFIX + (self._curTerm + 1), self.id)
}

TabElectDBManager.prototype.destroy = function () {
  this._destroy()
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

/***********/
/* HELPERS */
/***********/

function genId () {
  return Math.floor(Math.random() * Math.pow(2, 32))
}

