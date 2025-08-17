# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Defold engine and application bundle size tracking project that monitors and visualizes the size evolution of the Defold game engine across different platforms and versions. The project automatically generates size reports and graphs for engine binaries, complete game bundles, bob.jar (build tool), and the Defold editor.

## Development Commands

### Main Script
- `python3 check_size.py` - Main script that generates all reports and graphs
- `python -m pip install matplotlib` - Install required matplotlib dependency
- `python -m pip install -U pip` - Update pip package manager

### Requirements
- Python 3 (developed with 3.10.5)
- Java 11.0.* or higher (for running bob.jar)
- matplotlib library

## Project Architecture

### Core Components

1. **check_size.py** - Main Python script that orchestrates the entire size tracking process:
   - Downloads bob.jar build tool for each Defold version
   - Measures engine binary sizes across all supported platforms
   - Builds complete game bundles and measures their sizes
   - Downloads and measures editor and bob.jar sizes
   - Generates CSV reports and PNG graphs

2. **releases.json** - Central configuration file containing all tracked Defold versions with their SHA1 hashes

3. **empty_project/** - Minimal Defold project used as a template for bundle size measurements

4. **Platform Support** - Tracks sizes for:
   - Mobile: arm64-ios, arm64-android, armv7-android
   - Desktop: x86_64-macos, arm64-macos, x86_64-linux, x86-win32, x86_64-win32
   - Web: js-web, wasm-web

### Data Flow

1. Script checks for new Defold releases from d.defold.com
2. Downloads bob.jar for each version and extracts engine binaries
3. Builds complete game bundles using the empty_project template
4. Measures file sizes and updates CSV reports
5. Generates PNG graphs showing size evolution over time
6. GitHub Actions automatically commits updated reports and graphs

### File Structure

- `*_report.csv` - Size data in CSV format for different components
- `*_size.png` - Generated graphs showing size trends
- `bundle_output/` - Temporary directory for bundle builds
- `libexec/` - Extracted engine binaries from bob.jar
- `bob_*.jar` - Downloaded bob.jar files for different versions

## Automation

The project runs automatically via GitHub Actions on:
- Every push to the repository
- Daily schedule (2 AM UTC)

The workflow automatically commits new size reports and graphs when changes are detected.

## Adding New Versions

To track a new Defold version, add an entry to releases.json with the version number and SHA1 hash from d.defold.com. The automation will handle the rest.