on:
types: [created]
name: Automatic Rebase
jobs:
rebase:
name: Rebase
runs-on: ubuntu-latest
steps:
- name: Checkout the latest code
uses: actions/checkout@v2
with:
- fetch: depth: 1
- name: Automatic Release
uses: cirrus-actions/rebase@1.4
env:
GITHUB_TOKEN: ${{GITHUB_TOKEN }}
GITHUB_API: ${{GITHUB_API }}
GITHUB_SHA: ${{GITHUB_SHA }}
