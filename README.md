[![Build Status](https://travis-ci.org/mateodelnorte/servicebus-register-handlers.svg?branch=master)](https://travis-ci.org/mateodelnorte/servicebus-register-handlers)

# servicebus-register-handlers

servicebus-register-handlers provides convention based message/event handler definition for distributed services using servicebus. 

## Configuration

#### sample service.js file:

```
const bus = require('./lib/bus');
const config = require('cconfig')();
const handleAudit = require('handle-audit');
const log = require('llog');
const registerHandlers = require('servicebus-register-handlers');
const util = require('util');

module.exports.start = (cb) => {

  log.debug('registering event handlers');

  registerHandlers({
    bus: bus,
    handleError: function handleError (msg, err) {
      log.error('error handling %s: %s. rejecting message w/ cid %s and correlationId %s.', msg.type, err, msg.cid, this.correlationId);
      log.error(err);
      msg.handle.reject(function () {
        throw err;
      });
    },
    onHandlerCompleted: handleAudit(bus, 'action.audited'), // publish auditing message after handler completed
    path: './lib/handlers',   // load all handlers defined in the provided directory
    queuePrefix: 'sample-svc' // prepend all subscribe queue names with provided string
  });

  cb();

});
```

## Handler definition

Below is a sample subscribe handler. Additional documentation coming soon. 

```
const log = require('llog');

module.exports.ack = true; // make queue persistent

module.exports.queueName = 'my.queue.name'; // optional queue name

module.exports.routingKey = 'my.*.routing.key.#'; // routing keys for subscribes

module.exports.type = 'blotter.entry.removed'; // optionally match against amqp type header property

module.exports.where = function (msg) {
  return msg.data.id === 'my.id'; // filter messages to those matching where clause 
};

module.exports.subscribe = function (event, cb) {
  log.trace('received %j', event);
  cb(); 
};
```

## Command/Event API

Servicebus is often using in CQRS systems, so a simplified API is exposed to
simplify it's usage for this pattern.

When using either `command` or `event` keys as exports, the option `ack` will
automatically be set to true.

### Commands

You may specify you command handlers by simply exporting a `command` property
and a `listen` event.

```
module.exports.command = 'domain.command';

module.exports.listen = function (command, cb) {
  // no op
}
```

With modules:
```
export const command = 'domain.command'

export const listen = function (command, cb) {
  const { id, product } = command.data
  // do something
  cb()
}

```

### Events

You may specify you event handlers by simply exporting a `event` property
and a `subscribe` event.

```
module.exports.event = 'domain.event';

module.exports.subscribe = function (event, cb) {
  // no op
}
```

With modules:
```
export const event = 'domain.event'

export const subscribe = function (event, cb) {
  const { id, product } = event.data
  // do something
  cb()
}

```

## Module support

MJS modules have recently been introduced to the Javascript ecosystem, however, you
may not use a combination of both. When using MJS, it's necessary to use dynamic imports.

This will be done automatically for you when you specify the option `modules` to be `true`
in the initial registerHandlers call.

```
import path from 'path'
import log from 'llog'
import errortrap from 'errortrap'
import registerHandlers from 'servicebus-register-handlers'
import sbc from 'servicebus-bus-common';
import { config } from '../config.mjs'
import server from 'express-api-common'

errortrap()

const bus = sbc.makeBus(config)
const { queuePrefix } = config

registerHandlers({
  bus,
  path:  path.resolve(process.cwd(), 'handlers'),
  modules: true,
  queuePrefix
})

server.start()

log.info('service is running')
```