#!/bin/bash
# smartLife 環境セットアップ
set -e

echo "Installing dependencies..."
npm install

echo "Starting dev server..."
npm run dev
