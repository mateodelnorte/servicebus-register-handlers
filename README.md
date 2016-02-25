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
