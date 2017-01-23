# tab-elect

Leader election for browser tabs and workers. Useful for ensuring a long running job is always being run by a single tab/worker.

When a new instance of tab-elect is instantiated, it elects itself the leader. If the leader ever gets destroyed or it's tab is closed, a new leader is automatically elected.

There is one caveat, during the transition from an old leader to a new one, for a short amount of time, both instances will think they are a leader. tab-elect does not attempt to solve this problem.

## Usage

```js
var te = TabElect('campain name')

te.on('elected', function () {
  console.log('I am the leader!', te.isLeader)
})

te.on('deposed', function () {
  console.log('I am not the leader', te.isLeader)
})

te.on('error', function (err) {
  console.log('Error', err)
})
```

## API

### `var te = new TabElect(name)`

Constructs a new TabElect instance with the given name. `name` is used to group instances together so instances with different names will have different elections. Upon instantiation, tab-elect attempts to become the leader.

### te.isLeader

A boolean that indicates if this instance is the leader.

### `te.elect([cb])`

Attempt to elect this instance as the leader. `cb` is called with `cb(err, elected)` where `err` is null if there were no errors and `elected` is true if the instance is now the leader. This method throws an exception if it is called while the instance is the leader.

### `te.depose()`

Forces the instance to relinquish it's leadership status. All other instances will attempt to become the next leader. If the instance is not the leader then this method throws an exception.

### `te.destroy()`

Destroys the instance and frees all internal resources. No more events will be emitted.

## Events

### `te.on('elected', function () {})`

The instance is the new leader

### `te.on('deposed', function () {})`

The instance is no longer the leader

### `te.on('error', function () {})`

A critical error occurred. This instance attempts to relinquish it's leader status and destroys itself.

## License

MIT. Copyright (c) Austin Middleton.
