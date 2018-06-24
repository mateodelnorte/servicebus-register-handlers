import registerHandlers from '../index.js'
import path from 'path'
import assert from 'assert'

console.log('starting module tests')

const mockbus = {
  listen: function (key, event) {
    this.queues[key] = {
      listening: false,
      on: function () {}
    };
    // bus.listen(key, event);
  },
  on: function () {},
  subscribe: function (key, event) {
    this.pubsubqueues[key] = {
      listening: false,
      on: function () {}
    };
    // bus.subscribe(key, event);
  },
  queues: {},
  pubsubqueues: {},
  correlationId: function () {},
  publish: function (key, event, done) {
    done && done()
    // lol
  }
}

const test = async () => {
  let modules = await registerHandlers({
    bus: mockbus,
    path: path.resolve(process.cwd(), 'test', 'support', 'api')
  })

  console.log('modules.pipelines', modules.pipelines)

  assert(modules.pipelines['domain.command'])
  assert(modules.pipelines['domain.command'].handlers.length === 1)
  assert(modules.pipelines['domain.event'])
  assert(modules.pipelines['domain.event'].handlers.length === 1)
  console.log('module tests passed')
}

test()
