install:
	npm install

build:
	node scripts/build.js

serve:
	npx http-server . -p 8080

dev:
	npx http-server . -p 8080

clean:
	rm -rf data
