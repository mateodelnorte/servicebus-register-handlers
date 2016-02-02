var async = require('async');
var debug = require('debug')('register-handlers');
var extend = require('extend');
var fs = require('fs');
var objectifyFolder = require('objectify-folder');
var path = require('path');
var trace = require('debug')('register-handlers:trace');
var util = require('util');
var warn = require('debug')('register-handlers:warn');

function prepareOptions (options) {
  options = options || {};

  if ( ! options.bus) throw new Error('register-handlers requires in initialized bus variable');

  this.bus = options.bus;

  if ( ! options.handlers && ! options.path) throw new Error('register-handlers requires a folder path or object of required modules');

  if (options.path) {
    options.handlers = objectifyFolder({
      fn: function (mod, result) {

        if ( ! (mod.queueName || mod.routingKey) || ! (mod.listen || mod.subscribe)) return;

        var key = (mod.listen ? 'listen.' : 'subscribe.') + (mod.routingKey === undefined ? mod.queueName : mod.routingKey);

        if (mod.where || mod.type) {

          if ( ! result[key]) {
            result[key] = [];
          }

          if (mod.where && typeof mod.where !== 'function') throw new Error('module.exports.where must be of type function and return a boolean statement');

          try {
            result[key].push(mod);
          } catch (err) {
            if (err.message === 'result[key].push is not a function') {
              throw new Error(util.format('Error creating module %s. Another module may exist on its queue or routingKey, but without a required type or where export.', key));
            }
            else throw err;
          }

        } else {
          result[key] = mod;
        }

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

    if ( ! (mod.routingKey || mod.queueName) && ! (mod instanceof Array)) return;

    var firstOrOnlyMod = ((mod instanceof Array) ? mod[0] : mod);

    var handler =  firstOrOnlyMod.listen || firstOrOnlyMod.subscribe;
    var method = firstOrOnlyMod.subscribe ? 'subscribe' : 'listen';
    var routingKey = firstOrOnlyMod.routingKey;

    var rk = method === 'subscribe' ?
      (firstOrOnlyMod.queueName) ? firstOrOnlyMod.queueName :
        (options.queuePrefix !== undefined ? util.format(options.queuePrefix + '-%s', routingKey) : routingKey) :
          routingKey || firstOrOnlyMod.queueName;

    if (method === 'subscribe' && bus.pubsubqueues[rk] !== undefined) return; // do not subscribe to a single fanout queue more than once

    debug('%sing to %s', method === 'subscribe' ? method.slice(0, -1) : method, rk);

    function handleError (msg, err) {
      debug('error handling message with cid ', msg.cid);
      debug(err.stack || err.message || err);
      if (firstOrOnlyMod.ack) msg.handle.reject(function () {
        throw err;
      });
    }

    self.bus[method](rk, firstOrOnlyMod, function (msg, message) {

      var thisModule = mod;

      var context = {
        queueName: message.fields.queueName,
        routingKey: message.fields.routingKey,
        correlationId: message.properties.correlationId
      };

      if (thisModule instanceof Array) {
        thisModule = thisModule.filter(function (m) {
          return m.type === msg.type || (m.where && m.where(msg));
        });
      } else {
        thisModule = [thisModule];
      }

      if (thisModule.length === 0) {
        warn('no handler registered to handle %j', msg);
        if (firstOrOnlyMod.ack) msg.handle.ack();
        return;
      }

      trace('handling message: %j', msg);

      if (process.domain) process.domain.once('error', (options.handleError || handleError).bind(context, msg));

      async.map(thisModule, function (m, cb) {
        try {
          m[method].call(context, msg, cb);
        } catch (err) {
          if (err) return (options.handleError || handleError).call(context, msg, err);
          trace('handled message with error: %j', msg);
          if (firstOrOnlyMod.ack) return msg.handle.ack(cb);
          else cb();
        }
      }, function (err) {
        if (err) return (options.handleError || handleError).call(context, msg, err);
        if (firstOrOnlyMod.ack) msg.handle.ack();
        trace('handled message: %j', msg);
      });

    });

  });

};
