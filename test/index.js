require('should');
var registerHandlers = require('../index');
var sinon = require('sinon');

var bus = {
  listen: sinon.spy(),
  subscribe: sinon.spy()
};

var mockbus = {
  listen: function (key, event) {
    this.queues[key] = {
      listening: false,
      on: function () {}
    };
    bus.listen(key, event);
  },
  on: function () {},
  subscribe: function (key, event) {
    this.pubsubqueues[key] = {
      listening: false,
      on: function () {}
    };
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
        listen: function () {}
      }]
    });

  });

  it('should register simple subscribe', function () {

    var registered = registerHandlers({
      bus: mockbus,
      handlers: [ {
        subscribe: function () {}
      }]
    });

  });

  it('should register entire folder', function () {
    var registered = registerHandlers({
      bus: mockbus,
      path: './test/support'
    });

    registered.pipelines.should.have.property('one');
    registered.pipelines['one'].should.have.property('size', 2);

    registered.pipelines.should.have.property('two.*');
    registered.pipelines['two.*'].should.have.property('size', 1);

    registered.pipelines.should.have.property('four-five');
    registered.pipelines['four-five'].should.have.property('size', 2);

  });

  it('should register globbed folders', function () {
    var registered = registerHandlers({
      bus: mockbus,
      path: './test/support/**/*'
    });

    registered.pipelines.should.have.property('one');
    registered.pipelines['one'].should.have.property('size', 2);

    registered.pipelines.should.have.property('two.*');
    registered.pipelines['two.*'].should.have.property('size', 1);

    registered.pipelines.should.have.property('four-five');
    registered.pipelines['four-five'].should.have.property('size', 2);

    registered.pipelines.should.have.property('six');
    registered.pipelines['six'].should.have.property('size', 1);

  });

  it('simplified api should map to correct values and default ack to true', function () {
    var registered = registerHandlers({
      bus: mockbus,
      path: './test/support'
    });

    registered.pipelines.should.have.property('domain.command');
    registered.pipelines['domain.command'].should.have.property('queueName', 'domain.command');
    registered.pipelines['domain.command'].should.have.property('size', 1);

    registered.pipelines.should.have.property('domain.event');
    registered.pipelines['domain.event'].should.have.property('routingKey', 'domain.event');
    registered.pipelines['domain.event'].should.have.property('size', 1);
  });

  it('Handler constructor options', () => {
    var routingKeyHandler = new registerHandlers.Handler({
      routingKey: 'r.k',
      subscribe: function(){}
    })
    routingKeyHandler.should.have.property('routingKey', 'r.k')
    routingKeyHandler.should.have.property('ack', undefined)

    var eventHandler = new registerHandlers.Handler({
      event: 'r.k',
      subscribe: function(){}
    })
    eventHandler.should.have.property('routingKey', 'r.k')
    eventHandler.should.have.property('ack', true)

    var queueNameHandler = new registerHandlers.Handler({
      queueName: 'q.n',
      listen: function(){}
    })
    queueNameHandler.should.have.property('queueName', 'q.n')
    queueNameHandler.should.have.property('ack', undefined)

    var commandHandler = new registerHandlers.Handler({
      command: 'q.n',
      listen: function(){}
    })
    commandHandler.should.have.property('queueName', 'q.n')
    commandHandler.should.have.property('ack', true)
  })
  
});