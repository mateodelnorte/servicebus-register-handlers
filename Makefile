DEBUG=register-handlers*

test:
	$(MAKE) DEBUG= test-debug

test-debug:
	DEBUG=$(DEBUG) \
	npm test

.PHONY: test
