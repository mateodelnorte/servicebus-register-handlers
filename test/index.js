require('should');
var registerHandlers = require('../index');
var sinon = require('sinon');

var bus = {
  listen: sinon.spy(),
  subscribe: sinon.spy()
};

var mockbus = {
  listen: function (key, event) {
    bus.listen(key, event);
  },
  subscribe: function (key, event) {
    bus.subscribe(key, event);
  },
  queues: {},
  pubsubqueues: {},
  correlationId: function () {}
}

describe('register-handlers', function () {
  it('should register simple listen', function () {

    var registered = registerHandlers({
      bus: mockbus,
      handlers: [ {
        subscribe: function () {}
      }]
    });

  });

  it.only('should register entire folder', function () {
    var registered = registerHandlers({
      bus: mockbus,
      path: './test/support'
    });

    // console.log(require('util').inspect(registered, null, Infinity))
  });
});