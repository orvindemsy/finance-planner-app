build-amd:
	docker build . -f ./Dockerfile -t finance-planner --build-arg BUILDPLATFORM=linux/amd64

build-arm:
	docker build . -f ./Dockerfile -t finance-planner --build-arg BUILDPLATFORM=linux/arm64

bash:
	docker run --rm -it finance-planner bash

rm:
	docker image rm finance-planner
