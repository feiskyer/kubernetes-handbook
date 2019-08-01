#!/bin/bash

cat .convert | while read line; do
  echo "$line"
  find . -type f -name "$line" | while read file; do
    echo "$file"
    opencc -c "./s2tw.json" -i "$file" -o "$file"
  done
done

