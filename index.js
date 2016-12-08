
module.exports = TabElect

function TabElect (channel, opts) {
  var self = this
  if (typeof BroadcastChannel === 'undefined') throw new Error('No BroadcastChannel support')
  if (typeof channel === 'undefined') throw new Error('`channel` cannot be undefined')
  if (!(self instanceof TabElect)) return new TabElect(channel, opts)
  if (!opts) opts = {}

  self.id = opts.id || Math.random().toString().substr(2)
  self.onelect = function () {}
  self.ondepose = function () {}

  self._channel = typeof channel === 'object' ? channel : new BroadcastChannel('waft-' + channel)
  self._channel.onmessage = function (event) {
    self._onMessage(event.data)
  }
}

TabElect.prototype._onMessage = function (msg) {
  if (!this._channel) return
}

TabElect.prototype.destroy = function () {
  if (!this._channel) return
  this._channel.close()
  this._channel = null
}
