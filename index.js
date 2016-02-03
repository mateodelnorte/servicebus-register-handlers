var async = require('async');
var debug = require('debug')('register-handlers');
var extend = require('extend');
var fs = require('fs');
var objectifyFolder = require('objectify-folder');
var path = require('path');
var trace = require('debug')('register-handlers:trace');
var util = require('util');
var warn = require('debug')('register-handlers:warn');

function QueuePipeline (options) {
  this.handlers = [];
  this.queueName = options.queueName;
  this.size = 0;
}

QueuePipeline.prototype.push = function (handler) {
  this.size++;
  return this.handlers.push(handler);
};

function RoutingKeyPipeline (options) {
  this.handlers = [];
  this.routingKey = options.routingKey;
  this.size = 0;
}

RoutingKeyPipeline.prototype.push = function (handler) {
  this.size++;
  return this.handlers.push(handler);
};

function Handler (options) {

  if (options.where && typeof options.where !== 'function') throw new Error('module.exports.where must be of type function and return a boolean statement');
  if (options.listen && ! options.queueName) throw new Error('module.exports.listen must be accompanied by a module.exports.queueName specification.')
  if (options.subscribe && ! options.routingKey) throw new Error('module.exports.subscribe must be accompanied by a module.exports.routingKey specification.')
  if (options.listen && options.subscribe) throw new Error('module.exports.listen and module.exports.subscribe cannot both be specified on a handler.')

  this.ack = options.ack;
  this.listen = options.listen;
  this.queueName = options.queueName;
  this.routingKey = options.routingKey || options.queueName;
  this.subscribe = options.subscribe;
  this.type = options.type;
  this.where = options.where;
}

function addHandler (pipelines, handler) {
  if (handlerIsOrSharesListenQueue(handler)) {
    if ( ! pipelines[handler.queueName]) pipelines[handler.queueName] = new QueuePipeline({ queueName: handler.queueName });
    pipelines[handler.queueName].push(handler);
  } else {
    if ( ! pipelines[handler.routingKey]) pipelines[handler.routingKey] = new RoutingKeyPipeline({ routingKey: handler.routingKey });
    pipelines[handler.routingKey].push(handler);
  }
}

function handlerIsOrSharesListenQueue (handler) {
  return handler.listen || (handler.subscribe && handler.queueName);
};

function prepareOptions (options) {
  options = options || {};
  options.pipelines = {};

  if ( ! options.handlers && ! options.path) throw new Error('register-handlers requires a folder path or object of required modules');

  if (options.path) {
    var i = 0;
    var handlers = objectifyFolder({
      fn: function (mod, result) {
        if ( ! (mod.queueName || mod.routingKey) || ! (mod.listen || mod.subscribe)) return;
        addHandler(options.pipelines, new Handler(mod));
      },
      path: options.path
    });

  } else if (options.handlers) {
    options.handlers.forEach(function (handler) {
      addHandler(options.pipelines, handler);
    });
  }

  return options;
}

function registerPipeline (options, pipeline) {

  var bus = options.bus;

  var firstHandler = pipeline.handlers[0];

  var isAck = firstHandler.ack;
  var isListen = firstHandler.listen !== undefined;
  var hasQueueNameSpecified = firstHandler.queueName !== undefined;
  var hasRoutingKeySpecified = firstHandler.routingKey !== undefined;
  var hasTypeSpecified = firstHandler.type !== undefined;
  var hasWhereSpecified = firstHandler.where !== undefined;

  var method = (isListen) ? 'listen' : 'subscribe';
  var queueName = hasQueueNameSpecified ? firstHandler.queueName :
        options.queuePrefix !== undefined ? util.format('%s-', queueName) : firstHandler.routingKey;

  var queueName = firstHandler.queueName;

  var queueName = ! isListen ?
    (firstHandler.queueName) ? firstHandler.queueName :
      (options.queuePrefix !== undefined ? util.format(options.queuePrefix + '-%s', firstHandler.routingKey) : firstHandler.routingKey) :
        firstHandler.routingKey || firstHandler.queueName;

  function handleError (msg, err) {
    debug('error handling message with cid ', msg.cid);
    debug(err.stack || err.message || err);
    if (firstOrOnlyMod.ack) msg.handle.reject(function () {
      throw err;
    });
  }

  function handleIncomingMessage (pipeline, msg, message) {

    var context = {
      queueName: message.fields.queueName,
      routingKey: message.fields.routingKey,
      correlationId: message.properties.correlationId
    };

    var handlers;

    if (pipeline.size > 1) {
      handlers = pipeline.handlers.filter(function (handler) {
        return (handler.routingKey !== undefined && msg.type.match(handler.routingKey)) ||
               (handler.type !== undefined && handler.type === msg.type) ||
               (handler.where !== undefined && handler.where && handler.where(msg));
      });
    } else {
      handlers = pipeline.handlers;
    }

    if (handlers.length === 0) {
      warn('no handler registered to handle %j', msg);
      if (isAck) msg.handle.ack();
      return;
    }

    trace('handling message: %j', msg);

    if (process.domain) process.domain.once('error', (options.handleError || handleError).bind(context, msg));

    async.map(handlers, function (handler, cb) {
      try {
        handler[method].call(context, msg, cb);
      } catch (err) {
        if (err) return (options.handleError || handleError).call(context, msg, err);

        trace('handled message with error: %j', msg);

        if (isAck) return msg.handle.ack(cb);

        else cb();
      }
    }, function (err) {
      if (err) return (options.handleError || handleError).call(context, msg, err);

      if (isAck) msg.handle.ack();

      trace('handled message: %j', msg);

    });

  }

  bus[method].call(bus, queueName,
                        { ack: isAck, routingKey: firstHandler.routingKey },
                        handleIncomingMessage.bind(bus, pipeline));

  if (pipeline.size === 1 || pipeline instanceof RoutingKeyPipeline) return;

  pipeline.handlers.filter(function (h) { return h !== firstHandler; }).forEach(function (handler) {

    if (handler.ack !== isAck) throw new Error('module.exports.ack for %s handlers do not match', firstHandler.queueName || firstHandler.routingKey);

    if (pipeline.handlers.some(function (h) { return handler.routingKey !== h.routingKey; })) {
      if (bus.pubsubqueues[queueName].listening) {
        bus.pubsubqueues[queueName].listenChannel.bindQueue(queueName, bus.pubsubqueues[queueName].exchangeName, handler.routingKey);
      } else {
        bus.pubsubqueues[queueName].on('listening', function () {
          bus.pubsubqueues[queueName].listenChannel.bindQueue(queueName, bus.pubsubqueues[queueName].exchangeName, handler.routingKey);
        })
      }

    }

  });

}

module.exports = function (options) {

  if ( ! options.bus) throw new Error('register-handlers requires in initialized bus variable');

  prepareOptions(options);

  Object.keys(options.pipelines).forEach(function (key) {

    var pipeline = options.pipelines[key];

    registerPipeline(options, pipeline);

  });

  return options;

};
