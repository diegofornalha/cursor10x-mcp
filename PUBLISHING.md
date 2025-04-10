# Publishing to npm

This guide covers the steps to publish the cursor10x-mcp package to the npm registry.

## Prerequisites

1. You need an npm account. If you don't have one, create it at [npmjs.com](https://www.npmjs.com/signup).
2. Make sure you're logged in to npm on your local machine:
   ```bash
   npm login
   ```

## Preparation

1. Update package information in `package.json`:
   - Make sure the `name` is available on npm (check at npmjs.com)
   - Update `version` if publishing an update
   - Fill in `author` with your name or organization
   - Update repository URLs if necessary

2. Test the package locally:
   ```bash
   # Build the package
   npm run build
   
   # Create a tarball for local testing
   npm pack
   
   # This will create a file like cursor10x-mcp-1.0.0.tgz
   # You can install and test it locally with:
   npm install -g ./cursor10x-mcp-1.0.0.tgz
   ```

3. Check what files will be included in your package:
   ```bash
   npm publish --dry-run
   ```
   
   This will list all files that would be published without actually publishing.

## Publishing

1. For first-time publishing:
   ```bash
   npm publish
   ```

2. For subsequent updates:
   - Update the version in package.json using semantic versioning:
     ```bash
     # For a patch update (bug fixes)
     npm version patch
     
     # For a minor update (backwards-compatible features)
     npm version minor
     
     # For a major update (breaking changes)
     npm version major
     ```
   - Then publish:
     ```bash
     npm publish
     ```

## After Publishing

1. Create a GitHub release (if using GitHub):
   - Tag the release with your version
   - Include release notes

2. Announce the update as needed

## For scoped packages (optional)

If you want to publish under your npm username or organization:

1. Change the package name in package.json:
   ```json
   "name": "@your-username/cursor10x-mcp"
   ```

2. For public access (free):
   ```bash
   npm publish --access=public
   ```

3. For private packages (requires npm paid plan):
   ```bash
   npm publish
   ``` 