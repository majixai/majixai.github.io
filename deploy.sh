#!/bin/bash
docker build -t texas-holdem .
docker run -p 5000:5000 texas-holdem
