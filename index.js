var debug = require('debug')('register-handlers');
var extend = require('extend');
var fs = require('fs');
var objectifyFolder = require('objectify-folder');
var path = require('path');
var trace = require('debug')('register-handlers:trace');
var util = require('util');

function prepareOptions (options) {
  options = options || {};

  if ( ! options.bus) throw new Error('register-handlers requires in initialized bus variable');

  this.bus = options.bus;

  if ( ! options.handlers && ! options.path) throw new Error('register-handlers requires a folder path or object of required modules');

  if (options.path) {
    options.handlers = objectifyFolder({
      fn: function (mod, result) {
        if ( ! mod.routingKey || ! (mod.listen || mod.subscribe)) return;
        result[(mod.listen ? 'listen.' : 'subscribe.') + mod.routingKey] = mod;
      },
      path: options.path
    });
  }

  return options;
}

module.exports = function (options) {

  prepareOptions(options);

  var self = this;

  Object.keys(options.handlers).forEach(function (key) {

    var mod = options.handlers[key];
    var handler = mod.listen || mod.subscribe;
    var method = mod.subscribe ? 'subscribe' : 'listen';
    var routingKey = mod.routingKey;

    debug('%sing to %s', method === 'subscribe' ? method.slice(0, -1) : method, routingKey);

    var rk = method === 'subscribe' ?
      (mod.queueName) ? mod.queueName :
        (options.queuePrefix !== undefined ? util.format(options.queuePrefix + '-.%s', routingKey) : routingKey) :
          routingKey;

    function handleError (msg, err) {
      debug('error handling message with cid ', msg.cid);
      debug(err.stack || err.message || err);
      if (mod.ack) msg.handle.reject(function () {
        throw err;
      });
    }

    self.bus[method](rk, mod, function (msg, message) {

      trace('handling message: %j', msg);

      var context = {
        routingKey: message.fields.routingKey,
        correlationId: message.properties.correlationId
      };

      handler.call(context, msg, function (err) {
        if (err) return (options.handleError || handleError).call(context, msg, err);

        if (mod.ack) msg.handle.ack();

        trace('handled message: %j', msg);

      });

    });

  });

};