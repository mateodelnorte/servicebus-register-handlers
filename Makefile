DEBUG=register-handlers*

test:
	$(MAKE) DEBUG= test-debug

test-debug:
	DEBUG=$(DEBUG) \
	npm test
	node --experimental-modules ./test-mjs/test.mjs

.PHONY: test
