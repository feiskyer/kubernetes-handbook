BOOK_NAME := kubernetes-handbook
BOOK_OUTPUT := _book

.PHONY: build
build:
	gitbook build . $(BOOK_OUTPUT)

.PHONY: serve
serve:
	gitbook serve . $(BOOK_OUTPUT)

.PHONY: epub
epub:
	gitbook epub . $(BOOK_NAME).epub

.PHONY: pdf
pdf:
	gitbook pdf . $(BOOK_NAME).pdf

.PHONY: mobi
mobi:
	gitbook mobi . $(BOOK_NAME).mobi

.PHONY: install
install:
	npm install gitbook-cli -g
	gitbook install

.PHONY: clean
clean:
	rm -rf $(BOOK_OUTPUT)

.PHONY: spell
spell:
	go get github.com/client9/misspell/cmd/misspell
	git ls-files | grep -v /vendor/ | xargs misspell -error -o stderr	

.PHONY: help
help:
	@echo "Help for make"
	@echo "make          - Build the book"
	@echo "make build    - Build the book"
	@echo "make serve    - Serving the book on localhost:4000"
	@echo "make install  - Install gitbook and plugins"
	@echo "make epub     - Build epub book"
	@echo "make pdf      - Build pdf book"
	@echo "make spell    - Check splling"
	@echo "make clean    - Remove generated files"
