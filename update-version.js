// update-version.js
const fs = require('fs');
const { execSync } = require('child_process');

const packageJson = require('./package.json');

try {
  // Get the latest Git tag
  const latestTag = execSync('git describe --tags --abbrev=0')
    .toString()
    .trim();

  // Update the version in package.json
  packageJson.version = latestTag;

  // Write the package.json back
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
} catch (error) {
  console.error('Failed to update version:', error);
  process.exit(1);
}
