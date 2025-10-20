name: Update README with Recent Activity

on:
  push:
    branches:
      - main

jobs:
  update-readme:
    runs-on: ubuntu-latest
    # Add a condition to prevent the workflow from running on commits from the bot
    if: "!contains(github.event.head_commit.message, 'docs: update recent activity in README')"

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3
      # We need to fetch the full history to get the git log
      with:
        fetch-depth: 0

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Run update script
      run: python scripts/update_readme.py

    - name: Commit and push if README changed
      uses: stefanzweifel/git-auto-commit-action@v4
      with:
        commit_message: "docs: update recent activity in README [skip ci]"
        file_pattern: README.md
        commit_user_name: "github-actions[bot]"
        commit_user_email: "github-actions[bot]@users.noreply.github.com"
        commit_author: "github-actions[bot] <github-actions[bot]@users.noreply.github.com>"
