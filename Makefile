DEBUG=register-handlers*

test:
	$(MAKE) DEBUG= test-debug

test-debug:
	DEBUG=$(DEBUG) \
	./node_modules/.bin/mocha test -R spec --recursive

.PHONY: test
