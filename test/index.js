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
  
});