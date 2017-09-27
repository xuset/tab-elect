# tab-elect [![Build Status][travis-image]][travis-url] [![npm][npm-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/tab-elect.svg?style=flat
[npm-url]: https://npmjs.org/package/tab-elect
[travis-image]: https://travis-ci.org/xuset/tab-elect.svg?branch=master
[travis-url]: https://travis-ci.org/xuset/tab-elect


#### Leader election for browser tabs

[![Sauce Test Status](https://saucelabs.com/browser-matrix/xuset-tab-elect.svg)](https://saucelabs.com/u/xuset-tab-elect)

Tab-elect solves the problem of only wanting one browser tab to run a job, and ensure that there is always one browser tab running it even if the previous running tab was closed. This package takes care of the inter-tab communication required to elect one tab as the leader and ensure that there is always a leader even if the previous leader quits. A browser tab gets notified when it has been elected as the new leader, and this allows the tab to run whatever code the leader should run. When another tab takes the leadership position, the previous leader gets notified that it has been deposed.

Tab-elect uses the atomic operations of IndexedDB to ensure that only one leader gets elected even if many candidates attempt to elect themselves simultaneously. BroadcastChannels are used to broadcast when a new leader has taken over; because of this there is a short amount of time during the transition from one leader to another that both instances think they are the leader.

This package should be bundled together with something like WebPack or Browserify since it contains some NPM dependencies.

## Usage

```js
var te = TabElect('campain name')

console.log('Am I the leader?', te.isLeader)

te.on('elected', function () {
  console.log('I am the leader!')
})

te.on('deposed', function () {
  console.log('I am no longer the leader')
})

te.on('error', function (err) {
  console.log('Error', err)
})
```

## API

### `var te = new TabElect(name)`

Constructs a new TabElect instance with the given name. `name` is used to group instances together so instances with different names will have different elections.

### te.isLeader

A boolean that indicates if this instance is the leader.

### `te.elect([cb])`

Attempt to elect this instance as the leader. `cb` is called with `cb(err, elected)` where `err` is null if there were no errors and `elected` is true if the instance is now the leader. This method throws an exception if it is called while the instance is the leader.

### `te.stepDown()`

Forces the instance to relinquish it's leadership status. All other tab-elect instances will attempt to become the next leader. If the instance is not the leader then this method throws an exception.

### `te.destroy()`

Destroys the instance and frees all internal resources. If this instance was the leader than a new leader will be elected. No more events will be emitted.

## Events

### `te.on('elected', function () {})`

The instance is the new leader

### `te.on('deposed', function () {})`

The instance is no longer the leader

### `te.on('error', function () {})`

A critical error occurred. This instance attempts to relinquish it's leader status and destroys itself.

## License

MIT. Copyright (c) Austin Middleton.
