build:
	docker build . -f ./Dockerfile -t finance-planner --build-arg BUILDPLATFORM=linux/amd64

bash: build
	docker run --rm -it finance-planner bash

rm:
	docker image rm finance-planner
